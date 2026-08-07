import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import JSZip from 'jszip';
import * as XLSX from 'xlsx';
import { localDB } from '../db/localDB';

const BACKUP_SCHEMA_VERSION = 1;

const TABLE_NAMES = ['sessions', 'therapists', 'patients', 'settings', 'resources'] as const;
type TableName = typeof TABLE_NAMES[number];

// Resources are excluded from exports (Excel and backup zip) but still supported on import
// so older backups that include a resources.json can still be restored.
const EXPORT_TABLE_NAMES = TABLE_NAMES.filter((t) => t !== 'resources');

interface BackupManifest {
  schema_version: number;
  exported_at: string;
  machine_id: string;
}

interface BackupPayload {
  manifest: BackupManifest;
  data: Record<TableName, unknown[]>;
}

export type ImportMode = 'overwrite' | 'merge';

export interface ImportResult {
  counts: Record<TableName, number>;
}

function timestamp(): string {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

async function writeAndShare(fileName: string, base64Data: string, mimeType: string) {
  const written = await Filesystem.writeFile({
    path: fileName,
    data: base64Data,
    directory: Directory.Cache,
  });

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

  return writeAndShare(fileName, base64, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
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

  return writeAndShare(fileName, base64, 'application/zip');
}

export async function importFromBackupZip(file: File, mode: ImportMode): Promise<ImportResult> {
  const zip = await JSZip.loadAsync(file);

  const manifestEntry = zip.file('manifest.json');
  if (!manifestEntry) {
    throw new Error('Not a valid backup file: manifest.json is missing.');
  }
  const manifest: BackupManifest = JSON.parse(await manifestEntry.async('string'));
  if (manifest.schema_version > BACKUP_SCHEMA_VERSION) {
    throw new Error(`Backup was created by a newer app version (schema v${manifest.schema_version}) and cannot be imported.`);
  }

  const data = {} as Record<TableName, unknown[]>;
  for (const table of TABLE_NAMES) {
    const entry = zip.file(`${table}.json`);
    data[table] = entry ? JSON.parse(await entry.async('string')) : [];
  }

  const counts: Record<TableName, number> = { sessions: 0, therapists: 0, patients: 0, settings: 0, resources: 0 };

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
