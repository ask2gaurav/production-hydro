import React, { useState, useEffect } from 'react';
import {
  IonContent, IonHeader, IonPage, IonTitle, IonToolbar,
  IonButton, IonIcon, IonBadge, useIonAlert
} from '@ionic/react';
import { arrowBack, wifiOutline/* , cloudOfflineOutline  */} from 'ionicons/icons';
import { localDB } from '../db/localDB';
import { useStore } from '../store/useStore';
import { useHistory } from 'react-router-dom';
import { sendCommand } from '../services/esp32Service';
import MachineInfoModal from '../components/MachineInfoModal';
// Debug panel imports — kept for reference, panel commented out for production release
// import { getLog, clearLog, fmtTime, type LogEntry } from '../services/debugLog';

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
    ssid: '',
    password: '',
  });

  const [inputDraft, setInputDraft] = useState({
    default_session_minutes: '40',
    default_temperature: '37',
    max_temperature: '40',
    flush_duration: '10',
    flush_frequency: '30',
    blower_interval: '30',
    blower_duration: '10',
  });

  useEffect(() => {
    localDB.settings.get(machineId).then((s) => {
      if (s) {
        setSettings((prev) => ({ ...prev, ...s }));
        setInputDraft({
          default_session_minutes: String(s.default_session_minutes ?? 40),
          default_temperature: String(s.default_temperature ?? 37),
          max_temperature: String(s.max_temperature ?? 40),
          flush_duration: String(s.flush_duration ?? 10),
          flush_frequency: String(s.flush_frequency ?? 30),
          blower_interval: String(s.blower_interval ?? 30),
          blower_duration: String(s.blower_duration ?? 10),
        });
      }
    });
  }, [machineId]);

  const handleNumericBlur = (key: keyof typeof inputDraft, min: number) => {
    const parsed = parseInt(inputDraft[key], 10);
    if (!isNaN(parsed) && parsed >= min) {
      handleSetting(key, parsed);
    } else {
      setInputDraft((d) => ({ ...d, [key]: String(settings[key]) }));
    }
  };

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

            {!machineConnected && (
              <div style={{ marginTop: '1.25rem', backgroundColor: '#fff3f3', border: '1px solid #f5c2c2', borderRadius: '10px', padding: '1rem 1.25rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                  {/*<IonIcon icon={cloudOfflineOutline} style={{ fontSize: '1.2rem', color: '#d32f2f' }} />
                   <span style={{ fontWeight: 700, color: '#d32f2f', fontSize: '0.88rem' }}>Machine Not Connected</span> */}
                  <span style={{ fontWeight: 700, color: '#d32f2f', fontSize: '0.88rem' }}>Tablet Hotspot Troubleshooting Steps:</span>
                </div>
                {/* <p style={{ fontWeight: 700, color: '#555', fontSize: '0.8rem', marginBottom: '0.4rem' }}>Troubleshooting Steps:</p> */}
                <ol style={{ margin: 0, paddingLeft: '1.2rem', color: '#444', fontSize: '0.8rem', lineHeight: '1.9' }}>
                  <li>Enable the <strong>hotspot</strong> on this tablet.</li>
                  <li>Set hotspot <strong>SSID</strong> to: <code style={{ backgroundColor: '#f0f0f0', padding: '0 4px', borderRadius: '4px' }}>{settings.ssid || <em style={{ color: '#999' }}>Not configured — set in Session Settings</em>}</code></li>
                  <li>Set hotspot <strong>Password</strong> to: <code style={{ backgroundColor: '#f0f0f0', padding: '0 4px', borderRadius: '4px' }}>{settings.password || <em style={{ color: '#999' }}>Not configured — set in Session Settings</em>}</code></li>
                  <li>Turn on the <strong>Colonima machine</strong> and wait for it to connect.</li>
                </ol>
              </div>
            )}
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

            {/* <div style={{ ...hwButtonStyle(false), cursor: 'default', opacity: 0.5, marginTop: '1rem' }}>
              <span>Reset</span>
              <span style={{ fontSize: '0.78rem', color: '#999' }}>No action</span>
            </div> */}
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
                  value={inputDraft.default_session_minutes}
                  onChange={(e) => setInputDraft((d) => ({ ...d, default_session_minutes: e.target.value }))}
                  onBlur={() => handleNumericBlur('default_session_minutes', 1)}
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
                  value={inputDraft.default_temperature}
                  onChange={(e) => setInputDraft((d) => ({ ...d, default_temperature: e.target.value }))}
                  onBlur={() => handleNumericBlur('default_temperature', 20)}
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
                  value={inputDraft.max_temperature}
                  onChange={(e) => setInputDraft((d) => ({ ...d, max_temperature: e.target.value }))}
                  onBlur={() => handleNumericBlur('max_temperature', 20)}
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
                  value={inputDraft.flush_duration}
                  onChange={(e) => setInputDraft((d) => ({ ...d, flush_duration: e.target.value }))}
                  onBlur={() => handleNumericBlur('flush_duration', 1)}
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
                    value={inputDraft.flush_frequency}
                    onChange={(e) => setInputDraft((d) => ({ ...d, flush_frequency: e.target.value }))}
                    onBlur={() => handleNumericBlur('flush_frequency', 5)}
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
                      value={inputDraft.blower_interval}
                      onChange={(e) => setInputDraft((d) => ({ ...d, blower_interval: e.target.value }))}
                      onBlur={() => handleNumericBlur('blower_interval', 5)}
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
                      value={inputDraft.blower_duration}
                      onChange={(e) => setInputDraft((d) => ({ ...d, blower_duration: e.target.value }))}
                      onBlur={() => handleNumericBlur('blower_duration', 1)}
                      style={inputStyle}
                    />
                    <span style={{ fontSize: '0.8rem', color: '#888' }}>sec</span>
                  </div>
                </div>
              </>
            )}

            {/* Hotspot Settings */}
            <p style={{ ...colHeaderStyle, marginTop: '1.25rem' }}>Hotspot</p>

            <div style={rowStyle}>
              <span style={labelStyle}>SSID</span>
              <input
                type="text"
                value={settings.ssid}
                onChange={(e) => handleSetting('ssid', e.target.value)}
                style={{ ...inputStyle, width: '140px', textAlign: 'left' }}
                placeholder="Hotspot name"
              />
            </div>

            <div style={rowStyle}>
              <span style={labelStyle}>Password</span>
              <input
                type="text"
                value={settings.password}
                onChange={(e) => handleSetting('password', e.target.value)}
                style={{ ...inputStyle, width: '140px', textAlign: 'left' }}
                placeholder="Hotspot password"
              />
            </div>

            <p style={{ fontSize: '0.78rem', color: '#aaa', marginTop: '1.5rem' }}>
              Machine ID: {machineId}
            </p>
          </div>


          {/* Column 4: Debug Panel — commented out for production release
          <div style={{ ...cardStyle, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', paddingBottom: '0.5rem', borderBottom: '2px solid #f0f0f0' }}>
              <p style={{ ...colHeaderStyle, marginBottom: 0, borderBottom: 'none' }}>Debug</p>
              <div style={{ display: 'flex', gap: '0.4rem' }}>
                <IonIcon
                  icon={refreshOutline}
                  style={{ fontSize: '1rem', cursor: 'pointer', color: '#3880ff' }}
                  onClick={refreshDebug}
                />
                <IonIcon
                  icon={trashOutline}
                  style={{ fontSize: '1rem', cursor: 'pointer', color: '#eb445a' }}
                  onClick={() => { clearLog(); refreshDebug(); }}
                />
              </div>
            </div>

            <div style={rowStyle}>
              <span style={labelStyle}>Stored IP</span>
              <span style={{ ...valueStyle, fontSize: '0.78rem', fontFamily: 'monospace' }}>{storedIp}</span>
            </div>
            <div style={rowStyle}>
              <span style={labelStyle}>Serial</span>
              <span style={{ ...valueStyle, fontSize: '0.78rem', fontFamily: 'monospace' }}>{storedSerial}</span>
            </div>
            <div style={rowStyle}>
              <span style={labelStyle}>Connected</span>
              <span style={{ ...valueStyle, color: machineConnected ? '#2dd36f' : '#eb445a' }}>
                {machineConnected ? 'Yes' : 'No'}
              </span>
            </div>

            <p style={{ ...colHeaderStyle, marginTop: '0.75rem' }}>Local DB</p>
            <div style={rowStyle}>
              <span style={labelStyle}>Therapists</span>
              <span style={valueStyle}>{dbCounts.therapists}</span>
            </div>
            <div style={rowStyle}>
              <span style={labelStyle}>Patients</span>
              <span style={valueStyle}>{dbCounts.patients}</span>
            </div>
            <div style={rowStyle}>
              <span style={labelStyle}>Sessions</span>
              <span style={valueStyle}>{dbCounts.sessions}</span>
            </div>

            <p style={{ ...colHeaderStyle, marginTop: '0.75rem' }}>Recent Events</p>
            <div style={{ flex: 1, overflowY: 'auto', fontSize: '0.72rem', fontFamily: 'monospace' }}>
              {debugLog.length === 0 && (
                <p style={{ color: '#aaa', textAlign: 'center', marginTop: '0.5rem' }}>No events yet</p>
              )}
              {debugLog.map((entry, i) => {
                let color = '#555';
                let text = '';
                if (entry.type === 'registration') {
                  color = '#2dd36f';
                  text = `[${fmtTime(entry.ts)}] REG ip=${entry.ip} sn=${entry.serial}`;
                } else if (entry.type === 'poll') {
                  color = entry.status === 'ok' ? '#3880ff' : '#eb445a';
                  text = entry.status === 'ok'
                    ? `[${fmtTime(entry.ts)}] POLL ok — ${entry.body?.slice(0, 40)}`
                    : `[${fmtTime(entry.ts)}] POLL ERR — ${entry.error}`;
                } else if (entry.type === 'command') {
                  color = entry.status === 'ok' ? '#ffc409' : '#eb445a';
                  text = entry.status === 'ok'
                    ? `[${fmtTime(entry.ts)}] CMD ok`
                    : `[${fmtTime(entry.ts)}] CMD ERR — ${entry.error}`;
                } else if (entry.type === 'info') {
                  color = '#888';
                  text = `[${fmtTime(entry.ts)}] ${entry.message}`;
                }
                return (
                  <div key={i} style={{ color, padding: '0.15rem 0', borderBottom: '1px solid #f5f5f5', wordBreak: 'break-all' }}>
                    {text}
                  </div>
                );
              })}
            </div>
          </div>
          */}

        </div>
      </IonContent>
      <MachineInfoModal isOpen={showMachineInfo} onClose={() => setShowMachineInfo(false)} />
    </IonPage>
  );
};

export default Settings;
