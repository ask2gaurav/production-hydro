# Plan: Convert PWA to Capacitor Android App with ESP32 Push Registration

## Context

The app controls an ESP32 therapy machine over a mobile hotspot. mDNS (`advaithydro.local`) fails on Android because DNS resolves over mobile data, not the hotspot LAN. The fix is a **push registration model**: the Android device is always the hotspot gateway at `192.168.43.1`, so the ESP32 (once connected to the hotspot) can always find the app. The app runs a small embedded HTTP server; the ESP32 POSTs its own LAN IP to the app on startup. The app stores the IP and uses it for all subsequent ESP32 communication. All app assets are bundled into the APK — nothing loads from a remote server at runtime.

```
ESP32 connects to hotspot
  └─► POST http://192.168.43.1:8765/register  {"ip":"192.168.43.xxx"}
        └─► App stores IP in localStorage
              └─► App communicates with http://192.168.43.xxx:8091
```

---

## Phase 1 — Initialize Capacitor for Android

**Install packages:**
```bash
cd frontend
npm install @capacitor/android @capacitor/cli @capacitor-community/http
npx cap init "Dasatva Hydrotherapy" "com.advaitsolutions.hydrocolon" --web-dir dist
npx cap add android
```

**Create `frontend/capacitor.config.ts`:**
```typescript
import type { CapacitorConfig } from '@capacitor/cli';
const config: CapacitorConfig = {
  appId: 'com.advaitsolutions.hydrocolon',
  appName: 'Dasatva Hydrotherapy',
  webDir: 'dist',
  server: { androidScheme: 'https' },
};
export default config;
```

---

## Phase 2 — Android Network Security & Permissions

**Create `android/app/src/main/res/xml/network_security_config.xml`:**
```xml
<?xml version="1.0" encoding="utf-8"?>
<network-security-config>
  <domain-config cleartextTrafficPermitted="true">
    <domain includeSubdomains="true">192.168.43.0</domain>
    <domain includeSubdomains="true">192.168.1.0</domain>
    <domain includeSubdomains="true">192.168.0.0</domain>
  </domain-config>
</network-security-config>
```

**Add to `android/app/src/main/AndroidManifest.xml`** inside `<application>`:
```xml
android:networkSecurityConfig="@xml/network_security_config"
```

**Add permissions** inside `<manifest>`:
```xml
<uses-permission android:name="android.permission.INTERNET" />
<uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />
<uses-permission android:name="android.permission.ACCESS_WIFI_STATE" />
```

---

## Phase 3 — NanoHTTPD Dependency

**Add to `android/app/build.gradle`** in `dependencies {}`:
```groovy
implementation 'org.nanohttpd:nanohttpd:2.3.1'
```

---

## Phase 4 — Custom Capacitor Plugin: EspServerPlugin

This plugin starts/stops a NanoHTTPD server that listens for the ESP32's registration POST.

**Create `android/app/src/main/java/com/advaitsolutions/hydrocolon/EspHttpServer.java`:**
```java
package com.advaitsolutions.hydrocolon;

import android.util.Log;
import com.getcapacitor.JSObject;
import com.getcapacitor.PluginCall;
import fi.iki.elonen.NanoHTTPD;
import java.io.IOException;

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
        if (session.getMethod() == Method.POST && "/register".equals(session.getUri())) {
            try {
                java.util.Map<String, String> body = new java.util.HashMap<>();
                session.parseBody(body);
                String json = body.get("postData");
                org.json.JSONObject obj = new org.json.JSONObject(json != null ? json : "{}");
                String ip = obj.optString("ip", "");
                if (!ip.isEmpty()) {
                    JSObject event = new JSObject();
                    event.put("ip", ip);
                    plugin.notifyEspRegistered(event);
                    Log.d(TAG, "ESP32 registered at " + ip);
                }
                return newFixedLengthResponse(Response.Status.OK, "application/json", "{\"status\":\"ok\"}");
            } catch (Exception e) {
                Log.e(TAG, "Error parsing registration", e);
            }
        }
        return newFixedLengthResponse(Response.Status.NOT_FOUND, "text/plain", "not found");
    }
}
```

**Create `android/app/src/main/java/com/advaitsolutions/hydrocolon/EspServerPlugin.java`:**
```java
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
            call.resolve();
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

    public void notifyEspRegistered(JSObject data) {
        notifyListeners("espRegistered", data);
    }
}
```

**Register plugin in `android/app/src/main/java/com/advaitsolutions/hydrocolon/MainActivity.java`:**
```java
import com.getcapacitor.community.http.Http;
// add inside onCreate or registerPlugins:
registerPlugin(EspServerPlugin.class);
registerPlugin(Http.class);
```

---

## Phase 5 — TypeScript Plugin Bridge

**Create `frontend/src/plugins/espServer.ts`:**
```typescript
import { registerPlugin, Capacitor } from '@capacitor/core';

export interface EspServerPlugin {
  startServer(): Promise<void>;
  stopServer(): Promise<void>;
  addListener(
    event: 'espRegistered',
    handler: (data: { ip: string }) => void
  ): Promise<{ remove: () => void }>;
}

const EspServer = registerPlugin<EspServerPlugin>('EspServer', {
  web: {
    // No-op stubs for browser/dev mode
    startServer: async () => {},
    stopServer: async () => {},
    addListener: async (_e: string, _h: any) => ({ remove: () => {} }),
  },
});

export { EspServer };
```

---

