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

const sectionHeaderStyle: React.CSSProperties = {
  fontSize: '0.72rem',
  fontWeight: 700,
  color: '#888',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  marginBottom: '0.5rem',
  marginTop: '1rem',
  paddingBottom: '0.4rem',
  borderBottom: '2px solid #f0f0f0',
};

interface Settings {
  maxTemp: number | null;
  defaultTemp: number | null;
  autoFlush: boolean;
  flushDuration: number | null;
  flushFrequency: number | null;
  blowerAuto: boolean;
  blowerMode: 'continuous' | 'interval' | null;
  blowerInterval: number | null;
  blowerDuration: number | null;
}

const MachineInfoModal: React.FC<Props> = ({ isOpen, onClose }) => {
  const { machineId, machineConnected, machineInfo } = useStore();
  const [settings, setSettings] = useState<Settings>({
    maxTemp: null, defaultTemp: null,
    autoFlush: false, flushDuration: null, flushFrequency: null,
    blowerAuto: false, blowerMode: null, blowerInterval: null, blowerDuration: null,
  });

  useEffect(() => {
    if (!isOpen || !machineId) return;
    localDB.settings.get(machineId).then((s) => {
      if (!s) return;
      setSettings({
        maxTemp: s.max_temperature ?? null,
        defaultTemp: s.default_temperature ?? null,
        autoFlush: s.auto_flush ?? false,
        flushDuration: s.flush_duration ?? null,
        flushFrequency: s.flush_frequency ?? null,
        blowerAuto: s.blower_auto ?? false,
        blowerMode: s.blower_frequency_mode ?? null,
        blowerInterval: s.blower_interval ?? null,
        blowerDuration: s.blower_duration ?? null,
      });
    });
  }, [isOpen, machineId]);

  const hwControls = [
    { label: 'Heater',         key: 'heater'        as const },
    { label: 'Pump',           key: 'pump'          as const },
    { label: 'Blower',         key: 'blower'        as const },
    { label: 'Water In Valve', key: 'water_in_valve' as const },
    { label: 'Flush Valve',    key: 'flush_valve'   as const },
  ];

  const dot = (active: boolean) => (
    <div style={{
      width: '34px', height: '20px', borderRadius: '10px',
      backgroundColor: active ? '#2dd36f' : '#ccc',
      position: 'relative', flexShrink: 0,
    }}>
      <div style={{
        position: 'absolute', top: '3px',
        left: active ? '17px' : '3px',
        width: '14px', height: '14px', borderRadius: '50%',
        backgroundColor: 'white', transition: 'left 0.15s',
        boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
      }} />
    </div>
  );

  return (
    <IonModal isOpen={isOpen} onDidDismiss={onClose} style={{ '--width': '680px', '--height': '520px', '--border-radius': '12px' } as React.CSSProperties}>
      <IonHeader>
        <IonToolbar color="primary">
          <IonTitle>Machine Information</IonTitle>
          <IonButton slot="end" fill="clear" color="light" onClick={onClose}>Close</IonButton>
        </IonToolbar>
      </IonHeader>
      <IonContent className="ion-padding">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>

          {/* ── Column 1: System State ── */}
          <div>
            <p style={{ ...sectionHeaderStyle, marginTop: 0 }}>System State</p>
            <div style={rowStyle}>
              <span style={labelStyle}>Connection</span>
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
              <span style={valueStyle}>{settings.defaultTemp !== null ? `${settings.defaultTemp} °C` : '—'}</span>
            </div>
            <div style={rowStyle}>
              <span style={labelStyle}>Temp Threshold</span>
              <span style={valueStyle}>{settings.maxTemp !== null ? `${settings.maxTemp} °C` : '—'}</span>
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

          {/* ── Column 2: Hardware + Settings ── */}
          <div>
            <p style={{ ...sectionHeaderStyle, marginTop: 0 }}>Hardware Controls</p>
            {hwControls.map(({ label, key }) => {
              const active = machineInfo ? machineInfo[key] === 1 : false;
              return (
                <div key={key} style={{ ...rowStyle, cursor: 'default' }}>
                  <span style={{ ...labelStyle, color: active ? '#1a7a45' : '#555' }}>{label}</span>
                  {dot(active)}
                </div>
              );
            })}

            <p style={sectionHeaderStyle}>Flush Settings</p>
            <div style={rowStyle}>
              <span style={labelStyle}>Auto Flush</span>
              {dot(settings.autoFlush)}
            </div>
            <div style={rowStyle}>
              <span style={labelStyle}>Flush Frequency</span>
              <span style={valueStyle}>{settings.flushFrequency !== null ? `${settings.flushFrequency} sec` : '—'}</span>
            </div>
            <div style={{ ...rowStyle }}>
              <span style={labelStyle}>Flush Duration</span>
              <span style={valueStyle}>{settings.flushDuration !== null ? `${settings.flushDuration} sec` : '—'}</span>
            </div>

            <p style={sectionHeaderStyle}>Blower Settings</p>
            <div style={rowStyle}>
              <span style={labelStyle}>Blower Auto</span>
              {dot(settings.blowerAuto)}
            </div>
            <div style={rowStyle}>
              <span style={labelStyle}>Blower Mode</span>
              <span style={valueStyle}>{settings.blowerMode ? settings.blowerMode.charAt(0).toUpperCase() + settings.blowerMode.slice(1) : '—'}</span>
            </div>
            {settings.blowerMode === 'interval' && (
              <>
                <div style={rowStyle}>
                  <span style={labelStyle}>Blower Interval</span>
                  <span style={valueStyle}>{settings.blowerInterval !== null ? `${settings.blowerInterval} sec` : '—'}</span>
                </div>
                <div style={{ ...rowStyle, borderBottom: 'none' }}>
                  <span style={labelStyle}>Blower Duration</span>
                  <span style={valueStyle}>{settings.blowerDuration !== null ? `${settings.blowerDuration} sec` : '—'}</span>
                </div>
              </>
            )}
          </div>

        </div>
      </IonContent>
    </IonModal>
  );
};

export default MachineInfoModal;
