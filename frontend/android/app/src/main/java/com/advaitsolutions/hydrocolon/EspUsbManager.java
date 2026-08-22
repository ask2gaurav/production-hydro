package com.advaitsolutions.hydrocolon;

import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.hardware.usb.UsbDevice;
import android.hardware.usb.UsbDeviceConnection;
import android.hardware.usb.UsbManager;
import android.os.Build;
import android.util.Log;

import com.hoho.android.usbserial.driver.UsbSerialDriver;
import com.hoho.android.usbserial.driver.UsbSerialPort;
import com.hoho.android.usbserial.driver.UsbSerialProber;
import com.hoho.android.usbserial.util.SerialInputOutputManager;

import java.io.IOException;
import java.util.List;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * Wraps the usb-serial-for-android lifecycle (permission request, port open/close, async
 * read loop) for a single ESP32-over-USB connection. One command per line in, one loose-JSON
 * line back — see EspUsbPlugin for the framing contract with the frontend.
 */
public class EspUsbManager {
    private static final String TAG = "EspUsbManager";
    private static final String ACTION_USB_PERMISSION = "com.advaitsolutions.hydrocolon.USB_PERMISSION";
    private static final int BAUD_RATE = 115200;

    public interface Listener {
        void onAttached(int vendorId, int productId);
        void onConnected();
        void onDisconnected(String reason);
        void onLineReceived(String line);
    }

    private final Context context;
    private final UsbManager usbManager;
    private final Listener listener;

    private UsbSerialPort port;
    private SerialInputOutputManager ioManager;
    private final StringBuilder readBuffer = new StringBuilder();
    private boolean receiversRegistered = false;
    // Opening the port involves a reset-pulse sequence with short sleeps (see
    // openFirstAvailableDriver) — this can be triggered from permissionReceiver.onReceive,
    // which runs on the main thread, so the work is offloaded here to avoid blocking it.
    private final ExecutorService ioExecutor = Executors.newSingleThreadExecutor();

    public EspUsbManager(Context context, Listener listener) {
        this.context = context;
        this.usbManager = (UsbManager) context.getSystemService(Context.USB_SERVICE);
        this.listener = listener;
        registerReceivers();
    }

    // Both receivers run on the main thread — an uncaught exception here would crash the
    // whole app (this drives an unattended therapy-session tablet), so every path is guarded.
    private final BroadcastReceiver permissionReceiver = new BroadcastReceiver() {
        @Override
        public void onReceive(Context ctx, Intent intent) {
            try {
                if (!ACTION_USB_PERMISSION.equals(intent.getAction())) return;
                synchronized (this) {
                    UsbDevice device = intent.getParcelableExtra(UsbManager.EXTRA_DEVICE);
                    boolean granted = intent.getBooleanExtra(UsbManager.EXTRA_PERMISSION_GRANTED, false);
                    if (granted && device != null) {
                        openFirstAvailableDriver();
                    } else {
                        listener.onDisconnected("USB permission denied");
                    }
                }
            } catch (Exception e) {
                Log.e(TAG, "Error handling USB permission result", e);
                listener.onDisconnected("USB permission handling error: " + e.getMessage());
            }
        }
    };

    private final BroadcastReceiver attachDetachReceiver = new BroadcastReceiver() {
        @Override
        public void onReceive(Context ctx, Intent intent) {
            try {
                String action = intent.getAction();
                UsbDevice device = intent.getParcelableExtra(UsbManager.EXTRA_DEVICE);
                if (UsbManager.ACTION_USB_DEVICE_ATTACHED.equals(action) && device != null) {
                    UsbSerialDriver driver = UsbSerialProber.getDefaultProber().probeDevice(device);
                    if (driver != null) {
                        listener.onAttached(device.getVendorId(), device.getProductId());
                    }
                } else if (UsbManager.ACTION_USB_DEVICE_DETACHED.equals(action)) {
                    close("USB device detached");
                }
            } catch (Exception e) {
                Log.e(TAG, "Error handling USB attach/detach event", e);
            }
        }
    };

