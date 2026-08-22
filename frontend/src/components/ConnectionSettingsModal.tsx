import React from 'react';
import { IonModal, IonHeader, IonToolbar, IonTitle, IonButton, IonContent } from '@ionic/react';
import { useStore } from '../store/useStore';
import { localDB } from '../db/localDB';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

type ConnectionMode = 'auto' | 'wired' | 'wifi';

const OPTIONS: { mode: ConnectionMode; label: string; description: string }[] = [
  {
    mode: 'auto',
    label: 'Auto',
    description: 'Prefer the USB-C cable when connected, and automatically fall back to WiFi if it becomes unavailable.',
  },
  {
    mode: 'wired',
    label: 'Wired (USB-C)',
    description: 'Only use the USB-C cable. If it is disconnected or fails, the machine will show as disconnected — it will not fall back to WiFi.',
  },
  {
    mode: 'wifi',
    label: 'WiFi',
    description: 'Only use the WiFi hotspot connection. The USB-C cable is ignored even if it is plugged in.',
  },
];

const optionStyle = (active: boolean): React.CSSProperties => ({
  display: 'flex',
  flexDirection: 'column',
  gap: '0.3rem',
  padding: '0.75rem 1rem',
  marginBottom: '0.6rem',
  borderRadius: '10px',
  border: `1px solid ${active ? '#2dd36f' : '#ddd'}`,
  backgroundColor: active ? '#e8faf0' : '#fafafa',
  cursor: 'pointer',
});

const ConnectionSettingsModal: React.FC<Props> = ({ isOpen, onClose }) => {
  const { machineId, connectionMode, setConnectionMode } = useStore();

  const selectMode = async (mode: ConnectionMode) => {
    setConnectionMode(mode);
    const existing = await localDB.settings.get(machineId);
    await localDB.settings.put({ ...existing, machine_id: machineId, connection_mode: mode });
  };

  return (
    <IonModal isOpen={isOpen} onDidDismiss={onClose} style={{ '--width': '460px', '--height': '440px', '--border-radius': '12px' } as React.CSSProperties}>
      <IonHeader>
        <IonToolbar color="primary">
          <IonTitle>Connection Settings</IonTitle>
          <IonButton slot="end" fill="clear" color="light" onClick={onClose}>Close</IonButton>
        </IonToolbar>
      </IonHeader>
      <IonContent className="ion-padding">
        <p style={{ fontSize: '0.85rem', color: '#666', marginTop: 0 }}>
          Choose how this tablet should connect to the Colonima machine.
        </p>
        {OPTIONS.map(({ mode, label, description }) => (
          <div key={mode} style={optionStyle(connectionMode === mode)} onClick={() => selectMode(mode)}>
            <span style={{ fontWeight: 700, color: connectionMode === mode ? '#1a7a45' : '#333', fontSize: '0.95rem' }}>
              {label}
            </span>
            <span style={{ fontSize: '0.8rem', color: '#666' }}>{description}</span>
          </div>
        ))}
      </IonContent>
    </IonModal>
  );
};

export default ConnectionSettingsModal;
