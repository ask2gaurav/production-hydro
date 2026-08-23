/**
 * In-memory circular debug log — keeps the last MAX_ENTRIES events.
 * Written by nativeHttp, esp32Service, and the EspServer registration listener.
 * Read by the Settings debug panel.
 *
 * When VITE_DEBUG=true (native only), every entry is also appended to a daily log
 * file under this app's private storage (Directory.Data — some tablets don't reliably
 * expose a public Documents folder), so ESP32 traffic/timeouts can be inspected after
 * the fact without an attached debugger. Since private storage isn't reachable via a
 * file manager, listDebugLogFiles/readDebugLogFile/etc. below back the in-app browser
 * (DebugLogModal) that lets an operator view/share/download/delete these files.
 */

import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';

export type LogInput =
  | { type: 'registration'; ip: string; serial: string }
  | { type: 'poll'; url: string; status: 'ok' | 'error'; body?: string; error?: string }
  | { type: 'command'; url: string; status: 'ok' | 'error'; body?: string; error?: string }
  | { type: 'info'; message: string };

export type LogEntry = LogInput & { ts: number };

export interface DebugLogFile {
  name: string;
  size: number;
  modifiedAt: string;
}

const MAX_ENTRIES = 30;
const log: LogEntry[] = [];

const DEBUG_LOGS_DIR = 'debug-logs';

function debugLogFileName(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `hydrotherapy-debug-${yyyy}-${mm}-${dd}.log`;
}

async function appendToDebugLogFile(entry: LogEntry, line: string): Promise<void> {
  try {
    try {
      await Filesystem.mkdir({ path: DEBUG_LOGS_DIR, directory: Directory.Data, recursive: true });
    } catch {
      // Already exists — appendFile has no recursive option, so this is required
      // the first time, then a harmless no-op on every call after.
    }
    await Filesystem.appendFile({
      path: `${DEBUG_LOGS_DIR}/${debugLogFileName()}`,
      data: `${new Date(entry.ts).toISOString()} ${line}\n`,
      directory: Directory.Data,
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

export async function listDebugLogFiles(): Promise<DebugLogFile[]> {
  try {
    const res = await Filesystem.readdir({ path: DEBUG_LOGS_DIR, directory: Directory.Data });
    const files = await Promise.all(res.files.map(async (f) => {
      const stat = await Filesystem.stat({ path: `${DEBUG_LOGS_DIR}/${f.name}`, directory: Directory.Data });
      return {
        name: f.name,
        size: stat.size,
        modifiedAt: new Date(stat.mtime).toISOString(),
      };
    }));
    files.sort((a, b) => b.modifiedAt.localeCompare(a.modifiedAt));
    return files;
  } catch {
    // Folder doesn't exist yet (nothing logged so far).
    return [];
  }
}

export async function readDebugLogFile(name: string): Promise<string> {
  const read = await Filesystem.readFile({
    path: `${DEBUG_LOGS_DIR}/${name}`,
    directory: Directory.Data,
    encoding: Encoding.UTF8,
  });
  return read.data as string;
}

export async function shareDebugLogFile(name: string): Promise<void> {
  const { uri } = await Filesystem.getUri({ path: `${DEBUG_LOGS_DIR}/${name}`, directory: Directory.Data });
  await Share.share({
    title: name,
    url: uri,
    dialogTitle: 'Share debug log file',
  });
}

export async function deleteDebugLogFile(name: string): Promise<void> {
  await Filesystem.deleteFile({ path: `${DEBUG_LOGS_DIR}/${name}`, directory: Directory.Data });
}

// Capacitor's Filesystem plugin has no dedicated "Downloads" directory constant; Directory.Documents
// is the closest available public, cross-app-visible location on Android without extra native work.
export async function downloadDebugLogFile(name: string): Promise<void> {
  const read = await Filesystem.readFile({ path: `${DEBUG_LOGS_DIR}/${name}`, directory: Directory.Data });
  await Filesystem.writeFile({
    path: name,
    data: read.data,
    directory: Directory.Documents,
    recursive: true,
  });
}
