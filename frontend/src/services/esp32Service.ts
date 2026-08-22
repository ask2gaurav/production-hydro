import { getEsp32BaseUrl, transportSend } from './nativeHttp';
import { useStore } from '../store/useStore';

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
  sessionP: number;
  hes: number;
  machine_id?: string;
}

// The ESP32 returns non-standard JSON like {temp:24,water_ll:0,water_hl:0}
// so we quote unquoted keys before parsing.
function parseLooseJson(text: string): MachineInfo {
  const normalized = text.replace(/([{,]\s*)(\w+)\s*:/g, '$1"$2":');
  return JSON.parse(normalized);
}

// Over USB, an empty query string has no path/endpoint to distinguish it, so a
// plain poll is sent as an explicit no-op param the firmware can ignore.
const USB_POLL_QUERY = 'poll=1';

// Over USB (no WiFi-hotspot SSID/password gate), any board could be plugged into this
// tablet — validate the ESP32's reported machine_id against the machine this login is
// associated with. On mismatch, throw so the caller's normal poll-failure/disconnect
// handling applies; the store flag drives the explanatory modal (App.tsx).
function checkMachineId(info: MachineInfo, transport: 'usb' | 'wifi'): void {
  if (transport !== 'usb') {
    useStore.getState().setMachineIdMismatch(null);
    return;
  }
  const expected = useStore.getState().modeStatus?.serial_number;
  const actual = info.machine_id;
  if (!actual) {
    useStore.getState().setMachineIdMismatch({ expected, actual: ' ' });
    throw new Error(`Machine ID missing from ESP32 response`);
  }else  if (expected && actual && actual !== expected) {
    useStore.getState().setMachineIdMismatch({ expected, actual });
    throw new Error(`Machine ID mismatch: expected ${expected}, got ${actual}`);
  }
  useStore.getState().setMachineIdMismatch(null);
}

export async function fetchMachineInfo(): Promise<MachineInfo> {
  const { body, transport } = await transportSend(
    () => `${getEsp32BaseUrl()}/${ENDPOINT}`,
    USB_POLL_QUERY,
    3000,
    'poll',
  );
  const info = parseLooseJson(body);
  checkMachineId(info, transport);
  return info;
}

export async function sendCommand(param: string, value: 0 | 1): Promise<MachineInfo> {
  const query = `${param}=${value}`;
  const { body, transport } = await transportSend(
    () => `${getEsp32BaseUrl()}/${ENDPOINT}?${query}`,
    query,
    3000,
    'command',
  );
  const info = parseLooseJson(body);
  checkMachineId(info, transport);
  return info;
}

export async function sendPrepareParams(params: Record<string, number>): Promise<MachineInfo> {
  const qs = Object.entries(params).map(([k, v]) => `${k}=${v}`).join('&');
  const { body, transport } = await transportSend(
    () => `${getEsp32BaseUrl()}/${ENDPOINT}?${qs}`,
    qs,
    5000,
    'command',
  );
  const info = parseLooseJson(body);
  checkMachineId(info, transport);
  return info;
}
