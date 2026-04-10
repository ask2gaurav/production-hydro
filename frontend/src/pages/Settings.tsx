import React, { useState, useEffect } from 'react';
import {
  IonContent, IonHeader, IonPage, IonTitle, IonToolbar,
  IonButton, IonIcon, IonBadge, useIonAlert
} from '@ionic/react';
import { arrowBack, wifiOutline } from 'ionicons/icons';
import { localDB } from '../db/localDB';
import { useStore } from '../store/useStore';
import { useHistory } from 'react-router-dom';
import { sendCommand } from '../services/esp32Service';
import MachineInfoModal from '../components/MachineInfoModal';

const Settings: React.FC = () => {
  const [presentAlert] = useIonAlert();
  const { machineId, machineConnected, machineInfo, setMachineInfo } = useStore();
  const history = useHistory();
  const [showMachineInfo, setShowMachineInfo] = useState(false);

  const [settings, setSettings] = useState({
    default_session_minutes: 40,
    default_temperature: 37,
    max_temperature: 40,
    flush_frequency: 30,
    heater_switch: false,
    pump_switch: false,
    blower_switch: false,
    water_inlet_valve: false,
    flush_valve: false,
    auto_flush: false,
    flush_duration: 10,
    flush_mode: 'continuous' as 'continuous' | 'interval',
    blower_auto: false,
    blower_frequency_mode: 'continuous' as 'continuous' | 'interval',
    blower_interval: 30,
    blower_duration: 10,
  });

  useEffect(() => {
    localDB.settings.get(machineId).then((s) => {
      if (s) setSettings((prev) => ({ ...prev, ...s }));
    });
  }, [machineId]);

  const persistSettings = (updated: typeof settings) => {
    localDB.settings.get(machineId).then((existing) => {
      localDB.settings.put({ ...existing, machine_id: machineId, ...updated });
    });
  };

  const handleSetting = (key: keyof typeof settings, value: number | boolean | string) => {
    const updated = { ...settings, [key]: value };
    setSettings(updated);
    persistSettings(updated);
  };

  const handleHardwareToggle = async (param: string, value: boolean) => {
    if (!machineConnected) {
      presentAlert({
        header: 'Machine Disconnected',
        message: 'Cannot send command — machine is not connected.',
        buttons: ['OK'],
      });
      return;
    }
    try {
      const updated = await sendCommand(param, value ? 1 : 0);
      setMachineInfo(updated);
    } catch {
      presentAlert({ header: 'Command Failed', message: 'Could not reach the machine. Check the connection.', buttons: ['OK'] });
    }
  };

  const cardStyle: React.CSSProperties = {
    backgroundColor: 'white',
    borderRadius: '10px',
    padding: '1rem',
    border: '1px solid #e0e0e0',
    height: '100%',
  };

  const colHeaderStyle: React.CSSProperties = {
    fontSize: '0.78rem',
    fontWeight: 700,
    color: '#888',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    marginBottom: '0.75rem',
    paddingBottom: '0.5rem',
    borderBottom: '2px solid #f0f0f0',
  };

  const rowStyle: React.CSSProperties = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '0.55rem 0',
    borderBottom: '1px solid #f5f5f5',
    fontSize: '0.88rem',
  };

  const labelStyle: React.CSSProperties = { color: '#555', fontWeight: 500 };
  const valueStyle: React.CSSProperties = { fontWeight: 600, color: '#222' };

  const hwButtonStyle = (active: boolean): React.CSSProperties => ({
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '0.6rem 0.75rem',
    marginBottom: '0.5rem',
    borderRadius: '8px',
    border: `1px solid ${active ? '#2dd36f' : '#ddd'}`,
    backgroundColor: active ? '#e8faf0' : '#fafafa',
    cursor: 'pointer',
    fontSize: '0.88rem',
    fontWeight: 500,
    color: active ? '#1a7a45' : '#444',
    transition: 'all 0.15s ease',
  });

  const toggleDot = (active: boolean) => (
    <div style={{
      width: '38px', height: '22px', borderRadius: '11px',
      backgroundColor: active ? '#2dd36f' : '#ccc',
      position: 'relative', transition: 'background 0.2s',
      flexShrink: 0,
    }}>
      <div style={{
        position: 'absolute', top: '3px',
        left: active ? '19px' : '3px',
        width: '16px', height: '16px', borderRadius: '50%',
        backgroundColor: 'white', transition: 'left 0.2s',
        boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
      }} />
    </div>
  );

  const inputStyle: React.CSSProperties = {
    width: '70px', padding: '0.3rem 0.5rem', border: '1px solid #ccc',
    borderRadius: '6px', fontSize: '0.88rem', textAlign: 'right', outline: 'none',
  };

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar color="primary">
          <IonTitle>Machine Settings</IonTitle>
          <IonBadge
            slot="end"
            color={machineConnected ? 'success' : 'danger'}
            style={{ marginRight: '0.5rem', cursor: 'pointer' }}
            onClick={() => setShowMachineInfo(true)}
          >
            <IonIcon icon={wifiOutline} style={{ fontSize: '0.7rem', marginRight:'10px',display:'inline-block' }} />
            {machineConnected ? 'Machine Connected' : 'Machine Disconnected'}
          </IonBadge>
          <IonButton color="primary" slot="end" style={{ marginRight: '1rem' }} onClick={(e) => { (e.currentTarget as HTMLElement).blur(); history.goBack(); }}>
            <IonIcon icon={arrowBack} />
          </IonButton>
        </IonToolbar>
      </IonHeader>

      <IonContent className="ion-padding">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem', height: '100%' }}>

          {/* Column 1: System State */}
          <div style={cardStyle}>
            <p style={colHeaderStyle}>System State</p>

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
              <span style={labelStyle}>Temp Threshold</span>
              <span style={valueStyle}>{settings.max_temperature} °C</span>
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
            <div style={rowStyle}>
              <span style={labelStyle}>Water High Level</span>
              <span style={{ ...valueStyle, color: machineInfo?.water_hl ? '#2dd36f' : '#aaa' }}>
                {machineInfo ? (machineInfo.water_hl ? 'True' : 'False') : '—'}
              </span>
            </div>
          </div>

          {/* Column 2: Hardware Controls */}
          <div style={cardStyle}>
            <p style={colHeaderStyle}>Hardware Controls</p>

            {[
              { label: 'Heater', param: 'heater', infoKey: 'heater' as const },
              { label: 'Pump', param: 'pump', infoKey: 'pump' as const },
              { label: 'Blower', param: 'blower', infoKey: 'blower' as const },
              { label: 'Water In Valve', param: 'water_in_valve', infoKey: 'water_in_valve' as const },
              { label: 'Flush Valve', param: 'flush_valve', infoKey: 'flush_valve' as const },
            ].map(({ label, param, infoKey }) => {
              const active = machineInfo ? machineInfo[infoKey] === 1 : false;
              return (
                <div
                  key={param}
                  style={hwButtonStyle(active)}
                  onClick={() => handleHardwareToggle(param, !active)}
                >
                  <span>{label}</span>
                  {toggleDot(active)}
                </div>
              );
            })}

            <div style={{ ...hwButtonStyle(false), cursor: 'default', opacity: 0.5, marginTop: '1rem' }}>
              <span>Reset</span>
              <span style={{ fontSize: '0.78rem', color: '#999' }}>No action</span>
            </div>
          </div>

          {/* Column 3: Settings */}
          <div style={cardStyle}>
            <p style={colHeaderStyle}>Session Settings</p>

            <div style={rowStyle}>
              <span style={labelStyle}>Default Session Duration</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <input
                  type="number"
                  min={1} max={120}
                  value={settings.default_session_minutes}
                  onChange={(e) => handleSetting('default_session_minutes', parseInt(e.target.value, 10) || 1)}
                  style={inputStyle}
                />
                <span style={{ fontSize: '0.8rem', color: '#888' }}>min</span>
              </div>
            </div>

            <div style={rowStyle}>
              <span style={labelStyle}>Set Therapy Temperature</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <input
                  type="number"
                  min={20} max={50}
                  value={settings.default_temperature}
                  onChange={(e) => handleSetting('default_temperature', parseInt(e.target.value, 10) || 37)}
                  style={inputStyle}
                />
                <span style={{ fontSize: '0.8rem', color: '#888' }}>°C</span>
              </div>
            </div>

            <div style={rowStyle}>
              <span style={labelStyle}>Max Threshold Temp</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <input
                  type="number"
                  min={20} max={60}
                  value={settings.max_temperature}
                  onChange={(e) => handleSetting('max_temperature', parseInt(e.target.value, 10) || 40)}
                  style={inputStyle}
                />
                <span style={{ fontSize: '0.8rem', color: '#888' }}>°C</span>
              </div>
            </div>

            <div style={rowStyle}>
              <span style={labelStyle}>Flush Duration</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <input
                  type="number"
                  min={1} max={300}
                  value={settings.flush_duration}
                  onChange={(e) => handleSetting('flush_duration', parseInt(e.target.value, 10) || 10)}
                  style={inputStyle}
                />
                <span style={{ fontSize: '0.8rem', color: '#888' }}>sec</span>
              </div>
            </div>

            {/* Auto Flush */}
            <p style={{ ...colHeaderStyle, marginTop: '1.25rem' }}>Auto Flush</p>

            <div style={rowStyle}>
              <span style={labelStyle}>Auto Flush</span>
              <div
                style={{ cursor: 'pointer' }}
                onClick={() => handleSetting('auto_flush', !settings.auto_flush)}
              >
                {toggleDot(settings.auto_flush)}
              </div>
            </div>

            <div style={rowStyle}>
              <span style={labelStyle}>Flush Mode</span>
              <div style={{ display: 'flex', gap: '0.4rem' }}>
                {(['continuous', 'interval'] as const).map((mode) => (
                  <button
                    key={mode}
                    onClick={() => handleSetting('flush_mode', mode)}
                    style={{
                      padding: '0.25rem 0.6rem',
                      borderRadius: '6px',
                      fontSize: '0.78rem',
                      fontWeight: 600,
                      border: `1px solid ${settings.flush_mode === mode ? '#3880ff' : '#ddd'}`,
                      backgroundColor: settings.flush_mode === mode ? '#e8f0ff' : '#fafafa',
                      color: settings.flush_mode === mode ? '#3880ff' : '#888',
                      cursor: 'pointer',
                      textTransform: 'capitalize',
                    }}
                  >
                    {mode.charAt(0).toUpperCase() + mode.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            {settings.flush_mode === 'interval' && (
              <div style={rowStyle}>
                <span style={labelStyle}>Flush Frequency</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <input
                    type="number"
                    min={5} max={300}
                    value={settings.flush_frequency}
                    onChange={(e) => handleSetting('flush_frequency', parseInt(e.target.value, 10) || 30)}
                    style={inputStyle}
                  />
                  <span style={{ fontSize: '0.8rem', color: '#888' }}>sec</span>
                </div>
              </div>
            )}

            {/* Blower Settings */}
            <p style={{ ...colHeaderStyle, marginTop: '1.25rem' }}>Blower</p>

            <div style={rowStyle}>
              <span style={labelStyle}>Blower Auto</span>
              <div
                style={{ cursor: 'pointer' }}
                onClick={() => handleSetting('blower_auto', !settings.blower_auto)}
              >
                {toggleDot(settings.blower_auto)}
              </div>
            </div>

            <div style={rowStyle}>
              <span style={labelStyle}>Blower Mode</span>
              <div style={{ display: 'flex', gap: '0.4rem' }}>
                {(['continuous', 'interval'] as const).map((mode) => (
                  <button
                    key={mode}
                    onClick={() => handleSetting('blower_frequency_mode', mode)}
                    style={{
                      padding: '0.25rem 0.6rem',
                      borderRadius: '6px',
                      fontSize: '0.78rem',
                      fontWeight: 600,
                      border: `1px solid ${settings.blower_frequency_mode === mode ? '#3880ff' : '#ddd'}`,
                      backgroundColor: settings.blower_frequency_mode === mode ? '#e8f0ff' : '#fafafa',
                      color: settings.blower_frequency_mode === mode ? '#3880ff' : '#888',
                      cursor: 'pointer',
                      textTransform: 'capitalize',
                    }}
                  >
                    {mode.charAt(0).toUpperCase() + mode.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            {settings.blower_frequency_mode === 'interval' && (
              <>
                <div style={rowStyle}>
                  <span style={labelStyle}>Blower Interval</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <input
                      type="number"
                      min={5} max={600}
                      value={settings.blower_interval}
                      onChange={(e) => handleSetting('blower_interval', parseInt(e.target.value, 10) || 30)}
                      style={inputStyle}
                    />
                    <span style={{ fontSize: '0.8rem', color: '#888' }}>sec</span>
                  </div>
                </div>

                <div style={rowStyle}>
                  <span style={labelStyle}>Blower Duration</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <input
                      type="number"
                      min={1} max={300}
                      value={settings.blower_duration}
                      onChange={(e) => handleSetting('blower_duration', parseInt(e.target.value, 10) || 10)}
                      style={inputStyle}
                    />
                    <span style={{ fontSize: '0.8rem', color: '#888' }}>sec</span>
                  </div>
                </div>
              </>
            )}

            <p style={{ fontSize: '0.78rem', color: '#aaa', marginTop: '1.5rem' }}>
              Machine ID: {machineId}
            </p>
          </div>
        </div>
      </IonContent>
      <MachineInfoModal isOpen={showMachineInfo} onClose={() => setShowMachineInfo(false)} />
    </IonPage>
  );
};

export default Settings;