## Phase 6 — Native HTTP Utility (outbound calls to ESP32)

**Create `frontend/src/services/nativeHttp.ts`:**
```typescript
import { Http } from '@capacitor-community/http';
import { Capacitor } from '@capacitor/core';

export async function nativeFetch(
  url: string,
  options: { params?: Record<string, string>; timeoutMs?: number } = {}
): Promise<string> {
  if (!Capacitor.isNativePlatform()) {
    // Browser/dev: use Vite proxy as before
    const u = new URL(url);
    if (options.params) {
      Object.entries(options.params).forEach(([k, v]) => u.searchParams.set(k, v));
    }
    const ctrl = new AbortController();
    const id = setTimeout(() => ctrl.abort(), options.timeoutMs ?? 3000);
    const res = await fetch(u.toString(), { signal: ctrl.signal });
    clearTimeout(id);
    return res.text();
  }
  const response = await Http.request({
    method: 'GET',
    url,
    params: options.params ?? {},
    connectTimeout: options.timeoutMs ?? 3000,
    readTimeout: options.timeoutMs ?? 3000,
  });
  return typeof response.data === 'string' ? response.data : JSON.stringify(response.data);
}
```

---

## Phase 7 — Update esp32Service.ts

**File:** `frontend/src/services/esp32Service.ts`

- Import `nativeFetch` from `./nativeHttp`
- Replace all `fetch(...)` calls with `nativeFetch(...)`
- Change base URL resolution: read `localStorage.getItem('esp32_ip')` on native; use the Vite proxy path on web
- No other logic changes needed

```typescript
// Add near top of esp32Service.ts
import { Capacitor } from '@capacitor/core';
import { nativeFetch } from './nativeHttp';

function getEsp32BaseUrl(): string {
  if (Capacitor.isNativePlatform()) {
    const ip = localStorage.getItem('esp32_ip');
    if (!ip) throw new Error('ESP32 IP not registered yet');
    return `http://${ip}:8091`;
  }
  return '/esp32'; // Vite proxy in dev
}
```

---

## Phase 8 — Start Server & Listen for Registration in App.tsx

**File:** `frontend/src/App.tsx`

Add a `useEffect` on app mount:
```typescript
import { EspServer } from './plugins/espServer';
import { Capacitor } from '@capacitor/core';

useEffect(() => {
  if (!Capacitor.isNativePlatform()) return;
  EspServer.startServer();
  const sub = EspServer.addListener('espRegistered', ({ ip }) => {
    localStorage.setItem('esp32_ip', ip);
    // optionally update Zustand store so UI reflects connected state
  });
  return () => { sub.then(s => s.remove()); EspServer.stopServer(); };
}, []);
```

---

## Phase 9 — Remove / Simplify useEsp32Discovery.ts

The subnet scanner is no longer the primary discovery mechanism. Either:
- **Remove it entirely** and rely on push registration
- **Keep it as a fallback** with a "Scan manually" button in DeviceScanner.tsx (update it to use `nativeFetch` probes if kept)

The `DeviceScanner.tsx` UI can be simplified to show:
- Connected status if `esp32_ip` is in localStorage
- "Waiting for ESP32 to connect..." if not
- Optional "Scan manually" fallback button

---

## Critical Files

| File | Action |
|------|--------|
| `frontend/capacitor.config.ts` | Create |
| `frontend/package.json` | Add `@capacitor/android`, `@capacitor/cli`, `@capacitor-community/http` |
| `frontend/src/plugins/espServer.ts` | Create — JS bridge for EspServerPlugin |
| `frontend/src/services/nativeHttp.ts` | Create — native HTTP wrapper |
| `frontend/src/services/esp32Service.ts` | Update — swap fetch → nativeFetch, dynamic base URL |
| `frontend/src/App.tsx` | Update — start HTTP server, listen for espRegistered event |
| `frontend/src/components/DeviceScanner.tsx` | Simplify — show push-registration status |
| `frontend/src/hooks/useEsp32Discovery.ts` | Remove or keep as manual fallback |
| `android/app/build.gradle` | Add NanoHTTPD dependency |
| `android/app/src/main/AndroidManifest.xml` | Add permissions + network security config ref |
| `android/app/src/main/res/xml/network_security_config.xml` | Create |
| `android/app/src/main/java/.../EspHttpServer.java` | Create — NanoHTTPD server |
| `android/app/src/main/java/.../EspServerPlugin.java` | Create — Capacitor plugin |
| `android/app/src/main/java/.../MainActivity.java` | Register both plugins |

---

## ESP32 Firmware Side (for reference)

The ESP32 needs one new startup routine (not in this repo but noted for completeness):
```cpp
// After WiFi connects to hotspot:
HTTPClient http;
http.begin("http://192.168.43.1:8765/register");
http.addHeader("Content-Type", "application/json");
String body = "{\"ip\":\"" + WiFi.localIP().toString() + "\"}";
http.POST(body);
http.end();
```

---

## Verification

1. Build APK: `npm run build && npx cap sync android && npx cap open android` → Generate APK
2. Install APK on Android device, enable hotspot
3. Power on ESP32 → it connects to hotspot → POSTs to `192.168.43.1:8765/register`
4. App receives event, stores IP — DeviceScanner shows "Connected"
5. Open Therapy page → sensor data loads via native HTTP (no CORS errors)
6. Send pump/heater commands → verify they reach ESP32
7. Kill and reopen app → stored IP reconnects immediately without re-registration
8. Confirm backend sync still works over mobile data
