// In development Vite proxies /esp32/* → ESP32 device (avoids CORS).
// In production the PWA runs on the same local network as the ESP32 and
// calls it directly, so we use the configured URL.
const BASE = import.meta.env.DEV
  ? import.meta.env.VITE_ESP32_URL
  : (import.meta.env.VITE_ESP32_URL ?? 'http://advaithydro.local:5500');

const ENDPOINT = import.meta.env.VITE_ESP32_ENDPOINT ?? 'machineinfo.html';

export interface MachineInfo {
  temp: number;
  water_ll: number;
  water_hl: number;
  heater: number;
  pump: number;
  blower: number;
  water_in_valve: number;
  flush_valve: number;
}

// The ESP32 returns non-standard JSON like {temp:24,water_ll:0,water_hl:0}
// so we quote unquoted keys before parsing.
function parseLooseJson(text: string): MachineInfo {
  const normalized = text.replace(/([{,]\s*)(\w+)\s*:/g, '$1"$2":');
  return JSON.parse(normalized);
}

export async function fetchMachineInfo(): Promise<MachineInfo> {
  const res = await fetch(`${BASE}/${ENDPOINT}`, { signal: AbortSignal.timeout(3000) });
  if (!res.ok) throw new Error(`ESP32 responded with ${res.status}`);
  const text = await res.text();
  const jsonResp = parseLooseJson(text);
  // jsonResp['temp'] = jsonResp['temperature'];
  // jsonResp['water_ll'] = jsonResp['water_level_low'];
  // jsonResp['water_hl'] = jsonResp['water_level_high'];
  // jsonResp['water_in_valve'] = !Number(jsonResp['water_in_s1']);
  // jsonResp['pump'] = !Number(jsonResp['water_pump_out']);
  // jsonResp['flush_valve'] = !Number(jsonResp['flush']);
  // jsonResp['blower'] = !Number(jsonResp['blower']);
  // jsonResp['heater'] = !Number(jsonResp['heater']);
  return jsonResp;
}

export async function sendCommand(param: string, value: 0 | 1): Promise<MachineInfo> {
  const res = await fetch(`${BASE}/${ENDPOINT}?${param}=${value}`, { signal: AbortSignal.timeout(3000) });
  if (!res.ok) throw new Error(`ESP32 responded with ${res.status}`);
  const text = await res.text();
  const jsonResp = parseLooseJson(text);
  // jsonResp['temp'] = jsonResp['temperature'];
  // jsonResp['water_ll'] = jsonResp['water_level_low'];
  // jsonResp['water_hl'] = jsonResp['water_level_high'];
  // jsonResp['water_in_valve'] = !Number(jsonResp['water_in_s1']);
  // jsonResp['pump'] = !Number(jsonResp['water_pump_out']);
  // jsonResp['flush_valve'] = !Number(jsonResp['flush']);
  // jsonResp['blower'] = !Number(jsonResp['blower']);
  // jsonResp['heater'] = !Number(jsonResp['heater']);
  return jsonResp;
}

export async function sendPrepareParams(params: Record<string, number>): Promise<MachineInfo> {
  const qs = Object.entries(params).map(([k, v]) => `${k}=${v}`).join('&');
  const res = await fetch(`${BASE}/${ENDPOINT}?${qs}`, { signal: AbortSignal.timeout(5000) });
  if (!res.ok) throw new Error(`ESP32 responded with ${res.status}`);
  const text = await res.text();
  const jsonResp = parseLooseJson(text);
  // jsonResp['temp'] = jsonResp['temperature'];
  // jsonResp['water_ll'] = jsonResp['water_level_low'];
  // jsonResp['water_hl'] = jsonResp['water_level_high'];
  // jsonResp['water_in_valve'] = !Number(jsonResp['water_in_s1']);
  // jsonResp['pump'] = !Number(jsonResp['water_pump_out']);
  // jsonResp['flush_valve'] = !Number(jsonResp['flush']);
  // jsonResp['blower'] = !Number(jsonResp['blower']);
  // jsonResp['heater'] = !Number(jsonResp['heater']);
  return jsonResp;
}
