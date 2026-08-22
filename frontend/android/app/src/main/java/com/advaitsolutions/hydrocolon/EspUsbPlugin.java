package com.advaitsolutions.hydrocolon;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "EspUsb")
public class EspUsbPlugin extends Plugin implements EspUsbManager.Listener {
    private EspUsbManager manager;

    @Override
    public void load() {
        manager = new EspUsbManager(getContext(), this);
    }

    @PluginMethod
    public void isAvailable(PluginCall call) {
        try {
            JSObject result = new JSObject();
            result.put("available", manager.isAvailable());
            call.resolve(result);
        } catch (Exception e) {
            call.reject("Failed to check USB availability: " + e.getMessage());
        }
    }

    @PluginMethod
    public void connect(PluginCall call) {
        try {
            manager.connect();
            call.resolve();
        } catch (Exception e) {
            // Never let a native USB error crash the app — worst case, USB stays
            // unavailable and the app keeps using WiFi.
            call.reject("Failed to connect to USB device: " + e.getMessage());
        }
    }

    @PluginMethod
    public void disconnect(PluginCall call) {
        try {
            manager.disconnect();
            call.resolve();
        } catch (Exception e) {
            call.reject("Failed to disconnect USB device: " + e.getMessage());
        }
    }

    @PluginMethod
    public void writeLine(PluginCall call) {
        String data = call.getString("data");
        if (data == null) {
            call.reject("Missing 'data' parameter");
            return;
        }
        try {
            manager.writeLine(data);
            call.resolve();
        } catch (Exception e) {
            call.reject("Failed to write to USB serial port: " + e.getMessage());
        }
    }

    @Override
    public void onAttached(int vendorId, int productId) {
        JSObject event = new JSObject();
        event.put("vendorId", vendorId);
        event.put("productId", productId);
        notifyListeners("usbDeviceAttached", event);
    }

    @Override
    public void onConnected() {
        notifyListeners("usbConnected", new JSObject());
    }

    @Override
    public void onDisconnected(String reason) {
        JSObject event = new JSObject();
        event.put("reason", reason != null ? reason : "");
        notifyListeners("usbDisconnected", event);
    }

    @Override
    public void onLineReceived(String line) {
        JSObject event = new JSObject();
        event.put("line", line);
        notifyListeners("usbDataReceived", event);
    }

    @Override
    protected void handleOnDestroy() {
        manager.destroy();
        super.handleOnDestroy();
    }
}
