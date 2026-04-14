import { Capacitor, CapacitorHttp } from '@capacitor/core';

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
): Promise<string> {
  if (!Capacitor.isNativePlatform()) {
    const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.text();
  }

  const response = await CapacitorHttp.request({
    method: 'GET',
    url,
    connectTimeout: timeoutMs,
    readTimeout: timeoutMs,
  });

  if (response.status < 200 || response.status >= 300) {
    throw new Error(`ESP32 responded with ${response.status}`);
  }

  // CapacitorHttp parses JSON automatically when Content-Type is application/json.
  // ESP32 returns loose JSON as plain text, so re-serialise if already parsed.
  if (typeof response.data === 'string') {
    return response.data;
  }
  return JSON.stringify(response.data);
}

/**
 * Returns the base URL for the ESP32.
 *
 * On native: reads the IP the ESP32 POSTed to our registration server.
 * On web (dev or PWA): returns the configured VITE_ESP32_URL (mDNS / direct).
 */
export function getEsp32BaseUrl(): string {
  if (Capacitor.isNativePlatform()) {
    const ip = localStorage.getItem('esp32_ip');
    if (!ip) throw new Error('ESP32 not registered yet. Waiting for device to connect.');
    return `http://${ip}:8091`;
  }
  return import.meta.env.VITE_ESP32_URL ?? 'http://advaithydro.local:8091';
}
