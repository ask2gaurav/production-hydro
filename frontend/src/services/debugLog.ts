/**
 * In-memory circular debug log — keeps the last MAX_ENTRIES events.
 * Written by nativeHttp, esp32Service, and the EspServer registration listener.
 * Read by the Settings debug panel.
 *
 * When VITE_DEBUG=true (native only), every entry is also appended to a daily log
 * file in the public Documents folder, so ESP32 traffic/timeouts can be inspected
 * after the fact without an attached debugger.
 */

import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';

export type LogInput =
  | { type: 'registration'; ip: string; serial: string }
  | { type: 'poll'; url: string; status: 'ok' | 'error'; body?: string; error?: string }
  | { type: 'command'; url: string; status: 'ok' | 'error'; body?: string; error?: string }
  | { type: 'info'; message: string };

export type LogEntry = LogInput & { ts: number };

const MAX_ENTRIES = 30;
const log: LogEntry[] = [];

function debugLogFileName(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `hydrotherapy-debug-${yyyy}-${mm}-${dd}.log`;
}

async function appendToDebugLogFile(entry: LogEntry, line: string): Promise<void> {
  try {
    await Filesystem.appendFile({
      path: debugLogFileName(),
      data: `${new Date(entry.ts).toISOString()} ${line}\n`,
      directory: Directory.Documents,
      encoding: Encoding.UTF8,
    });
  } catch {
    // Best-effort — debug logging must never break the app.
  }
}

export function addLog(entry: LogInput): void {
  const full: LogEntry = { ...entry, ts: Date.now() };
  log.unshift(full); // newest first
  if (log.length > MAX_ENTRIES) log.length = MAX_ENTRIES;
  // Also emit to native console so adb logcat picks it up
  const tag = `[HydroDebug][${entry.type.toUpperCase()}]`;
  let line = '';
  if (entry.type === 'registration') {
    line = `${tag} ESP32 registered ip=${entry.ip} serial=${entry.serial}`;
    console.log(line);
  } else if (entry.type === 'poll' || entry.type === 'command') {
    if (entry.status === 'ok') {
      line = `${tag} ${entry.url} → ${entry.body}`;
      console.log(line);
    } else {
      line = `${tag} ${entry.url} FAILED: ${entry.error}`;
      console.error(line);
    }
  } else if (entry.type === 'info') {
    line = `${tag} ${entry.message}`;
    console.log(line);
  }

  if (import.meta.env.VITE_DEBUG === 'true' && Capacitor.isNativePlatform()) {
    void appendToDebugLogFile(full, line);
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