    private void registerReceivers() {
        if (receiversRegistered) return;
        IntentFilter permissionFilter = new IntentFilter(ACTION_USB_PERMISSION);
        IntentFilter attachDetachFilter = new IntentFilter();
        attachDetachFilter.addAction(UsbManager.ACTION_USB_DEVICE_ATTACHED);
        attachDetachFilter.addAction(UsbManager.ACTION_USB_DEVICE_DETACHED);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            context.registerReceiver(permissionReceiver, permissionFilter, Context.RECEIVER_NOT_EXPORTED);
            context.registerReceiver(attachDetachReceiver, attachDetachFilter, Context.RECEIVER_NOT_EXPORTED);
        } else {
            context.registerReceiver(permissionReceiver, permissionFilter);
            context.registerReceiver(attachDetachReceiver, attachDetachFilter);
        }
        receiversRegistered = true;
    }

    public boolean isAvailable() {
        return !findDrivers().isEmpty();
    }

    private List<UsbSerialDriver> findDrivers() {
        return UsbSerialProber.getDefaultProber().findAllDrivers(usbManager);
    }

    /** Requests permission (if needed) and opens the first matching USB serial device. */
    public void connect() {
        List<UsbSerialDriver> drivers = findDrivers();
        if (drivers.isEmpty()) {
            listener.onDisconnected("No USB serial device found");
            return;
        }
        UsbSerialDriver driver = drivers.get(0);
        UsbDevice device = driver.getDevice();
        if (usbManager.hasPermission(device)) {
            openFirstAvailableDriver();
            return;
        }
        // Android 14+ throws IllegalArgumentException for a mutable PendingIntent wrapping an
        // implicit intent. setPackage() makes this intent explicit so FLAG_MUTABLE is allowed.
        Intent permissionRequestIntent = new Intent(ACTION_USB_PERMISSION);
        permissionRequestIntent.setPackage(context.getPackageName());
        int flags = Build.VERSION.SDK_INT >= Build.VERSION_CODES.S ? PendingIntent.FLAG_MUTABLE : 0;
        PendingIntent permissionIntent = PendingIntent.getBroadcast(
                context, 0, permissionRequestIntent, flags);
        usbManager.requestPermission(device, permissionIntent);
    }

    // May be called from permissionReceiver.onReceive() (main thread) — the actual work
    // includes short sleeps for the reset pulse below, so it's dispatched to a background
    // thread rather than run inline.
    private void openFirstAvailableDriver() {
        ioExecutor.execute(this::openFirstAvailableDriverBlocking);
    }

    private void openFirstAvailableDriverBlocking() {
        List<UsbSerialDriver> drivers = findDrivers();
        if (drivers.isEmpty()) {
            listener.onDisconnected("No USB serial device found");
            return;
        }
        UsbSerialDriver driver = drivers.get(0);
        UsbDeviceConnection connection = usbManager.openDevice(driver.getDevice());
        if (connection == null) {
            listener.onDisconnected("Failed to open USB device (no permission or device busy)");
            return;
        }
        try {
            UsbSerialPort openedPort = driver.getPorts().get(0);
            openedPort.open(connection);
            openedPort.setParameters(BAUD_RATE, UsbSerialPort.DATABITS_8,
                    UsbSerialPort.STOPBITS_1, UsbSerialPort.PARITY_NONE);

            // Many ESP32 boards (CP2102/CH340) wire DTR/RTS into the auto-reset/bootloader
            // circuit. A static "release" level isn't enough if EN is already held low going
            // into this call — there's no edge to force it high. Instead, replicate the same
            // reset pulse esptool/Arduino IDE perform on every upload to hand the board back
            // to running its sketch, so it boots into run mode regardless of the prior state.
            try {
                openedPort.setDTR(false);
                openedPort.setRTS(true);
                Thread.sleep(100);
                openedPort.setDTR(true);
                openedPort.setRTS(false);
                Thread.sleep(50);
                openedPort.setDTR(false);
            } catch (Exception e) {
                // Not all drivers/devices support control lines — non-fatal either way.
                Log.w(TAG, "Could not perform reset pulse after opening USB port", e);
            }

            this.port = openedPort;
            readBuffer.setLength(0);

            ioManager = new SerialInputOutputManager(openedPort, new SerialInputOutputManager.Listener() {
                @Override
                public void onNewData(byte[] data) {
                    handleIncomingBytes(data);
                }

                @Override
                public void onRunError(Exception e) {
                    Log.e(TAG, "USB serial read error", e);
                    close("USB read error: " + e.getMessage());
                }
            });
            ioManager.start();

            listener.onConnected();
        } catch (IOException e) {
            Log.e(TAG, "Failed to open USB serial port", e);
            listener.onDisconnected("Failed to open USB serial port: " + e.getMessage());
        }
    }

    private void handleIncomingBytes(byte[] data) {
        String chunk = new String(data);
        synchronized (readBuffer) {
            readBuffer.append(chunk);
            int newlineIndex;
            while ((newlineIndex = readBuffer.indexOf("\n")) >= 0) {
                String line = readBuffer.substring(0, newlineIndex).replace("\r", "");
                readBuffer.delete(0, newlineIndex + 1);
                if (!line.isEmpty()) {
                    listener.onLineReceived(line);
                }
            }
        }
    }

    /** Writes one command line (newline appended) to the open port. Throws if not connected. */
    public void writeLine(String data) throws IOException {
        if (port == null) throw new IOException("USB serial port is not open");
        byte[] bytes = (data + "\n").getBytes();
        port.write(bytes, 2000);
    }

    public boolean isConnected() {
        return port != null;
    }

    private void close(String reason) {
        boolean wasConnected = port != null;
        if (ioManager != null) {
            ioManager.setListener(null);
            ioManager.stop();
            ioManager = null;
        }
        if (port != null) {
            try {
                port.close();
            } catch (IOException ignored) {
                // Best effort — device is likely already gone.
            }
            port = null;
        }
        if (wasConnected) {
            listener.onDisconnected(reason);
        }
    }

    public void disconnect() {
        close("Disconnected by app");
    }

    public void destroy() {
        close("Plugin destroyed");
        if (receiversRegistered) {
            try {
                context.unregisterReceiver(permissionReceiver);
                context.unregisterReceiver(attachDetachReceiver);
            } catch (IllegalArgumentException ignored) {
                // Already unregistered.
            }
            receiversRegistered = false;
        }
        ioExecutor.shutdown();
    }
}
