import { Capacitor, CapacitorHttp } from '@capacitor/core';
import { addLog } from './debugLog';
import { isUsbActive, markUsbFailed, sendLine } from './usbTransport';
import { useStore } from '../store/useStore';

/**
 * Drop-in fetch wrapper that uses the built-in CapacitorHttp on Android
 * (bypassing WebView CORS) and falls back to browser fetch in dev/PWA mode.
 *
 * Returns the raw response body as a string, matching the existing
 * esp32Service pattern of calling res.text().
 */
export async function nativeFetch(
  url: string,
  timeoutMs = 3000,
  logType: 'poll' | 'command' = 'poll',
): Promise<string> {
  console.log(`[HydroDebug][FETCH] → ${url}`);

  if (!Capacitor.isNativePlatform()) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
      if (!res.ok) {
        const err = `HTTP ${res.status}`;
        addLog({ type: logType, url, status: 'error', error: err });
        throw new Error(err);
      }
      const body = await res.text();
      addLog({ type: logType, url, status: 'ok', body });
      return body;
    } catch (e: unknown) {
      addLog({ type: logType, url, status: 'error', error: e instanceof Error ? e.message : String(e) });
      throw e;
    }
  }

  try {
    const response = await CapacitorHttp.request({
      method: 'GET',
      url,
      connectTimeout: timeoutMs,
      readTimeout: timeoutMs,
    });

    console.log(`[HydroDebug][FETCH] ← ${url} status=${response.status}`);

    if (response.status < 200 || response.status >= 300) {
      const err = `ESP32 responded with ${response.status}`;
      addLog({ type: logType, url, status: 'error', error: err });
      throw new Error(err);
    }

    // CapacitorHttp parses JSON automatically when Content-Type is application/json.
    // ESP32 returns loose JSON as plain text, so re-serialise if already parsed.
    const body =
      typeof response.data === 'string' ? response.data : JSON.stringify(response.data);

    addLog({ type: logType, url, status: 'ok', body });
    return body;
  } catch (e: unknown) {
    const errMsg = e instanceof Error ? e.message : String(e);
    console.error(`[HydroDebug][FETCH] ✗ ${url} — ${errMsg}`);
    addLog({ type: logType, url, status: 'error', error: errMsg });
    throw e;
  }
}

/**
 * Returns the base URL for the ESP32.
 *
 * On native: reads the IP the ESP32 POSTed to our registration server.
 * On web (dev or PWA): returns the configured VITE_ESP32_URL (mDNS / direct).
 */
export function getEsp32BaseUrl(): string {
  if (import.meta.env.VITE_NOHARDWARE === 'true') {
    return import.meta.env.VITE_ESP32_URL ?? 'http://advaithydro.local:8091';
  }
  if (Capacitor.isNativePlatform()) {
    const ip = localStorage.getItem('esp32_ip');
    if (!ip) throw new Error('ESP32 not registered yet. Waiting for device to connect.');
    return `http://${ip}:8091`;
  }
  return import.meta.env.VITE_ESP32_URL ?? 'http://advaithydro.local:8091';
}

export interface TransportResult {
  body: string;
  transport: 'usb' | 'wifi';
}

/**
 * Routes each ESP32 request to USB or WiFi/HTTP according to the user's Connection
 * Settings choice (Settings.tsx → ConnectionSettingsModal):
 *  - 'wired': USB only, hard override — no fallback to WiFi even if USB is unavailable.
 *  - 'wifi': WiFi/HTTP only, hard override — USB is never touched even if connected.
 *  - 'auto' (default): prefer USB when connected, fall back to WiFi/HTTP on any USB
 *    failure/timeout (which also marks USB as failed so later calls stop trying it
 *    until a fresh connect event).
 * `buildHttpUrl` is a thunk so the WiFi URL — which throws if no ESP32 IP has been
 * registered yet — is only resolved when actually needed, not when USB is serving it.
 * Returns which transport actually served the request — callers that need to know for
 * sure (e.g. USB-only machine_id validation) can't reliably infer this after the fact
 * from isUsbActive(), since 'auto' mode can fall back to WiFi mid-call.
 */
export async function transportSend(
  buildHttpUrl: () => string,
  usbQuery: string,
  timeoutMs: number,
  logType: 'poll' | 'command' = 'poll',
): Promise<TransportResult> {
  const connectionMode = useStore.getState().connectionMode;

  if (connectionMode === 'wired') {
    if (!isUsbActive()) throw new Error('USB not connected (Connection Settings is set to Wired)');
    return { body: await sendLine(usbQuery, timeoutMs, logType), transport: 'usb' };
  }

  if (connectionMode === 'wifi') {
    return { body: await nativeFetch(buildHttpUrl(), timeoutMs, logType), transport: 'wifi' };
  }

  if (isUsbActive()) {
    try {
      return { body: await sendLine(usbQuery, timeoutMs, logType), transport: 'usb' };
    } catch (e: unknown) {
      markUsbFailed(e instanceof Error ? e.message : String(e));
    }
  }
  return { body: await nativeFetch(buildHttpUrl(), timeoutMs, logType), transport: 'wifi' };
}
