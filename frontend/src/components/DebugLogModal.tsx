import React, { useEffect, useState } from 'react';
import {
  IonModal, IonHeader, IonToolbar, IonTitle, IonButton, IonContent, IonIcon, useIonAlert, useIonToast,
} from '@ionic/react';
import { eyeOutline, shareSocialOutline, downloadOutline, trashOutline, arrowBack } from 'ionicons/icons';
import {
  listDebugLogFiles, readDebugLogFile, shareDebugLogFile, downloadDebugLogFile, deleteDebugLogFile,
  type DebugLogFile,
} from '../services/debugLog';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

const rowStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: '0.6rem 0.75rem',
  borderBottom: '1px solid #f0f0f0',
  fontSize: '0.85rem',
};

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  return `${(bytes / 1024).toFixed(1)} KB`;
}

const DebugLogModal: React.FC<Props> = ({ isOpen, onClose }) => {
  const [presentAlert] = useIonAlert();
  const [presentToast] = useIonToast();
  const [files, setFiles] = useState<DebugLogFile[]>([]);
  const [viewing, setViewing] = useState<{ name: string; content: string } | null>(null);

  const refresh = () => {
    listDebugLogFiles().then(setFiles);
  };

  useEffect(() => {
    if (isOpen) {
      setViewing(null);
      refresh();
    }
  }, [isOpen]);

  const handleView = async (name: string) => {
    try {
      const content = await readDebugLogFile(name);
      setViewing({ name, content });
    } catch {
      presentToast({ message: 'Failed to read log file.', duration: 2500, color: 'danger' });
    }
  };

  const handleShare = async (name: string) => {
    try {
      await shareDebugLogFile(name);
    } catch {
      presentToast({ message: 'Failed to share log file.', duration: 2500, color: 'danger' });
    }
  };

  const handleDownload = async (name: string) => {
    try {
      await downloadDebugLogFile(name);
      presentToast({ message: 'Log file copied to Documents.', duration: 2500, color: 'success' });
    } catch {
      presentToast({ message: 'Failed to download log file.', duration: 2500, color: 'danger' });
    }
  };

  const handleDelete = (name: string) => {
    presentAlert({
      header: 'Delete Log File',
      message: `Delete "${name}"? This cannot be undone.`,
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Delete', role: 'destructive',
          handler: async () => {
            try {
              await deleteDebugLogFile(name);
              refresh();
            } catch {
              presentToast({ message: 'Failed to delete log file.', duration: 2500, color: 'danger' });
            }
          },
        },
      ],
    });
  };

  return (
    <IonModal isOpen={isOpen} onDidDismiss={onClose} style={{ '--width': '520px', '--height': '520px', '--border-radius': '12px' } as React.CSSProperties}>
      <IonHeader>
        <IonToolbar color="primary">
          {viewing ? (
            <IonButton slot="start" fill="clear" color="light" onClick={() => setViewing(null)}>
              <IonIcon icon={arrowBack} />
            </IonButton>
          ) : null}
          <IonTitle>{viewing ? viewing.name : 'Debug Logs'}</IonTitle>
          <IonButton slot="end" fill="clear" color="light" onClick={onClose}>Close</IonButton>
        </IonToolbar>
      </IonHeader>
      <IonContent className="ion-padding">
        {viewing ? (
          <pre style={{ fontSize: '0.72rem', whiteSpace: 'pre-wrap', wordBreak: 'break-all', margin: 0 }}>
            {viewing.content}
          </pre>
        ) : (
          <>
            {files.length === 0 && (
              <p style={{ color: '#999', textAlign: 'center', marginTop: '2rem' }}>No debug log files yet.</p>
            )}
            {files.map((f) => (
              <div key={f.name} style={rowStyle}>
                <div>
                  <div style={{ fontWeight: 600, color: '#333' }}>{f.name}</div>
                  <div style={{ fontSize: '0.75rem', color: '#999' }}>
                    {formatSize(f.size)} • {new Date(f.modifiedAt).toLocaleString()}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '0.75rem' }}>
                  <IonIcon icon={eyeOutline} title="View" style={{ color: '#0a5c99', cursor: 'pointer', fontSize: '1.2rem' }} onClick={() => handleView(f.name)} />
                  <IonIcon icon={shareSocialOutline} title="Share" style={{ color: '#0a5c99', cursor: 'pointer', fontSize: '1.2rem' }} onClick={() => handleShare(f.name)} />
                  <IonIcon icon={downloadOutline} title="Download" style={{ color: '#0a5c99', cursor: 'pointer', fontSize: '1.2rem' }} onClick={() => handleDownload(f.name)} />
                  <IonIcon icon={trashOutline} title="Delete" style={{ color: '#eb445a', cursor: 'pointer', fontSize: '1.2rem' }} onClick={() => handleDelete(f.name)} />
                </div>
              </div>
            ))}
          </>
        )}
      </IonContent>
    </IonModal>
  );
};

export default DebugLogModal;
