package com.advaitsolutions.hydrocolon;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "EspServer")
public class EspServerPlugin extends Plugin {
    private static final int PORT = 8765;
    private EspHttpServer server;

    @PluginMethod
    public void startServer(PluginCall call) {
        try {
            if (server == null) {
                server = new EspHttpServer(PORT, this);
            }
            JSObject result = new JSObject();
            result.put("port", PORT);
            call.resolve(result);
        } catch (Exception e) {
            call.reject("Failed to start server: " + e.getMessage());
        }
    }

    @PluginMethod
    public void stopServer(PluginCall call) {
        if (server != null) {
            server.stop();
            server = null;
        }
        call.resolve();
    }

    /** Called from EspHttpServer when ESP32 POSTs its IP */
    public void notifyEspRegistered(JSObject data) {
        notifyListeners("espRegistered", data);
    }
}
