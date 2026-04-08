import React, { useEffect, useState } from 'react';
import { IonModal, IonHeader, IonToolbar, IonTitle, IonButton, IonContent } from '@ionic/react';
import { useStore } from '../store/useStore';
import { localDB } from '../db/localDB';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

const rowStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: '0.6rem 0',
  borderBottom: '1px solid #f0f0f0',
  fontSize: '0.9rem',
};

const labelStyle: React.CSSProperties = { color: '#555', fontWeight: 500 };
const valueStyle: React.CSSProperties = { fontWeight: 600, color: '#222' };

const MachineInfoModal: React.FC<Props> = ({ isOpen, onClose }) => {
  const { machineId, machineConnected, machineInfo } = useStore();
  const [maxTemp, setMaxTemp] = useState<number | null>(null);
  const [defaultTemp, setDefaultTemp] = useState<number | null>(null);

  useEffect(() => {
    if (!isOpen || !machineId) return;
    localDB.settings.get(machineId).then((s) => {
      if (s) {
        setMaxTemp(s.max_temperature ?? null);
        setDefaultTemp(s.default_temperature ?? null);
      }
    });
  }, [isOpen, machineId]);

  return (
    <IonModal isOpen={isOpen} onDidDismiss={onClose} style={{ '--width': '360px', '--height': '420px', '--border-radius': '12px' } as React.CSSProperties}>
      <IonHeader>
        <IonToolbar color="primary">
          <IonTitle>Machine Information</IonTitle>
          <IonButton slot="end" fill="clear" color="light" onClick={onClose}>Close</IonButton>
        </IonToolbar>
      </IonHeader>
      <IonContent className="ion-padding">
        <div style={{ paddingBottom: '1rem' }}>
          <div style={rowStyle}>
            <span style={labelStyle}>System State</span>
            <span style={{ ...valueStyle, color: machineConnected ? '#2dd36f' : '#d32f2f' }}>
              {machineConnected ? 'Connected' : 'Disconnected'}
            </span>
          </div>
          <div style={rowStyle}>
            <span style={labelStyle}>Error</span>
            <span style={{ ...valueStyle, color: '#2dd36f' }}>No Error</span>
          </div>
          <div style={rowStyle}>
            <span style={labelStyle}>Temperature</span>
            <span style={valueStyle}>{machineInfo ? `${machineInfo.temp} °C` : '—'}</span>
          </div>
          <div style={rowStyle}>
            <span style={labelStyle}>Therapy Temperature</span>
            <span style={valueStyle}>{defaultTemp !== null ? `${defaultTemp} °C` : '—'}</span>
          </div>
          <div style={rowStyle}>
            <span style={labelStyle}>Temp Threshold</span>
            <span style={valueStyle}>{maxTemp !== null ? `${maxTemp} °C` : '—'}</span>
          </div>
          <div style={rowStyle}>
            <span style={labelStyle}>Therapy Mode</span>
            <span style={valueStyle}>—</span>
          </div>
          <div style={rowStyle}>
            <span style={labelStyle}>Water Low Level</span>
            <span style={{ ...valueStyle, color: machineInfo?.water_ll ? '#2dd36f' : '#aaa' }}>
              {machineInfo ? (machineInfo.water_ll ? 'True' : 'False') : '—'}
            </span>
          </div>
          <div style={{ ...rowStyle, borderBottom: 'none' }}>
            <span style={labelStyle}>Water High Level</span>
            <span style={{ ...valueStyle, color: machineInfo?.water_hl ? '#2dd36f' : '#aaa' }}>
              {machineInfo ? (machineInfo.water_hl ? 'True' : 'False') : '—'}
            </span>
          </div>
        </div>
      </IonContent>
    </IonModal>
  );
};

export default MachineInfoModal;
