import React, { useEffect, useRef, useState } from 'react';
import {
  IonContent, IonHeader, IonPage, IonTitle, IonToolbar, IonButton, IonIcon,
  IonList, IonItem, IonLabel, IonNote, IonLoading, IonSegment, IonSegmentButton, IonToggle,
  useIonAlert, useIonToast,
} from '@ionic/react';
import { arrowBack, documentTextOutline, archiveOutline, cloudUploadOutline, folderOpenOutline } from 'ionicons/icons';
import { useHistory } from 'react-router';
import { useStore } from '../store/useStore';
import { localDB } from '../db/localDB';
import {
  exportToExcel, exportToBackupZip, importFromBackupZip, peekBackupManifest,
  pickBackupFolder, isBackupFolderAccessible,
  type ImportMode, type MachineMismatchAction,
} from '../services/backupService';

const rowStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: '0.75rem 1rem',
  borderBottom: '1px solid #f5f5f5',
  fontSize: '0.95rem',
};

const labelStyle: React.CSSProperties = { color: '#333', fontWeight: 500 };

const inputStyle: React.CSSProperties = {
  width: '70px', padding: '0.3rem 0.5rem', border: '1px solid #ccc',
  borderRadius: '6px', fontSize: '0.9rem', textAlign: 'right', outline: 'none',
};

const DEFAULT_RETENTION = 5;

