/**
 * In-memory circular debug log — keeps the last MAX_ENTRIES events.
 * Written by nativeHttp, esp32Service, and the EspServer registration listener.
 * Read by the Settings debug panel.
 */

export type LogInput =
  | { type: 'registration'; ip: string; serial: string }
  | { type: 'poll'; url: string; status: 'ok' | 'error'; body?: string; error?: string }
  | { type: 'command'; url: string; status: 'ok' | 'error'; body?: string; error?: string }
  | { type: 'info'; message: string };

export type LogEntry = LogInput & { ts: number };

const MAX_ENTRIES = 30;
const log: LogEntry[] = [];

export function addLog(entry: LogInput): void {
  const full: LogEntry = { ...entry, ts: Date.now() };
  log.unshift(full); // newest first
  if (log.length > MAX_ENTRIES) log.length = MAX_ENTRIES;
  // Also emit to native console so adb logcat picks it up
  const tag = `[HydroDebug][${entry.type.toUpperCase()}]`;
  if (entry.type === 'registration') {
    console.log(`${tag} ESP32 registered ip=${entry.ip} serial=${entry.serial}`);
  } else if (entry.type === 'poll' || entry.type === 'command') {
    if (entry.status === 'ok') {
      console.log(`${tag} ${entry.url} → ${entry.body?.slice(0, 120)}`);
    } else {
      console.error(`${tag} ${entry.url} FAILED: ${entry.error}`);
    }
  } else if (entry.type === 'info') {
    console.log(`${tag} ${entry.message}`);
  }
}

export function getLog(): readonly LogEntry[] {
  return log;
}

export function clearLog(): void {
  log.length = 0;
}

/** Convenience: format a timestamp as HH:MM:SS */
export function fmtTime(ts: number): string {
  return new Date(ts).toLocaleTimeString();
}
