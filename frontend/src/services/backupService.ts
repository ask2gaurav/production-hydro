import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { FileOpener } from '@capacitor-community/file-opener';
import JSZip from 'jszip';
import * as XLSX from 'xlsx';
import { localDB } from '../db/localDB';

const BACKUP_SCHEMA_VERSION = 1;
const BACKUPS_DIR = 'backups';

const MIME_TYPES: Record<string, string> = {
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  zip: 'application/zip',
};

function mimeTypeFor(name: string): string {
  const ext = name.split('.').pop()?.toLowerCase() ?? '';
  return MIME_TYPES[ext] ?? 'application/octet-stream';
}

const TABLE_NAMES = ['sessions', 'therapists', 'patients', 'settings', 'reminder_logs'] as const;
type TableName = typeof TABLE_NAMES[number];

const EXPORT_TABLE_NAMES = TABLE_NAMES;

export interface BackupManifest {
  schema_version: number;
  exported_at: string;
  machine_id: string;
}

export type MachineMismatchAction = 'discard' | 'reassign';

interface BackupPayload {
  manifest: BackupManifest;
  data: Record<TableName, unknown[]>;
}

export type ImportMode = 'overwrite' | 'merge';

export interface ImportResult {
  counts: Record<TableName, number>;
}

export interface LocalBackupFile {
  name: string;
  type: 'excel' | 'zip';
  size: number;
  modifiedAt: string;
}

