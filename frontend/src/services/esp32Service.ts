import { nativeFetch, getEsp32BaseUrl } from './nativeHttp';

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
  const base = getEsp32BaseUrl();
  const text = await nativeFetch(`${base}/${ENDPOINT}`, 3000, 'poll');
  return parseLooseJson(text);
}

export async function sendCommand(param: string, value: 0 | 1): Promise<MachineInfo> {
  const base = getEsp32BaseUrl();
  const text = await nativeFetch(`${base}/${ENDPOINT}?${param}=${value}`, 3000, 'command');
  return parseLooseJson(text);
}

export async function sendPrepareParams(params: Record<string, number>): Promise<MachineInfo> {
  const qs = Object.entries(params).map(([k, v]) => `${k}=${v}`).join('&');
  const base = getEsp32BaseUrl();
  const text = await nativeFetch(`${base}/${ENDPOINT}?${qs}`, 5000, 'command');
  return parseLooseJson(text);
}
