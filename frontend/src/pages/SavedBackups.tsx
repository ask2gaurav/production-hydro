import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  IonContent, IonHeader, IonPage, IonTitle, IonToolbar, IonButton, IonIcon,
  IonNote, IonLoading, useIonAlert, useIonToast,
} from '@ionic/react';
import {
  arrowBack, refreshOutline, trashOutline, cloudUploadOutline,
  chevronBackOutline, chevronForwardOutline, eyeOutline, shareSocialOutline, downloadOutline,
} from 'ionicons/icons';
import { useHistory } from 'react-router';
import { useStore } from '../store/useStore';
import {
  listLocalBackups, deleteLocalBackup, restoreFromLocalBackup, viewLocalFile, shareLocalFile,
  copyLocalFileToDownloads, peekLocalBackupManifest,
  type ImportMode, type LocalBackupFile, type MachineMismatchAction,
} from '../services/backupService';

const PAGE_SIZE = 20;

const thStyle: React.CSSProperties = {
  padding: '0.6rem 0.75rem', textAlign: 'left', fontWeight: 600,
  color: '#555', whiteSpace: 'nowrap', fontSize: '0.8rem',
  backgroundColor: '#f4f5f8', borderBottom: '2px solid #ddd',
};

const tdStyle: React.CSSProperties = {
  padding: '0.6rem 0.75rem', fontSize: '0.82rem',
  verticalAlign: 'middle', borderBottom: '1px solid #eee',
};

const sectionHeaderStyle: React.CSSProperties = {
  margin: '1.5rem 0 0.75rem', fontSize: '0.95rem', color: '#333',
  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
};

