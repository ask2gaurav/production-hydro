import React, { useRef, useState } from 'react';
import {
  IonContent, IonHeader, IonPage, IonTitle, IonToolbar, IonButton, IonIcon,
  IonList, IonItem, IonLabel, IonNote, IonLoading, useIonAlert, useIonToast,
} from '@ionic/react';
import { arrowBack, documentTextOutline, archiveOutline, cloudUploadOutline, folderOpenOutline } from 'ionicons/icons';
import { useHistory } from 'react-router';
import { useStore } from '../store/useStore';
import {
  exportToExcel, exportToBackupZip, importFromBackupZip, peekBackupManifest,
  type ImportMode, type MachineMismatchAction,
} from '../services/backupService';

const DataExportImport: React.FC = () => {
  const history = useHistory();
  const { machineId } = useStore();
  const [presentAlert] = useIonAlert();
  const [presentToast] = useIonToast();
  const [busy, setBusy] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const showError = (message: string) => {
    presentAlert({ header: 'Error', message, buttons: ['OK'] });
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

  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    let manifest;
    try {
      manifest = await peekBackupManifest(file);
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Failed to read backup file.');
      return;
    }

    if (manifest.machine_id !== machineId) {
      presentAlert({
        header: 'Different Machine Backup',
        message: `This backup was exported from a different machine (ID: ${manifest.machine_id}). How would you like to handle the mismatched records?`,
        buttons: [
          { text: 'Cancel', role: 'cancel' },
          { text: 'Discard Mismatched Records', handler: () => promptImportMode(file, 'discard') },
          { text: 'Reassign to This Machine', handler: () => promptImportMode(file, 'reassign') },
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