function timestamp(): string {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

async function writeAndShare(fileName: string, base64Data: string) {
  const written = await Filesystem.writeFile({
    path: `${BACKUPS_DIR}/${fileName}`,
    data: base64Data,
    directory: Directory.Data,
    recursive: true,
  });

  try {
    await Filesystem.writeFile({
      path: fileName,
      data: base64Data,
      directory: Directory.Documents,
      recursive: true,
    });
  } catch {
    // Non-fatal — the file is still safely stored under Directory.Data and can be
    // copied to Documents later from the Saved Backups page.
  }

  await Share.share({
    title: fileName,
    url: written.uri,
    dialogTitle: 'Save or share backup file',
  });

  return written.uri;
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

export async function exportToExcel(machineId: string): Promise<string> {
  const workbook = XLSX.utils.book_new();

  for (const table of EXPORT_TABLE_NAMES) {
    const dexieTable = localDB[table] as unknown as { toArray: () => Promise<unknown[]> };
    const rows = await dexieTable.toArray();
    const sheet = XLSX.utils.json_to_sheet(rows as Record<string, unknown>[]);
    XLSX.utils.book_append_sheet(workbook, sheet, table);
  }

  const arrayBuffer = XLSX.write(workbook, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;
  const base64 = arrayBufferToBase64(arrayBuffer);
  const fileName = `hydrotherapy-export-${machineId}-${timestamp()}.xlsx`;

  return writeAndShare(fileName, base64);
}

export async function exportToBackupZip(machineId: string): Promise<string> {
  const data = {} as Record<TableName, unknown[]>;
  for (const table of EXPORT_TABLE_NAMES) {
    const dexieTable = localDB[table] as unknown as { toArray: () => Promise<unknown[]> };
    data[table] = await dexieTable.toArray();
  }

  const payload: BackupPayload = {
    manifest: {
      schema_version: BACKUP_SCHEMA_VERSION,
      exported_at: new Date().toISOString(),
      machine_id: machineId,
    },
    data,
  };

  const zip = new JSZip();
  zip.file('manifest.json', JSON.stringify(payload.manifest, null, 2));
  for (const table of EXPORT_TABLE_NAMES) {
    zip.file(`${table}.json`, JSON.stringify(payload.data[table], null, 2));
  }

  const base64 = await zip.generateAsync({ type: 'base64' });
  const fileName = `hydrotherapy-backup-${machineId}-${timestamp()}.zip`;

  return writeAndShare(fileName, base64);
}

export async function listLocalBackups(): Promise<LocalBackupFile[]> {
  try {
    const res = await Filesystem.readdir({ path: BACKUPS_DIR, directory: Directory.Data });
    const files = await Promise.all(res.files.map(async (f) => {
      const stat = await Filesystem.stat({ path: `${BACKUPS_DIR}/${f.name}`, directory: Directory.Data });
      return {
        name: f.name,
        type: f.name.toLowerCase().endsWith('.zip') ? 'zip' as const : 'excel' as const,
        size: stat.size,
        modifiedAt: new Date(stat.mtime).toISOString(),
      };
    }));
    files.sort((a, b) => b.modifiedAt.localeCompare(a.modifiedAt));
    return files;
  } catch {
    // Backups folder doesn't exist yet (nothing exported so far).
    return [];
  }
}

export async function deleteLocalBackup(name: string): Promise<void> {
  await Filesystem.deleteFile({ path: `${BACKUPS_DIR}/${name}`, directory: Directory.Data });
}

export async function viewLocalFile(name: string): Promise<void> {
  const { uri } = await Filesystem.getUri({ path: `${BACKUPS_DIR}/${name}`, directory: Directory.Data });
  await FileOpener.open({ filePath: uri, contentType: mimeTypeFor(name), openWithDefault: true });
}

export async function shareLocalFile(name: string): Promise<void> {
  const { uri } = await Filesystem.getUri({ path: `${BACKUPS_DIR}/${name}`, directory: Directory.Data });
  await Share.share({
    title: name,
    url: uri,
    dialogTitle: 'Save or share backup file',
  });
}

// Capacitor's Filesystem plugin has no dedicated "Downloads" directory constant; Directory.Documents
// is the closest available public, cross-app-visible location on Android without extra native work.
export async function copyLocalFileToDownloads(name: string): Promise<void> {
  const read = await Filesystem.readFile({ path: `${BACKUPS_DIR}/${name}`, directory: Directory.Data });
  await Filesystem.writeFile({
    path: name,
    data: read.data,
    directory: Directory.Documents,
    recursive: true,
  });
}

async function readManifest(zip: JSZip): Promise<BackupManifest> {
  const manifestEntry = zip.file('manifest.json');
  if (!manifestEntry) {
    throw new Error('Not a valid backup file: manifest.json is missing.');
  }
  const manifest: BackupManifest = JSON.parse(await manifestEntry.async('string'));
  if (manifest.schema_version > BACKUP_SCHEMA_VERSION) {
    throw new Error(`Backup was created by a newer app version (schema v${manifest.schema_version}) and cannot be imported.`);
  }
  return manifest;
}

export async function peekBackupManifest(file: File): Promise<BackupManifest> {
  const zip = await JSZip.loadAsync(file);
  return readManifest(zip);
}

export async function peekLocalBackupManifest(name: string): Promise<BackupManifest> {
  const read = await Filesystem.readFile({ path: `${BACKUPS_DIR}/${name}`, directory: Directory.Data });
  const zip = await JSZip.loadAsync(read.data as string, { base64: true });
  return readManifest(zip);
}

async function restoreFromZip(
  zip: JSZip,
  mode: ImportMode,
  currentMachineId: string,
  mismatchAction?: MachineMismatchAction
): Promise<ImportResult> {
  const manifest = await readManifest(zip);
  const mismatched = manifest.machine_id !== currentMachineId;

  const data = {} as Record<TableName, unknown[]>;
  for (const table of TABLE_NAMES) {
    const entry = zip.file(`${table}.json`);
    let rows: Array<Record<string, unknown>> = entry ? JSON.parse(await entry.async('string')) : [];

    if (mismatched && mismatchAction === 'discard') {
      rows = rows.filter((r) => r.machine_id === currentMachineId);
    } else if (mismatched && mismatchAction === 'reassign') {
      rows = rows.map((r) => ({ ...r, machine_id: currentMachineId }));
    }

    data[table] = rows;
  }

  const counts: Record<TableName, number> = { sessions: 0, therapists: 0, patients: 0, settings: 0, reminder_logs: 0 };

  await localDB.transaction('rw', localDB.tables, async () => {
    for (const table of TABLE_NAMES) {
      const rows = data[table];
      const dexieTable = localDB[table] as unknown as { clear: () => Promise<void>; bulkPut: (items: unknown[]) => Promise<unknown> };
      if (mode === 'overwrite') {
        await dexieTable.clear();
      }
      await dexieTable.bulkPut(rows);
      counts[table] = rows.length;
    }
  });

  return { counts };
}

export async function importFromBackupZip(
  file: File,
  mode: ImportMode,
  currentMachineId: string,
  mismatchAction?: MachineMismatchAction
): Promise<ImportResult> {
  const zip = await JSZip.loadAsync(file);
  return restoreFromZip(zip, mode, currentMachineId, mismatchAction);
}

export async function restoreFromLocalBackup(
  name: string,
  mode: ImportMode,
  currentMachineId: string,
  mismatchAction?: MachineMismatchAction
): Promise<ImportResult> {
  const read = await Filesystem.readFile({ path: `${BACKUPS_DIR}/${name}`, directory: Directory.Data });
  const zip = await JSZip.loadAsync(read.data as string, { base64: true });
  return restoreFromZip(zip, mode, currentMachineId, mismatchAction);
}
