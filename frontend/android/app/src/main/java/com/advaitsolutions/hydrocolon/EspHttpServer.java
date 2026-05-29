package com.advaitsolutions.hydrocolon;

import android.util.Log;
import com.getcapacitor.JSObject;
import fi.iki.elonen.NanoHTTPD;
import java.io.IOException;
import java.util.HashMap;
import java.util.Map;

public class EspHttpServer extends NanoHTTPD {
    private static final String TAG = "EspHttpServer";
    private final EspServerPlugin plugin;

    public EspHttpServer(int port, EspServerPlugin plugin) throws IOException {
        super(port);
        this.plugin = plugin;
        start(NanoHTTPD.SOCKET_READ_TIMEOUT, false);
        Log.d(TAG, "ESP HTTP server started on port " + port);
    }

    @Override
    public Response serve(IHTTPSession session) {
        // Add CORS headers so ESP32 firmware that sets Origin header still works
        if (session.getMethod() == Method.POST && "/register".equals(session.getUri())) {
            try {
                Map<String, String> body = new HashMap<>();
                session.parseBody(body);
                String json = body.get("postData");
                org.json.JSONObject obj = new org.json.JSONObject(json != null ? json : "{}");
                String ip = obj.optString("ip", "");
                String serial = obj.optString("serial", "");
                if (!ip.isEmpty()) {
                    JSObject event = new JSObject();
                    event.put("ip", ip);
                    event.put("serial", serial);
                    plugin.notifyEspRegistered(event);
                    Log.d(TAG, "ESP32 registered at " + ip + " serial=" + serial);
                }
                Response res = newFixedLengthResponse(Response.Status.OK, "application/json", "{\"status\":\"ok\"}");
                res.addHeader("Access-Control-Allow-Origin", "*");
                return res;
            } catch (Exception e) {
                Log.e(TAG, "Error parsing registration body", e);
                return newFixedLengthResponse(Response.Status.INTERNAL_ERROR, "text/plain", "error");
            }
        }
        // Handle preflight OPTIONS from ESP32 firmwares that send one
        if (session.getMethod() == Method.OPTIONS) {
            Response res = newFixedLengthResponse(Response.Status.OK, "text/plain", "");
            res.addHeader("Access-Control-Allow-Origin", "*");
            res.addHeader("Access-Control-Allow-Methods", "POST, GET, OPTIONS");
            res.addHeader("Access-Control-Allow-Headers", "Content-Type");
            return res;
        }
        return newFixedLengthResponse(Response.Status.NOT_FOUND, "text/plain", "not found");
    }
}