const DataExportImport: React.FC = () => {
  const history = useHistory();
  const { machineId } = useStore();
  const [presentAlert] = useIonAlert();
  const [presentToast] = useIonToast();
  const [busy, setBusy] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [tab, setTab] = useState<'backups' | 'settings'>('backups');
  const [autoBackupEnabled, setAutoBackupEnabled] = useState(false);
  const [retentionInput, setRetentionInput] = useState(String(DEFAULT_RETENTION));
  const [backupFolderName, setBackupFolderName] = useState<string | null>(null);
  const [backupFolderAccessible, setBackupFolderAccessible] = useState(true);

  useEffect(() => {
    if (!machineId) return;
    localDB.settings.get(machineId).then((s) => {
      setAutoBackupEnabled(s?.auto_backup_enabled ?? false);
      setRetentionInput(String(s?.auto_backup_retention_count ?? DEFAULT_RETENTION));
      setBackupFolderName(s?.backup_folder_name ?? null);
      if (s?.backup_folder_uri) {
        isBackupFolderAccessible(s.backup_folder_uri).then(setBackupFolderAccessible);
      }
    });
  }, [machineId]);

  const handleChooseBackupFolder = async () => {
    try {
      const result = await pickBackupFolder(machineId);
      setBackupFolderName(result.name);
      setBackupFolderAccessible(true);
      presentToast({ message: `Backup folder set to "${result.name}".`, duration: 2500, color: 'success' });
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Failed to choose backup folder.');
    }
  };

  const showError = (message: string) => {
    presentAlert({ header: 'Error', message, buttons: ['OK'] });
  };

  const handleAutoBackupToggle = async (checked: boolean) => {
    setAutoBackupEnabled(checked);
    const existing = await localDB.settings.get(machineId);
    await localDB.settings.put({ ...existing, machine_id: machineId, auto_backup_enabled: checked });
  };

  const handleRetentionBlur = async () => {
    const parsed = parseInt(retentionInput, 10);
    const value = !isNaN(parsed) && parsed >= 1 ? parsed : DEFAULT_RETENTION;
    setRetentionInput(String(value));
    const existing = await localDB.settings.get(machineId);
    await localDB.settings.put({ ...existing, machine_id: machineId, auto_backup_retention_count: value });
  };

  const handleExportExcel = async () => {
    setBusy('Generating Excel report...');
    try {
      await exportToExcel(machineId);
      presentToast({ message: 'Excel report ready to save/share.', duration: 2500, color: 'success' });
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Failed to export Excel report.');
    } finally {
      setBusy(null);
    }
  };

  const handleExportBackup = async () => {
    setBusy('Creating backup file...');
    try {
      await exportToBackupZip(machineId);
      presentToast({ message: 'Backup file ready to save/share.', duration: 2500, color: 'success' });
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Failed to create backup file.');
    } finally {
      setBusy(null);
    }
  };

  const handlePickImportFile = () => {
    fileInputRef.current?.click();
  };

  const runImport = async (file: File, mode: ImportMode, mismatchAction?: MachineMismatchAction) => {
    setBusy('Importing backup...');
    try {
      const result = await importFromBackupZip(file, mode, machineId, mismatchAction);
      const summary = Object.entries(result.counts)
        .map(([table, count]) => `${table}: ${count}`)
        .join(', ');
      presentToast({ message: `Import complete (${summary}).`, duration: 3500, color: 'success' });
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Failed to import backup file.');
    } finally {
      setBusy(null);
    }
  };

  const promptImportMode = (file: File, mismatchAction?: MachineMismatchAction) => {
    presentAlert({
      header: 'Import Backup',
      message: 'Overwrite replaces all existing local data with the backup. Merge keeps existing records and adds/updates from the backup.',
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        { text: 'Merge', handler: () => runImport(file, 'merge', mismatchAction) },
        { text: 'Overwrite', role: 'destructive', handler: () => runImport(file, 'overwrite', mismatchAction) },
      ],
    });
  };

  // Presenting a new IonAlert synchronously from inside another alert's button handler
  // races that alert's dismiss animation and can silently fail to show. Deferring to the
  // next tick (after the first alert has closed) lets the second alert present reliably.
  const promptImportModeDeferred = (file: File, mismatchAction?: MachineMismatchAction) => {
    setTimeout(() => promptImportMode(file, mismatchAction), 300);
  };

  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setBusy('Reading backup file...');
    let manifest;
    try {
      manifest = await peekBackupManifest(file);
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
          { text: 'Discard Mismatched Records', handler: () => promptImportModeDeferred(file, 'discard') },
          { text: 'Reassign to This Machine', handler: () => promptImportModeDeferred(file, 'reassign') },
        ],
      });
    } else {
      promptImportMode(file);
    }
  };

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar color="primary">
          <IonTitle>Data Export / Import</IonTitle>
          <IonButton slot="end" color="primary" onClick={() => history.goBack()}>
            <IonIcon icon={arrowBack} />
          </IonButton>
        </IonToolbar>
      </IonHeader>
      <IonContent className="ion-padding">
        <IonSegment value={tab} onIonChange={(e) => setTab(e.detail.value as 'backups' | 'settings')} style={{ marginBottom: '1rem' }}>
          <IonSegmentButton value="backups">
            <IonLabel>Backups</IonLabel>
          </IonSegmentButton>
          <IonSegmentButton value="settings">
            <IonLabel>Settings</IonLabel>
          </IonSegmentButton>
        </IonSegment>

        {tab === 'backups' ? (
          <>
            <IonList inset>
              <IonItem button onClick={handleExportExcel} detail={false}>
                <IonIcon icon={documentTextOutline} slot="start" />
                <IonLabel>
                  <h2>Export to Excel</h2>
                  <p>Human-readable report of all data. Not used for restoring.</p>
                </IonLabel>
              </IonItem>

              <IonItem button onClick={handleExportBackup} detail={false}>
                <IonIcon icon={archiveOutline} slot="start" />
                <IonLabel>
                  <h2>Export Backup (.zip)</h2>
                  <p>Compressed backup that can be imported later or on another tablet.</p>
                </IonLabel>
              </IonItem>

              <IonItem button onClick={handlePickImportFile} detail={false}>
                <IonIcon icon={cloudUploadOutline} slot="start" />
                <IonLabel>
                  <h2>Import Backup</h2>
                  <p>Restore data from a previously exported .zip backup file.</p>
                </IonLabel>
              </IonItem>

              <IonItem button onClick={() => history.push('/saved-backups')} detail={false}>
                <IonIcon icon={folderOpenOutline} slot="start" />
                <IonLabel>
                  <h2>View Saved Backups</h2>
                  <p>Browse, restore, or delete backups previously saved on this tablet.</p>
                </IonLabel>
              </IonItem>
            </IonList>
            <IonNote className="ion-padding-start">
              Use the share sheet to save exported files to Downloads, Drive, email, etc.
            </IonNote>
          </>
        ) : (
          <div style={{ backgroundColor: 'white', borderRadius: '10px', border: '1px solid #e0e0e0', overflow: 'hidden' }}>
            <div style={rowStyle}>
              <div>
                <div style={labelStyle}>Auto Backup</div>
                <div style={{ fontSize: '0.78rem', color: '#888', marginTop: '0.15rem' }}>
                  Automatically save a backup after each therapy session and after reminder changes.
                </div>
              </div>
              <IonToggle
                checked={autoBackupEnabled}
                onIonChange={(e) => handleAutoBackupToggle(e.detail.checked)}
              />
            </div>
            <div style={rowStyle}>
              <div>
                <div style={labelStyle}>Number of old backups to keep</div>
                <div style={{ fontSize: '0.78rem', color: '#888', marginTop: '0.15rem' }}>
                  Older auto-backups beyond this count are deleted automatically.
                </div>
              </div>
              <input
                type="number" min={1}
                value={retentionInput}
                onChange={(e) => setRetentionInput(e.target.value)}
                onBlur={handleRetentionBlur}
                disabled={!autoBackupEnabled}
                style={{ ...inputStyle, opacity: autoBackupEnabled ? 1 : 0.5 }}
              />
            </div>
            <div style={{ ...rowStyle, borderBottom: 'none', alignItems: 'flex-start' }}>
              <div>
                <div style={labelStyle}>Backup Folder</div>
                <div style={{ fontSize: '0.78rem', color: '#888', marginTop: '0.15rem' }}>
                  Chosen folder survives an app uninstall, unlike the app's private storage.
                </div>
                <div style={{ fontSize: '0.85rem', color: backupFolderName ? '#333' : '#aaa', marginTop: '0.35rem' }}>
                  {backupFolderName ? `Current: ${backupFolderName}` : 'Not set'}
                </div>
                {backupFolderName && !backupFolderAccessible && (
                  <div style={{ fontSize: '0.78rem', color: '#c0392b', marginTop: '0.25rem' }}>
                    This folder is no longer accessible. Please choose it again.
                  </div>
                )}
              </div>
              <IonButton size="small" fill="outline" onClick={handleChooseBackupFolder}>
                {backupFolderName ? 'Change' : 'Choose Folder'}
              </IonButton>
            </div>
          </div>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept=".zip,application/zip"
          style={{ display: 'none' }}
          onChange={handleFileSelected}
        />

        <IonLoading isOpen={busy !== null} message={busy ?? ''} />
      </IonContent>
    </IonPage>
  );
};

export default DataExportImport;
