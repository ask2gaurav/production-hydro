// In development Vite proxies /esp32/* → ESP32 device (avoids CORS).
// In production the PWA runs on the same local network as the ESP32 and
// calls it directly, so we use the configured URL.
const BASE = import.meta.env.DEV
  ? '/esp32'
  : (import.meta.env.VITE_ESP32_URL ?? 'http://localhost:5500');

export interface MachineInfo {
  temp: number;
  water_ll: number;
  water_hl: number;
}

// The ESP32 returns non-standard JSON like {temp:24,water_ll:0,water_hl:0}
// so we quote unquoted keys before parsing.
function parseLooseJson(text: string): MachineInfo {
  const normalized = text.replace(/([{,]\s*)(\w+)\s*:/g, '$1"$2":');
  return JSON.parse(normalized);
}

export async function fetchMachineInfo(): Promise<MachineInfo> {
  const res = await fetch(`${BASE}/machineinfo.html`, { signal: AbortSignal.timeout(3000) });
  if (!res.ok) throw new Error(`ESP32 responded with ${res.status}`);
  const text = await res.text();
  return parseLooseJson(text);
}

export async function sendCommand(param: string, value: 0 | 1): Promise<void> {
  await fetch(`${BASE}/command?${param}=${value}`, { signal: AbortSignal.timeout(3000) });
}