const formatBytes = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const formatDateTime = (iso: string): string => {
  return new Date(iso).toLocaleString('en-IN', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
};

interface BackupTableProps {
  title: string;
  items: LocalBackupFile[];
  showRestore: boolean;
  showView: boolean;
  onRestore?: (backup: LocalBackupFile) => void;
  onView?: (backup: LocalBackupFile) => void;
  onShare: (backup: LocalBackupFile) => void;
  onDownload: (backup: LocalBackupFile) => void;
  onDelete: (backup: LocalBackupFile) => void;
}

const BackupTable: React.FC<BackupTableProps> = ({ title, items, showRestore, showView, onRestore, onView, onShare, onDownload, onDelete }) => {
  const [page, setPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(items.length / PAGE_SIZE));
  const clampedPage = Math.min(page, totalPages);
  const pageItems = items.slice((clampedPage - 1) * PAGE_SIZE, clampedPage * PAGE_SIZE);

  useEffect(() => { setPage(1); }, [items.length]);

  return (
    <div>
      <div style={sectionHeaderStyle}>
        <span>{title} ({items.length})</span>
      </div>

      <div style={{ overflowX: 'auto', border: '1px solid #e0e0e0', borderRadius: '10px' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={thStyle}>Name</th>
              <th style={thStyle}>Date</th>
              <th style={thStyle}>Size</th>
              <th style={thStyle}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {pageItems.length === 0 && (
              <tr>
                <td colSpan={4} style={{ ...tdStyle, textAlign: 'center', color: '#999', padding: '2rem' }}>
                  No files yet.
                </td>
              </tr>
            )}
            {pageItems.map((backup) => (
              <tr key={backup.name}>
                <td style={{ ...tdStyle, wordBreak: 'break-all' }}>{backup.name}</td>
                <td style={{ ...tdStyle, whiteSpace: 'nowrap' }}>{formatDateTime(backup.modifiedAt)}</td>
                <td style={{ ...tdStyle, whiteSpace: 'nowrap' }}>{formatBytes(backup.size)}</td>
                <td style={{ ...tdStyle, whiteSpace: 'nowrap' }}>
                  {showView && (
                    <IonIcon
                      icon={eyeOutline}
                      title="View"
                      style={{ color: '#0a5c99', cursor: 'pointer', fontSize: '1.2rem', marginRight: '0.75rem' }}
                      onClick={() => onView?.(backup)}
                    />
                  )}
                  {showRestore && (
                    <IonIcon
                      icon={cloudUploadOutline}
                      title="Restore"
                      style={{ color: '#0a5c99', cursor: 'pointer', fontSize: '1.2rem', marginRight: '0.75rem' }}
                      onClick={() => onRestore?.(backup)}
                    />
                  )}
                  <IonIcon
                    icon={shareSocialOutline}
                    title="Share"
                    style={{ color: '#0a5c99', cursor: 'pointer', fontSize: '1.2rem', marginRight: '0.75rem' }}
                    onClick={() => onShare(backup)}
                  />
                  <IonIcon
                    icon={downloadOutline}
                    title="Copy to Downloads"
                    style={{ color: '#0a5c99', cursor: 'pointer', fontSize: '1.2rem', marginRight: '0.75rem' }}
                    onClick={() => onDownload(backup)}
                  />
                  <IonIcon
                    icon={trashOutline}
                    title="Delete"
                    style={{ color: '#eb445a', cursor: 'pointer', fontSize: '1.2rem' }}
                    onClick={() => onDelete(backup)}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {items.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
          <IonIcon
            icon={chevronBackOutline}
            style={{ cursor: clampedPage <= 1 ? 'default' : 'pointer', opacity: clampedPage <= 1 ? 0.35 : 1, fontSize: '1.1rem' }}
            onClick={() => clampedPage > 1 && setPage(clampedPage - 1)}
          />
          <span style={{ fontSize: '0.82rem', color: '#555' }}>Page {clampedPage} of {totalPages}</span>
          <IonIcon
            icon={chevronForwardOutline}
            style={{ cursor: clampedPage >= totalPages ? 'default' : 'pointer', opacity: clampedPage >= totalPages ? 0.35 : 1, fontSize: '1.1rem' }}
            onClick={() => clampedPage < totalPages && setPage(clampedPage + 1)}
          />
        </div>
      )}
    </div>
  );
};

const SavedBackups: React.FC = () => {
  const history = useHistory();
  const { machineId } = useStore();
  const [presentAlert] = useIonAlert();
  const [presentToast] = useIonToast();
  const [busy, setBusy] = useState<string | null>(null);
  const [backups, setBackups] = useState<LocalBackupFile[]>([]);

  const showError = (message: string) => {
    presentAlert({ header: 'Error', message, buttons: ['OK'] });
  };

  const refreshBackups = useCallback(async () => {
    try {
      const list = await listLocalBackups();
      setBackups(list);
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Failed to load saved backups.');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { refreshBackups(); }, [refreshBackups]);

  const zipBackups = useMemo(() => backups.filter((b) => b.type === 'zip'), [backups]);
  const excelBackups = useMemo(() => backups.filter((b) => b.type === 'excel'), [backups]);

  const runRestoreLocal = async (name: string, mode: ImportMode, mismatchAction?: MachineMismatchAction) => {
    setBusy('Restoring backup...');
    try {
      const result = await restoreFromLocalBackup(name, mode, machineId, mismatchAction);
      const summary = Object.entries(result.counts)
        .map(([table, count]) => `${table}: ${count}`)
        .join(', ');
      presentToast({ message: `Restore complete (${summary}).`, duration: 3500, color: 'success' });
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Failed to restore backup.');
    } finally {
      setBusy(null);
      await refreshBackups();
    }
  };

  const promptRestoreMode = (backup: LocalBackupFile, mismatchAction?: MachineMismatchAction) => {
    presentAlert({
      header: 'Restore Backup',
      message: `Restore "${backup.name}"? Overwrite replaces all existing local data with the backup. Merge keeps existing records and adds/updates from the backup.`,
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        { text: 'Merge', handler: () => runRestoreLocal(backup.name, 'merge', mismatchAction) },
        { text: 'Overwrite', role: 'destructive', handler: () => runRestoreLocal(backup.name, 'overwrite', mismatchAction) },
      ],
    });
  };

  // Presenting a new IonAlert synchronously from inside another alert's button handler
  // races that alert's dismiss animation and can silently fail to show. Deferring to the
  // next tick (after the first alert has closed) lets the second alert present reliably.
  const promptRestoreModeDeferred = (backup: LocalBackupFile, mismatchAction?: MachineMismatchAction) => {
    setTimeout(() => promptRestoreMode(backup, mismatchAction), 300);
  };

  const handleRestoreLocal = async (backup: LocalBackupFile) => {
    setBusy('Reading backup file...');
    let manifest;
    try {
      manifest = await peekLocalBackupManifest(backup.name);
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Failed to read backup file.');
      return;
    } finally {
      setBusy(null);
    }

    if (manifest.machine_id !== machineId) {
      presentAlert({
        header: 'Different Machine Backup',
        message: `This backup was exported from a different machine (ID: ${manifest.machine_id}). How would you like to handle the mismatched records?`,
        buttons: [
          { text: 'Cancel', role: 'cancel' },
          { text: 'Discard Mismatched Records', handler: () => promptRestoreModeDeferred(backup, 'discard') },
          { text: 'Reassign to This Machine', handler: () => promptRestoreModeDeferred(backup, 'reassign') },
        ],
      });
    } else {
      promptRestoreMode(backup);
    }
  };

  const handleViewLocal = async (backup: LocalBackupFile) => {
    try {
      await viewLocalFile(backup.name);
    } catch (err) {
      const message = err instanceof Error ? err.message : '';
      if (/activity not found/i.test(message)) {
        showError('No app installed on this device can open Excel files. Install an app such as Google Sheets, Microsoft Excel, or WPS Office, or use Share instead to send the file to another device/app.');
      } else {
        showError(message || 'Failed to open file.');
      }
    }
  };

  const handleShareLocal = async (backup: LocalBackupFile) => {
    try {
      await shareLocalFile(backup.name);
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Failed to share file.');
    }
  };

  const handleDownloadLocal = async (backup: LocalBackupFile) => {
    try {
      await copyLocalFileToDownloads(backup.name);
      presentToast({ message: `"${backup.name}" copied to Downloads.`, duration: 2500, color: 'success' });
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Failed to copy file to Downloads.');
    }
  };

  const handleDeleteLocal = (backup: LocalBackupFile) => {
    presentAlert({
      header: 'Delete Backup',
      message: `Delete "${backup.name}"? This cannot be undone.`,
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Delete', role: 'destructive', handler: async () => {
            setBusy('Deleting backup...');
            try {
              await deleteLocalBackup(backup.name);
              presentToast({ message: 'Backup deleted.', duration: 2000, color: 'success' });
            } catch (err) {
              showError(err instanceof Error ? err.message : 'Failed to delete backup.');
            } finally {
              setBusy(null);
              await refreshBackups();
            }
          },
        },
      ],
    });
  };

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar color="primary">
          <IonTitle>Saved Backups</IonTitle>
          <IonButton slot="end" fill="clear" color="light" onClick={refreshBackups}>
            <IonIcon icon={refreshOutline} />
          </IonButton>
          <IonButton slot="end" color="primary" onClick={() => history.goBack()}>
            <IonIcon icon={arrowBack} />
          </IonButton>
        </IonToolbar>
      </IonHeader>
      <IonContent className="ion-padding">
        <IonNote>
          Backups saved to this tablet from the Data Export / Import page. Zip backups can be restored directly from here.
        </IonNote>

        <BackupTable
          title="Zip Backups"
          items={zipBackups}
          showRestore
          showView={false}
          onRestore={handleRestoreLocal}
          onShare={handleShareLocal}
          onDownload={handleDownloadLocal}
          onDelete={handleDeleteLocal}
        />

        <BackupTable
          title="Excel Exports"
          items={excelBackups}
          showRestore={false}
          showView
          onView={handleViewLocal}
          onShare={handleShareLocal}
          onDownload={handleDownloadLocal}
          onDelete={handleDeleteLocal}
        />

        <IonLoading isOpen={busy !== null} message={busy ?? ''} />
      </IonContent>
    </IonPage>
  );
};

export default SavedBackups;
