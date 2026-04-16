import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  IonContent, IonIcon, IonHeader, IonPage, IonTitle, IonToolbar,
  IonGrid, IonRow, IonCol, IonButton, IonBadge, IonProgressBar,
  IonModal, IonItem, IonLabel, IonInput, IonTextarea, IonSpinner,
  IonText, IonSelect, IonSelectOption, useIonViewDidEnter, useIonAlert
} from '@ionic/react';
import {
  arrowBack, addOutline, personOutline, personCircleOutline,
  peopleOutline, pencilOutline, trashOutline, searchOutline,
  wifiOutline, cloudOfflineOutline, checkmarkCircleOutline, playCircleOutline, pauseCircleOutline
} from 'ionicons/icons';
import { useHistory } from 'react-router';
import { useStore } from '../store/useStore';
import { localDB, type LocalTherapist, type LocalPatient } from '../db/localDB';
import { runSync } from '../services/syncService';
import { onSessionComplete } from '../services/modeCheck';
import { fetchMachineInfo, sendPrepareParams/* , sendCommand */ } from '../services/esp32Service';
import MachineInfoModal from '../components/MachineInfoModal';
import DobPicker from '../components/DobPicker';

// ---------- Helpers ----------

const computeAge = (dob?: string): string => {
  if (!dob) return '—';
  const birth = new Date(dob);
  if (isNaN(birth.getTime())) return '—';
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  const m = now.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) age--;
  return String(age);
};

const formatDateTime = (d: Date | null): string => {
  if (!d) return '—';
    return new Date(d).toLocaleString('en-IN', {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
};
const formatDate = (d: string | undefined): string => {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-IN', {
    year: 'numeric', month: 'short', day: 'numeric'
  });
};
const formatTime = (d: Date | null): string => {
  if (!d) return '—';
  return new Date(d).toLocaleString('en-IN', {
      hour: '2-digit', minute: '2-digit',
  });
};
const thStyle: React.CSSProperties = {
  padding: '0.6rem 0.75rem', textAlign: 'left', fontWeight: 600,
  color: '#555', whiteSpace: 'nowrap', fontSize: '0.8rem',
  backgroundColor: '#f4f5f8', borderBottom: '2px solid #ddd',
};

const tdStyle: React.CSSProperties = {
  padding: '0.6rem 0.75rem', whiteSpace: 'nowrap', fontSize: '0.82rem',
  verticalAlign: 'middle', borderBottom: '1px solid #eee',
};

// ---------- Searchable select ----------

interface SearchSelectProps<T> {
  items: T[];
  selectedId: number | null;
  onSelect: (item: T) => void;
  onAddNew: () => void;
  placeholder: string;
  getLabel: (item: T) => string;
  getId: (item: T) => number;
  disabled?: boolean;
}

function SearchSelect<T>({
  items, selectedId, onSelect, onAddNew, placeholder, getLabel, getId, disabled
}: SearchSelectProps<T>) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const selected = items.find((i) => getId(i) === selectedId);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const filtered = query.trim()
    ? items.filter((i) => getLabel(i).toLowerCase().includes(query.toLowerCase()))
    : items;

  const handleSelect = (item: T) => {
    onSelect(item);
    setQuery('');
    setOpen(false);
  };

  return (
    <div ref={wrapperRef} style={{ position: 'relative' }}>
      <div
        style={{
          backgroundColor: disabled ? '#f4f5f8' : 'white',
          borderRadius: '10px',
          border: '1px solid #ccc',
          padding: '0.5rem',
          cursor: disabled ? 'not-allowed' : 'text',
          display: 'flex',
          alignItems: 'center',
          gap: '0.4rem',
          opacity: disabled ? 0.7 : 1,
        }}
        onClick={() => { if (!disabled) setOpen(true); }}
      >
        <IonIcon icon={selected ? personCircleOutline : personOutline} style={{ color: '#0a5c99' }} />
        {open && !disabled ? (
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Type to search..."
            style={{ border: 'none', outline: 'none', flex: 1, fontSize: '0.9rem' }}
          />
        ) : (
          <span style={{ flex: 1, fontSize: '0.9rem', color: selected ? '#000' : '#999' }}>
            {selected ? getLabel(selected) : placeholder}
          </span>
        )}
      </div>

      {open && !disabled && (
        <div style={{
          position: 'absolute', top: '110%', left: 0, right: 0, zIndex: 999,
          backgroundColor: 'white', border: '1px solid #ccc', borderRadius: '8px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)', maxHeight: '200px', overflowY: 'auto'
        }}>
          {filtered.length === 0 && (
            <div style={{ padding: '0.5rem 1rem', color: '#999', fontSize: '0.85rem' }}>No results found</div>
          )}
          {filtered.map((item) => (
            <div
              key={getId(item)}
              onClick={() => handleSelect(item)}
              style={{
                padding: '0.5rem 1rem', cursor: 'pointer', fontSize: '0.9rem',
                backgroundColor: getId(item) === selectedId ? '#eef5f9' : 'white'
              }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#f0f0f0')}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = getId(item) === selectedId ? '#eef5f9' : 'white')}
            >
              {getLabel(item)}
            </div>
          ))}
          <div
            onClick={() => { setOpen(false); onAddNew(); }}
            style={{
              padding: '0.5rem 1rem', cursor: 'pointer', fontSize: '0.9rem',
              color: '#0a5c99', borderTop: '1px solid #eee', display: 'flex',
              alignItems: 'center', gap: '0.4rem', fontWeight: 500
            }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#f0f0f0')}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'white')}
          >
            <IonIcon icon={addOutline} /> Add new
          </div>
        </div>
      )}
    </div>
  );
}

// ---------- Main component ----------

type SessionState = 'INIT' | 'READY' | 'PREPARING' | 'IDLE' | 'ACTIVE' | 'PAUSED';
const DEFAULT_TOTAL_SECONDS = 40 * 60;
type StatMap = Record<string, { total: number; last: Date | null }>;

const Therapy: React.FC = () => {
  const [presentAlert] = useIonAlert();
  const { modeStatus, machineId, machineConnected, machineInfo, setMachineConnected, setMachineInfo } = useStore();
  const history = useHistory();
  const [state, setState] = useState<SessionState>('INIT');
  const [totalSeconds, setTotalSeconds] = useState(DEFAULT_TOTAL_SECONDS);
  const [timeLeft, setTimeLeft] = useState(DEFAULT_TOTAL_SECONDS);
  const [sessionError, setSessionError] = useState('');

  const [therapists, setTherapists] = useState<LocalTherapist[]>([]);
  const [patients, setPatients] = useState<LocalPatient[]>([]);
  const [selectedTherapistId, setSelectedTherapistId] = useState<number | null>(null);
  const [selectedPatientId, setSelectedPatientId] = useState<number | null>(null);
  const [sessionNotes, setSessionNotes] = useState('');

  const activeSessionLocalId = useRef<number | null>(null);
  const sessionStartTime = useRef<Date | null>(null);

  // Add therapist modal
  const [showAddTherapist, setShowAddTherapist] = useState(false);
  const [tFirstName, setTFirstName] = useState('');
  const [tLastName, setTLastName] = useState('');
  const [tPhone, setTPhone] = useState('');
  const [tEmail, setTEmail] = useState('');
  const [tGender, setTGender] = useState('');
  const [tSaving, setTSaving] = useState(false);
  const [tError, setTError] = useState('');

  // Add patient modal
  const [showAddPatient, setShowAddPatient] = useState(false);
  const [pFirstName, setPFirstName] = useState('');
  const [pLastName, setPLastName] = useState('');
  const [pPhone, setPPhone] = useState('');
  const [pEmail, setPEmail] = useState('');
  const [pGender, setPGender] = useState('');
  const [pDob, setPDob] = useState('');
  const [pNotes, setPNotes] = useState('');
  const [pSaving, setPSaving] = useState(false);
  const [pError, setPError] = useState('');
  // Manage therapists modal
  const [showManageTherapists, setShowManageTherapists] = useState(false);
  const [tManageSearch, setTManageSearch] = useState('');
  const [editTherapist, setEditTherapist] = useState<LocalTherapist | null>(null);
  const [etFirstName, setEtFirstName] = useState('');
  const [etLastName, setEtLastName] = useState('');
  const [etPhone, setEtPhone] = useState('');
  const [etEmail, setEtEmail] = useState('');
  const [etGender, setEtGender] = useState('');
  const [etSaving, setEtSaving] = useState(false);
  const [etError, setEtError] = useState('');

  // Manage patients modal
  const [showManagePatients, setShowManagePatients] = useState(false);
  const [pManageSearch, setPManageSearch] = useState('');
  const [editPatient, setEditPatient] = useState<LocalPatient | null>(null);
  const [epFirstName, setEpFirstName] = useState('');
  const [epLastName, setEpLastName] = useState('');
  const [epPhone, setEpPhone] = useState('');
  const [epEmail, setEpEmail] = useState('');
  const [epGender, setEpGender] = useState('');
  const [epDob, setEpDob] = useState('');
  const [epNotes, setEpNotes] = useState('');
  const [epSaving, setEpSaving] = useState(false);
  const [epError, setEpError] = useState('');
  // Session stats
  const [sessionStats, setSessionStats] = useState<StatMap>({});

  const isLocked = state === 'INIT' || state === 'ACTIVE' || state === 'PAUSED';
  const [defaultTemp, setDefaultTemp] = useState(37);
  const [showMachineAlert, setShowMachineAlert] = useState(false);
  const [showDisconnectPauseModal, setShowDisconnectPauseModal] = useState(false);
  const [blowerAuto, setBlowerAuto] = useState(false);
  const [flushAuto, setFlushAuto] = useState(false);
  const [blowerMode, setBlowerMode] = useState<'continuous' | 'interval'>('continuous');
  const [blowerInterval, setBlowerInterval] = useState(30);
  const [blowerDuration, setBlowerDuration] = useState(10);
  const [flushMode, setFlushMode] = useState<'continuous' | 'interval'>('continuous');

  const [hotspotSsid, setHotspotSsid] = useState<string | null>(null);
  const [hotspotPassword, setHotspotPassword] = useState<string | null>(null);

  const [showMachineInfo, setShowMachineInfo] = useState(false);
  const [showLowWaterModal, setShowLowWaterModal] = useState(false);
  const [showWaterRecoveredModal, setShowWaterRecoveredModal] = useState(false);
  const lowWaterPaused = useRef(false);
  const [bgIndex, setBgIndex] = useState(0);
  useEffect(() => {
    const images = ['/healthy_gut_1024x683.png', '/hydrad_soften_1024x683.png'];
    const interval = setInterval(() => {
      setBgIndex((prev) => (prev + 1) % images.length);
    }, 20000);
    return () => clearInterval(interval);
  }, []);

  const buildAllParams = useCallback(async (): Promise<Record<string, number>> => {
    const s = await localDB.settings.get(machineId);
    return {
      session_duration: s?.default_session_minutes ?? 40,
      default_temperature: s?.default_temperature ?? defaultTemp,
      max_temperature: s?.max_temperature ?? 40,
      auto_flush: s?.auto_flush ? 1 : 0,
      flush_mode: s?.flush_mode === 'interval' ? 1 : 0,
      flush_frequency: s?.flush_frequency ?? 30,
      flush_duration: s?.flush_duration ?? 10,
      blower_auto: s?.blower_auto ? 1 : 0,
      blower_frequency_mode: s?.blower_frequency_mode === 'interval' ? 1 : 0,
      blower_interval: s?.blower_interval ?? blowerInterval,
      blower_duration: s?.blower_duration ?? blowerDuration,
    };
  }, [machineId, defaultTemp, blowerInterval, blowerDuration]);

  // ---------- Data loading ----------

  const loadLocal = useCallback(async () => {
    const t = await localDB.therapists
      .where('machine_id').equals(machineId)
      .and((r) => r.is_active !== false)
      .toArray();
    const p = await localDB.patients
      .where('machine_id').equals(machineId)
      .and((r) => r.is_active !== false)
      .toArray();
    setTherapists(t);
    setPatients(p);
  }, [machineId]);

  const loadSessionStats = useCallback(async () => {
    const sessions = await localDB.sessions.where('machine_id').equals(machineId).toArray();
    const stats: StatMap = {};
    const bump = (key: string, startTime: Date) => {
      if (!stats[key]) stats[key] = { total: 0, last: null };
      stats[key].total++;
      const t = startTime instanceof Date ? startTime : new Date(startTime);
      if (!stats[key].last || t > stats[key].last!) stats[key].last = t;
    };
    for (const s of sessions) {
      const st = s.start_time instanceof Date ? s.start_time : new Date(s.start_time);
      if (s.therapist_id) bump(`t_${s.therapist_id}`, st);
      if (s.patient_id) bump(`p_${s.patient_id}`, st);
    }
    setSessionStats(stats);
  }, [machineId]);

  const getTherapistStats = (t: LocalTherapist) => {
    const keys = [
      t.server_id ? `t_${t.server_id}` : null,
      t.id != null ? `t_${t.id}` : null,
    ].filter(Boolean) as string[];
    let total = 0;
    let last: Date | null = null;
    for (const key of keys) {
      const s = sessionStats[key];
      if (s) {
        total += s.total;
        if (s.last && (!last || s.last > last)) last = s.last;
      }
    }
    return { total, last };
  };

  const getPatientStats = (p: LocalPatient) => {
    const keys = [
      p.server_id ? `p_${p.server_id}` : null,
      p.id != null ? `p_${p.id}` : null,
    ].filter(Boolean) as string[];
    let total = 0;
    let last: Date | null = null;
    for (const key of keys) {
      const s = sessionStats[key];
      if (s) {
        total += s.total;
        if (s.last && (!last || s.last > last)) last = s.last;
      }
    }
    return { total, last };
  };

  useIonViewDidEnter(() => {
    if (!machineId) return;
    localDB.settings.get(machineId).then((s) => {
      const secs = s?.default_session_minutes ? s.default_session_minutes * 60 : DEFAULT_TOTAL_SECONDS;
      setTotalSeconds(secs);
      setTimeLeft(secs);
      if (s?.default_temperature) setDefaultTemp(s.default_temperature);
      setBlowerAuto(s?.blower_auto ?? false);
      setFlushAuto(s?.auto_flush ?? false);
      setBlowerMode(s?.blower_frequency_mode ?? 'continuous');
      setBlowerInterval(s?.blower_interval ?? 30);
      setBlowerDuration(s?.blower_duration ?? 10);
      setFlushMode(s?.flush_mode ?? 'continuous');
      setHotspotSsid(s?.ssid ?? null);
      setHotspotPassword(s?.password ?? null);
    });
  });

  useEffect(() => {
    if (!machineId) return;
    loadLocal();
    runSync(machineId).then(loadLocal);

    const handleOnline = () => runSync(machineId).then(loadLocal);
    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, [machineId, loadLocal]);

  // ESP32 polling — 3s during PREPARING, 15s otherwise
  useEffect(() => {
    const interval = state === 'PREPARING' ? 500 : 3000;
    const poll = async () => {
      try {
        const info = await fetchMachineInfo();
        setMachineInfo(info);
        setMachineConnected(true);
        setShowMachineAlert(false);
        if (state === 'INIT') {
          setState('READY');
        }
        // Auto-advance: water high level reached AND temperature met
        if (state === 'PREPARING' && info.water_hl === 1 && info.temp >= defaultTemp) {
          setState('IDLE');
        }
        // Degrade: conditions drop while IDLE (System Ready) → back to PREPARING
        if (state === 'IDLE' && (info.temp < defaultTemp || info.water_hl !== 1)) {
          setState('PREPARING');
        }
        // Auto-pause: water low level drops to 0 during active session
        if (state === 'ACTIVE' && info.water_ll === 0) {
          lowWaterPaused.current = true;
          setState('PAUSED');
          setShowLowWaterModal(true);
          try {
            const params = await buildAllParams();
            await sendPrepareParams({ ...params, start_session: 1, prepare_session: 1, pause_session: 1 });
          } catch {
            // Stay paused locally even if command fails
          }
        }
        // Auto-recover: water level restored while paused due to low water
        if (state === 'PAUSED' && lowWaterPaused.current && info.water_ll === 1) {
          lowWaterPaused.current = false;
          setShowLowWaterModal(false);
          setShowWaterRecoveredModal(true);
        }
      } catch {
        setMachineConnected(false);
        setMachineInfo(null);
        if (state === 'READY') {
          setState('INIT');
        } else if (state === 'ACTIVE') {
          // Auto-pause the session and show a modal when machine disconnects during active session
          setState('PAUSED');
          setShowDisconnectPauseModal(true);
        } else if (state !== 'INIT') {
          // Show alert banner when connection drops mid-session (PREPARING, IDLE, PAUSED)
          setShowMachineAlert(true);
        }
      }
    };
    poll();
    const id = setInterval(poll, interval);
    return () => clearInterval(id);
  }, [state, defaultTemp, setMachineConnected, setMachineInfo, buildAllParams]);

  // ---------- Session lifecycle ----------

  const endSession = useCallback(async () => {
    const now = new Date();
    const elapsed = totalSeconds - timeLeft;
    const duration = Math.round(elapsed / 60);

    if (activeSessionLocalId.current !== null) {
      await localDB.sessions.update(activeSessionLocalId.current, {
        end_time: now,
        duration_minutes: duration,
        status: 'completed',
        synced: 0,
      });
      await runSync(machineId);
    }

    await onSessionComplete(machineId);

    activeSessionLocalId.current = null;
    sessionStartTime.current = null;
    setState('READY');
    setTimeLeft(totalSeconds);
    setSelectedTherapistId(null);
    setSelectedPatientId(null);
    setSessionNotes('');
    setSessionError('');
    

    // const updatedStatus = await localDB.settings.get(machineId);
    // if (updatedStatus?.is_locked) {
    //   history.replace('/lockscreen');
    // }
  // }, [timeLeft, machineId, totalSeconds, history]);
  }, [timeLeft, machineId, totalSeconds]);

  useEffect(() => {
    if (state !== 'ACTIVE') return;
    if (timeLeft <= 0) {
      buildAllParams().then((params) => sendPrepareParams({ ...params, end_session: 1 }).catch(() => {}));
      endSession();
      return;
    }
    const t = setInterval(() => setTimeLeft((s) => s - 1), 1000);
    return () => clearInterval(t);
  }, [state, timeLeft, endSession, buildAllParams]);

  const handleStart = async () => {
    setSessionError('');
    if (!selectedTherapistId) { setSessionError('Please select a therapist.'); return; }
    if (!selectedPatientId) { setSessionError('Please select a patient.'); return; }
    if (!sessionNotes.trim()) { setSessionError('Session notes are required.'); return; }

    try {
      const params = await buildAllParams();
      const updated = await sendPrepareParams({ ...params, start_session: 1 });
      setMachineInfo(updated);
    } catch {
      presentAlert({ header: 'Command Failed', message: 'Could not start session on the machine. Check the connection.', buttons: ['OK'] });
      return;
    }

    const therapist = therapists.find((t) => t.id === selectedTherapistId);
    const patient = patients.find((p) => p.id === selectedPatientId);

    const now = new Date();
    sessionStartTime.current = now;

    const localId = await localDB.sessions.add({
      machine_id: machineId,
      therapist_id: String(selectedTherapistId),
      patient_id: String(selectedPatientId),
      therapist_server_id: therapist?.server_id,
      patient_server_id: patient?.server_id,
      start_time: now,
      duration_minutes: 0,
      water_temp_log: [],
      water_level_log: [],
      session_note: sessionNotes.trim(),
      status: 'active',
      synced: 0,
      created_at: now,
    });

    activeSessionLocalId.current = localId as number;
    setState('ACTIVE');
  };

  const handlePauseResume = async () => {
    const isPausing = state === 'ACTIVE';
    try {
      const params = await buildAllParams();
      const updated = await sendPrepareParams({ ...params, start_session: 1, prepare_session: 1, pause_session: isPausing ? 1 : 0 });
      setMachineInfo(updated);
    } catch {
      presentAlert({ header: 'Command Failed', message: `Could not ${isPausing ? 'pause' : 'resume'} session on the machine. Check the connection.`, buttons: ['OK'] });
      return;
    }
    setState(isPausing ? 'PAUSED' : 'ACTIVE');
  };

  const handlePrepare = async () => {
    setState('PREPARING');
    try {
      const params = await buildAllParams();
      const current = machineInfo;
      params.prepare_session = 1;
      if (!current || current.temp < params.default_temperature) params.heater = 1;
      if (!current || current.water_hl === 0) params.water_in_valve = 1;

      const updated = await sendPrepareParams(params);
      setMachineInfo(updated);
    } catch {
      // Polling will handle reconnection; stay in PREPARING
    }
  };

  const handleEndSession = async () => {
    try {
      const params = await buildAllParams();
      const updated = await sendPrepareParams({ ...params, end_session: 1 });
      setMachineInfo(updated);
    } catch {
      presentAlert({ header: 'Command Failed', message: 'Could not end session on the machine. Check the connection.', buttons: ['OK'] });
      return;
    }
    await endSession();
  };

  const handleFlush = async () => {
    try {
      const params = await buildAllParams();
      const updated = await sendPrepareParams({ ...params, flush_button_hit: 1 });
      setMachineInfo(updated);
    } catch {
      presentAlert({ header: 'Command Failed', message: 'Could not trigger flush on the machine. Check the connection.', buttons: ['OK'] });
    }
  };

  const handleFlushToggle = async () => {
    const newVal: 0 | 1 = machineInfo?.flush_valve === 1 ? 0 : 1;
    try {
      const params = await buildAllParams();
      const updated = await sendPrepareParams({ ...params, 'flush_valve': newVal });
      setMachineInfo(updated);
    } catch {
      setShowMachineAlert(true);
    }
  };

  // ---------- Blower manual controls ----------

  const handleBlowerToggle = async () => {
    const newVal: 0 | 1 = machineInfo?.blower === 1 ? 0 : 1;
    try {
      //const updated = await sendCommand('blower', newVal);
      const params = await buildAllParams();
      const updated = await sendPrepareParams({ ...params, 'blower': newVal });
      setMachineInfo(updated);
    } catch {
      setShowMachineAlert(true);
    }
  };

  const handleBlowerPulse = async () => {
    try {
      //const s = await localDB.settings.get(machineId);
      // const params: Record<string, number> = {
      //   blower: 1,
      //   blower_duration: s?.blower_duration ?? blowerDuration,
      //   blower_interval: s?.blower_interval ?? blowerInterval,
      //   default_temperature: s?.default_temperature ?? defaultTemp,
      //   max_temperature: s?.max_temperature ?? 40,
      //   flush_frequency: s?.flush_frequency ?? 30,
      //   flush_duration: s?.flush_duration ?? 10,
      //   auto_flush: s?.auto_flush ? 1 : 0,
      // };
      // const updated = await sendPrepareParams(params);
      const params = await buildAllParams();
      const updated = await sendPrepareParams({ ...params, 'blower': 1 });
      setMachineInfo(updated);
    } catch {
      setShowMachineAlert(true);
    }
  };

  // ---------- Add therapist ----------

  const openAddTherapist = () => {
    setTFirstName(''); setTLastName(''); setTPhone(''); setTEmail(''); setTGender(''); setTError('');
    setShowAddTherapist(true);
  };

  const saveTherapist = async () => {
    if (!tFirstName.trim() || !tLastName.trim() || !tPhone.trim() || !tEmail.trim()) {
      setTError('First name, last name, phone and email are required.');
      return;
    }
    setTSaving(true);
    try {
      const id = await localDB.therapists.add({
        machine_id: machineId,
        first_name: tFirstName.trim(),
        last_name: tLastName.trim(),
        phone: tPhone.trim(),
        email: tEmail.trim(),
        gender: tGender,
        is_active: true,
        synced: 0,
      });
      await loadLocal();
      setSelectedTherapistId(id as number);
      setShowAddTherapist(false);
      runSync(machineId).then(loadLocal);
    } catch {
      setTError('Failed to save. Please try again.');
    } finally {
      setTSaving(false);
    }
  };

  // ---------- Add patient ----------

  const openAddPatient = () => {
    setPFirstName(''); setPLastName(''); setPPhone(''); setPEmail(''); setPGender(''); setPDob(''); setPNotes(''); setPError('');
    setShowAddPatient(true);
  };

  const savePatient = async () => {
    if (!pFirstName.trim() || !pLastName.trim() || !pPhone.trim() || !pEmail.trim()) {
      setPError('First name, last name, phone and email are required.');
      return;
    }
    setPSaving(true);
    try {
      const id = await localDB.patients.add({
        machine_id: machineId,
        first_name: pFirstName.trim(),
        last_name: pLastName.trim(),
        phone: pPhone.trim(),
        email: pEmail.trim(),
        gender: pGender,
        dob: pDob,
        notes: pNotes.trim(),
        is_active: true,
        synced: 0,
      });
      await loadLocal();
      setSelectedPatientId(id as number);
      setShowAddPatient(false);
      runSync(machineId).then(loadLocal);
    } catch {
      setPError('Failed to save. Please try again.');
    } finally {
      setPSaving(false);
    }
  };

  // ---------- Manage therapists ----------

  const openManageTherapists = async () => {
    await loadSessionStats();
    setTManageSearch('');
    setEditTherapist(null);
    setShowManageTherapists(true);
  };

  const openEditTherapist = (t: LocalTherapist) => {
    setEtFirstName(t.first_name);
    setEtLastName(t.last_name);
    setEtPhone(t.phone);
    setEtEmail(t.email);
    setEtGender(t.gender || '');
    setEtError('');
    setEditTherapist(t);
  };

  const saveEditTherapist = async () => {
    if (!etFirstName.trim() || !etLastName.trim() || !etPhone.trim() || !etEmail.trim()) {
      setEtError('First name, last name, phone and email are required.');
      return;
    }
    setEtSaving(true);
    try {
      await localDB.therapists.update(editTherapist!.id!, {
        first_name: etFirstName.trim(),
        last_name: etLastName.trim(),
        phone: etPhone.trim(),
        email: etEmail.trim(),
        gender: etGender,
        synced: 0,
      });
      await loadLocal();
      setEditTherapist(null);
      runSync(machineId).then(loadLocal);
    } catch {
      setEtError('Failed to save. Please try again.');
    } finally {
      setEtSaving(false);
    }
  };

  const deleteTherapist = async (t: LocalTherapist) => {
    if (!window.confirm(`Delete ${t.first_name} ${t.last_name}? This cannot be undone.`)) return;
    await localDB.therapists.update(t.id!, { is_active: false, synced: 0 });
    if (selectedTherapistId === t.id) setSelectedTherapistId(null);
    await loadLocal();
    runSync(machineId).then(loadLocal);
  };

  // ---------- Manage patients ----------

  const openManagePatients = async () => {
    await loadSessionStats();
    setPManageSearch('');
    setEditPatient(null);
    setShowManagePatients(true);
  };

  const openEditPatient = (p: LocalPatient) => {
    setEpFirstName(p.first_name);
    setEpLastName(p.last_name);
    setEpPhone(p.phone);
    setEpEmail(p.email);
    setEpGender(p.gender || '');
    setEpDob(p.dob || '');
    setEpNotes(p.notes || '');
    setEpError('');
    setEditPatient(p);
  };

  const saveEditPatient = async () => {
    if (!epFirstName.trim() || !epLastName.trim() || !epPhone.trim() || !epEmail.trim()) {
      setEpError('First name, last name, phone and email are required.');
      return;
    }
    setEpSaving(true);
    try {
      await localDB.patients.update(editPatient!.id!, {
        first_name: epFirstName.trim(),
        last_name: epLastName.trim(),
        phone: epPhone.trim(),
        email: epEmail.trim(),
        gender: epGender,
        dob: epDob,
        notes: epNotes.trim(),
        synced: 0,
      });
      await loadLocal();
      setEditPatient(null);
      runSync(machineId).then(loadLocal);
    } catch {
      setEpError('Failed to save. Please try again.');
    } finally {
      setEpSaving(false);
    }
  };

  const deletePatient = async (p: LocalPatient) => {
    if (!window.confirm(`Delete ${p.first_name} ${p.last_name}? This cannot be undone.`)) return;
    await localDB.patients.update(p.id!, { is_active: false, synced: 0 });
    if (selectedPatientId === p.id) setSelectedPatientId(null);
    await loadLocal();
    runSync(machineId).then(loadLocal);
  };

  // ---------- Filtered lists for manage modals ----------

  const tFiltered = therapists.filter((t) => {
    if (!tManageSearch.trim()) return true;
    const q = tManageSearch.toLowerCase();
    return `${t.first_name} ${t.last_name}`.toLowerCase().includes(q)
      || t.phone.toLowerCase().includes(q)
      || t.email.toLowerCase().includes(q);
  });

  const pFiltered = patients.filter((p) => {
    if (!pManageSearch.trim()) return true;
    const q = pManageSearch.toLowerCase();
    return `${p.first_name} ${p.last_name}`.toLowerCase().includes(q)
      || p.phone.toLowerCase().includes(q)
      || p.email.toLowerCase().includes(q);
  });

  // ---------- Gender options (shared) ----------

  const genderOptions = (
    <>
      <IonSelectOption value="">Prefer not to say</IonSelectOption>
      <IonSelectOption value="Male">Male</IonSelectOption>
      <IonSelectOption value="Female">Female</IonSelectOption>
      <IonSelectOption value="Other">Other</IonSelectOption>
    </>
  );

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar color="primary">
          <IonTitle slot="start" style={{textAlign:'left'}}>Therapy Session</IonTitle>
          <IonBadge
            slot="end"
            color={machineConnected ? 'success' : 'danger'}
            style={{ marginRight: '0.5rem', cursor: 'pointer' }}
            onClick={() => setShowMachineInfo(true)}
          >
            <IonIcon icon={wifiOutline} style={{ fontSize: '0.7rem', marginRight:'10px',display:'inline-block' }} />
            {machineConnected ? 'Machine Connected' : 'Machine Disconnected'}
          </IonBadge>
          {modeStatus && modeStatus.mode === 'demo' && (
            <IonBadge color="warning" slot="end" style={{ marginRight: '0.5rem' }}>
              DEMO MODE: {modeStatus.sessions_remaining} sessions left
            </IonBadge>
          )}
          <IonButton color="primary" slot="end" style={{ marginRight: '1rem' }} onClick={(e) => {
            (e.currentTarget as HTMLElement).blur();
            if (state === 'ACTIVE' || state === 'PAUSED') {
              presentAlert({
                header: 'End Therapy Session?',
                message: 'A session is in progress. Are you sure you want to end it and go back?',
                buttons: [
                  { text: 'Cancel', role: 'cancel' },
                  { text: 'End & Go Back', role: 'destructive', handler: () => { handleEndSession().then(() => history.goBack()); } },
                ],
              });
            } else {
              history.goBack();
            }
          }}>
            <IonIcon icon={arrowBack} />
          </IonButton>
        </IonToolbar>
      </IonHeader>

      <IonContent fullscreen>
        <IonGrid style={{ height: '100%', margin: 0, padding: 0 }}>
          <IonRow style={{ height: '100%' }}>
            {/* Left panel */}
            <IonCol size="5" style={{ borderRight: '1px solid #ccc', padding: '1rem', display: 'flex', flexDirection: 'column' }}>
              <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
                <h1 style={{ fontSize: '4rem', margin: 0, color: state === 'PAUSED' ? '#999' : '#000' }}>
                  {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, '0')}
                </h1>
                <IonProgressBar value={1 - (timeLeft / totalSeconds)} color="primary" />
                <small>{Math.floor(totalSeconds / 60)}:{(totalSeconds % 60).toString().padStart(2, '0')} min</small>
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
                  <label style={{ fontSize: '0.85rem', fontWeight: 600, color: '#555' }}>Therapist</label>
                  <IonIcon
                    icon={peopleOutline}
                    style={{ color: '#0a5c99', cursor: 'pointer', fontSize: '1.2rem' }}
                    onClick={openManageTherapists}
                  />
                </div>
                <SearchSelect
                  items={therapists}
                  selectedId={selectedTherapistId}
                  onSelect={(t) => setSelectedTherapistId(t.id!)}
                  onAddNew={openAddTherapist}
                  placeholder="Select Therapist..."
                  getLabel={(t) => `${t.first_name} ${t.last_name}`}
                  getId={(t) => t.id!}
                  disabled={isLocked}
                />
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
                  <label style={{ fontSize: '0.85rem', fontWeight: 600, color: '#555' }}>Patient</label>
                  <IonIcon
                    icon={peopleOutline}
                    style={{ color: '#0a5c99', cursor: 'pointer', fontSize: '1.2rem' }}
                    onClick={openManagePatients}
                  />
                </div>
                <SearchSelect
                  items={patients}
                  selectedId={selectedPatientId}
                  onSelect={(p) => setSelectedPatientId(p.id!)}
                  onAddNew={openAddPatient}
                  placeholder="Select Patient..."
                  getLabel={(p) => `${p.first_name} ${p.last_name}`}
                  getId={(p) => p.id!}
                  disabled={isLocked}
                />
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <label style={{ fontSize: '0.85rem', fontWeight: 600, color: '#555' }}>Session Notes *</label>
                <textarea
                  value={sessionNotes}
                  onChange={(e) => setSessionNotes(e.target.value)}
                  disabled={isLocked}
                  style={{
                    backgroundColor: isLocked ? '#f4f5f8' : 'white',
                    borderRadius: '10px',
                    width: '100%',
                    height: '80px',
                    marginTop: '0.4rem',
                    padding: '0.5rem',
                    border: '1px solid #ccc',
                    resize: 'none',
                    opacity: isLocked ? 0.7 : 1,
                    cursor: isLocked ? 'not-allowed' : 'text',
                  }}
                  placeholder="Enter session notes..."
                />
              </div>

              {sessionError && (
                <IonText color="danger">
                  <p style={{ margin: '0 0 0.5rem', fontSize: '0.85rem' }}>{sessionError}</p>
                </IonText>
              )}

              <IonRow>
                <IonCol>
                  <IonButton expand="block" color="warning" onClick={handlePrepare} disabled={state !== 'READY'}>
                    PREPARE
                  </IonButton>
                </IonCol>
                <IonCol>
                  {state === 'ACTIVE' || state === 'PAUSED' ? (
                    <IonButton
                      expand="block"
                      color={state === 'ACTIVE' ? 'warning' : 'success'}
                      onClick={handlePauseResume}
                      disabled={state === 'PAUSED' && machineInfo?.water_ll === 0}
                    >
                      {state === 'ACTIVE' ? 'PAUSE' : 'RESUME'}
                    </IonButton>
                  ) : (
                    <IonButton expand="block" color="success" onClick={handleStart} disabled={state !== 'IDLE'}>
                      START
                    </IonButton>
                  )}
                </IonCol>
              </IonRow>
              <IonRow>
                <IonCol>
                  <IonButton expand="block" color="medium" disabled={state === 'INIT' || state === 'READY' || state === 'PREPARING'} onClick={() =>
                    presentAlert({
                      header: 'End Therapy Session?',
                      message: 'Are you sure you want to end the current therapy session?',
                      buttons: [
                        { text: 'Cancel', role: 'cancel' },
                        { text: 'End Session', role: 'destructive', handler: handleEndSession },
                      ],
                    })
                  }>
                    END THERAPY
                  </IonButton>
                </IonCol>
              </IonRow>

              <IonRow>
                  <IonCol>
                  {flushMode === 'continuous' ? !flushAuto ? (
                      <>
                        <IonLabel style={{ fontSize: '0.95rem', color: '#555', marginBottom: '0.3rem', marginLeft: '0.5rem' }}>Flush Mode: Continuous</IonLabel>
                        <IonLabel style={{ fontSize: '0.95rem', color: '#555', marginBottom: '0.3rem', marginLeft: '0.5rem' }}>Flush Valve is {machineInfo?.flush_valve === 1 ? 'ON' : 'OFF'}</IonLabel>
                        <IonButton
                          expand="block"
                        color={machineInfo?.flush_valve === 1 ? 'success' : 'danger'}
                          disabled={state === 'INIT' || state === 'READY'}
                          onClick={handleFlushToggle}
                        >
                          TURN FLUSH {machineInfo?.flush_valve === 1 ? 'OFF' : 'ON'}
                        </IonButton>
                      </>
                    ):('') : (
                      <>
                        <IonLabel style={{ fontSize: '0.95rem', color: '#555', marginBottom: '0.3rem', marginLeft: '0.5rem' }}>Flush Mode: Interval</IonLabel>
                        <IonButton
                          expand="block"
                          color="danger"
                          disabled={state === 'INIT' || state === 'READY'}
                          onClick={handleFlush}
                        >
                          FLUSH
                        </IonButton>
                      </>
                    )}
                  </IonCol>
                </IonRow>

              {!blowerAuto && (
                <IonRow>
                  <IonCol>
                    {blowerMode === 'continuous' ? (
                      <>
                        <IonLabel style={{ fontSize: '0.95rem', color: '#555', marginBottom: '0.3rem', marginLeft: '0.5rem' }}>Blower Mode: Continuous</IonLabel>
                        <IonLabel style={{ fontSize: '0.95rem', color: '#555', marginBottom: '0.3rem', marginLeft: '0.5rem' }}>Blower is {machineInfo?.blower === 1 ? 'ON' : 'OFF'}</IonLabel>
                      <IonButton
                        expand="block"
                          color={machineInfo?.blower === 1 ? 'medium' : 'success'}
                        disabled={state === 'INIT' || state === 'READY'}
                        onClick={handleBlowerToggle}
                      >
                          TURN BLOWER {machineInfo?.blower === 1 ? 'OFF' :  'ON' }
                      </IonButton>
                      </>
                    ) : (
                      <>
                          <IonLabel style={{ fontSize: '0.95rem', color: '#555', marginBottom: '0.3rem', marginLeft: '0.5rem' }}>Blower Mode: Interval</IonLabel>
                        <IonButton
                          expand="block"
                          color="tertiary"
                          disabled={state === 'INIT' || state === 'READY'}
                          onClick={handleBlowerPulse}
                          >
                          BLOWER
                        </IonButton>
                      </>
                    )}
                  </IonCol>
                </IonRow>
              )}
            </IonCol>

            {/* Right panel */}
            <IonCol size="7" style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', alignItems: 'start', padding: '0.51rem', backgroundImage: `url(${['/healthy_gut_1024x683.png', '/hydrad_soften_1024x683.png'][bgIndex]})`, backgroundSize: 'contain', backgroundRepeat: 'no-repeat', backgroundPosition: 'bottom center', transition: 'background-image 0.8s ease-in-out' }}>
              {state === 'INIT' && (
                <div style={{ textAlign: 'center', backgroundColor: 'rgba(255,255,255,0.88)', borderRadius: '16px', padding: '2rem', maxWidth: '420px' }}>
                  <IonIcon icon={cloudOfflineOutline} style={{ fontSize: '5rem', color: '#d32f2f' }} />
                  <h2 style={{ color: '#d32f2f', margin: '0.75rem 0 0.25rem' }}>Machine Not Connected</h2>
                  <p style={{ color: '#666', fontSize: '0.95rem', marginBottom: '1.5rem' }}>
                    Cannot reach the Colonima device. Follow the steps below to connect.
                  </p>
                  <div style={{ textAlign: 'left', backgroundColor: '#fff3f3', border: '1px solid #f5c2c2', borderRadius: '10px', padding: '1rem 1.25rem' }}>
                    <p style={{ fontWeight: 700, color: '#555', marginBottom: '0.5rem' }}>Troubleshooting Steps:</p>
                    <ol style={{ margin: 0, paddingLeft: '1.2rem', color: '#444', fontSize: '0.9rem', lineHeight: '1.8' }}>
                      <li>Enable the <strong>hotspot</strong> on this tablet.</li>
                      <li>Set hotspot <strong>SSID</strong> to: <code style={{ backgroundColor: '#f0f0f0', padding: '0 4px', borderRadius: '4px' }}>{hotspotSsid ?? <em style={{ color: '#999' }}>Contact your supplier for SSID</em>}</code></li>
                      <li>Set hotspot <strong>Password</strong> to: <code style={{ backgroundColor: '#f0f0f0', padding: '0 4px', borderRadius: '4px' }}>{hotspotPassword ?? <em style={{ color: '#999' }}>Contact your supplier for Password</em>}</code></li>
                      <li>Turn on the <strong>Colonima machine</strong> and wait for it to connect.</li>
                    </ol>
                  </div>
                </div>
              )}
              {state === 'READY' && (
                <div style={{ textAlign: 'center', backgroundColor: 'rgba(255,255,255,0.88)', borderRadius: '16px', padding: '0.5rem', maxWidth: '98%' }}>
                  <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem', alignItems: 'center', marginBottom: '1rem' }}>
                  <IonIcon icon={checkmarkCircleOutline} style={{ fontSize: '2.5rem', color: '#2dd36f' }} />
                  <h2 style={{ color: '#2dd36f', margin: '0.75rem 0 0.25rem'}}>Machine Connected</h2>
                    </div>
                  <p style={{ color: '#666', fontSize: '0.95rem' }}>
                    Colonima is online. Select a therapist and patient, add session notes, then press <strong>PREPARE</strong> to begin. Use by professionals only.
                  </p>
                  {machineInfo && (
                    <div style={{ display: 'flex', justifyContent: 'center', gap: '2rem', marginTop: '1rem' }}>
                      <div>
                        <span style={{ fontSize: '1.6rem', fontWeight: 700, color: '#0a5c99' }}>{machineInfo.temp}°C</span>
                        <p style={{ fontSize: '0.8rem', color: '#888', margin: 0 }}>Temperature</p>
                      </div>
                      <div>
                        <IonIcon icon={wifiOutline} style={{ fontSize: '1.6rem', color: '#2dd36f' }} />
                        <p style={{ fontSize: '0.8rem', color: '#888', margin: 0 }}>Connected</p>
                      </div>
                    </div>
                  )}
                </div>
              )}
              {state === 'PREPARING' && (
                <div style={{ width: '100%', backgroundColor: 'rgba(255,255,255,0.94)', border: '1px solid rgba(205,205,205,0.4)', borderRadius: '16px', padding: '10px'}}>
                  <h3 style={{ textAlign: 'center', marginBottom: '1.5rem', color: '#555' }}>
                    Preparing… waiting for water level and temperature
                  </h3>
                  <div style={{ display: 'flex', justifyContent: 'space-around', alignItems: 'start' }}>
                    {/* Temperature gauge */}
                    <div style={{ textAlign: 'center' }}>
                      <p style={{ fontWeight: 600, color: '#555', marginBottom: '0.5rem' }}>Water Temperature</p>
                      <div style={{
                        width: '150px', height: '150px', borderRadius: '50%',
                        border: `10px solid ${machineInfo && machineInfo.temp >= defaultTemp ? '#2dd36f' : '#ffc409'}`,
                        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                      }}>
                        <span style={{ fontSize: '2.2rem', fontWeight: 700 }}>{machineInfo ? `${machineInfo.temp}°C` : '—'}</span>
                        <span style={{ fontSize: '0.75rem', color: '#888' }}>Target: {defaultTemp}°C</span>
                      </div>
                      {machineInfo && machineInfo.temp >= defaultTemp && (
                        <p style={{ color: '#2dd36f', fontWeight: 600, marginTop: '0.5rem' }}>✓ Ready</p>
                      )}
                    </div>
                    {/* Water level indicator */}
                    <div style={{ textAlign: 'center' }}>
                      <p style={{ fontWeight: 600, color: '#555', marginBottom: '0.5rem' }}>Water Level</p>
                      <div style={{ width: '80px', height: '120px', border: '2px solid #ccc', borderRadius: '4px', margin: '0 auto', position: 'relative', backgroundColor: '#f9f9f9' }}>
                        {/* Low level marker */}
                        <div style={{ position: 'absolute', bottom: '30%', left: 0, right: 0, borderTop: '1px dashed #f0a500', zIndex: 1 }} />
                        {/* High level marker */}
                        <div style={{ position: 'absolute', bottom: '80%', left: 0, right: 0, borderTop: '1px dashed #2dd36f', zIndex: 1 }} />
                        {/* Water fill */}
                        <div style={{
                          position: 'absolute', bottom: 0, width: '100%',
                          height: machineInfo ? (machineInfo.water_hl === 1 ? '85%' : machineInfo.water_ll === 1 ? '35%' : '5%') : '0%',
                          backgroundColor: '#3880ff', borderRadius: '0 0 2px 2px',
                          transition: 'height 0.5s ease',
                        }} />
                      </div>
                      <div style={{ marginTop: '0.5rem', fontSize: '0.8rem' }}>
                        <span style={{ color: machineInfo?.water_ll ? '#2dd36f' : '#ccc', marginRight: '0.5rem' }}>● Low</span>
                        <span style={{ color: machineInfo?.water_hl ? '#2dd36f' : '#ccc' }}>● High</span>
                      </div>
                      {machineInfo?.water_hl === 1 && (
                        <p style={{ color: '#2dd36f', fontWeight: 600, marginTop: '0.5rem' }}>✓ Ready</p>
                      )}
                    </div>
                  </div>
                  <p style={{ color: '#666' }}>Note: Close tank drain valve. Ensure steady water supply from overhead tank.</p>
                </div>
              )}
              {state === 'IDLE' && (
                <div style={{ textAlign: 'center', width: '98%'}}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding:'0rem 1.5rem', gap: '2rem', marginTop: '1rem' }}>
                    <h2 style={{ color: '#2dd36f', textAlign:"left" }}>System Ready (IDLE)</h2>
                    <div style={{ textAlign: 'center' }}>
                      <span style={{ fontSize: '1.8rem', fontWeight: 700, color: '#2dd36f' }}>{machineInfo ? `${machineInfo.temp}°C` : '—'}</span>
                      <p style={{ fontSize: '0.8rem', color: '#888', margin: 0 }}>Temperature</p>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <span style={{ fontSize: '1.8rem', fontWeight: 700, color: '#2dd36f' }}>✓</span>
                      <p style={{ fontSize: '0.8rem', color: '#888', margin: 0 }}>Water Level</p>
                    </div>
                  </div>
                  <p style={{ color: '#666' }}>Water level and temperature reached. Select therapist, patient, add notes and press START.</p>
                </div>
              )}
              {state === 'ACTIVE' && (
                <div style={{ textAlign: 'center', width: '98%', backgroundColor: 'rgba(255,255,255,0.88)', border: '1px solid  rgba(235, 235, 235, 0.88)', borderRadius: '16px', padding: '0.5rem'  }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0rem 1.5rem', gap: '1rem', marginTop: '0.1rem' }}>
                    <IonIcon icon={playCircleOutline} style={{ fontSize: '2rem', color: '#2dd36f' }} />
                    <h2 style={{ color: '#2dd36f', fontSize: '1.3rem', textAlign: "left", width: '65%',padding: '0.5rem 0' ,margin: '0rem'}}>Therapy in Progress</h2>
                  {machineInfo && (
                      <p style={{ color: '#00838f', fontSize: '1.1rem', width: '35%', margin: '0.1rem 0', padding: '0.2rem 0.1rem' }}>Temp: {machineInfo.temp}°C</p>
                  )}
                    {!machineInfo && (
                      <p style={{ color: '#00838f', fontSize: '1.1rem', width: '35%', margin: '0.1rem 0', padding: '0.2rem 0.1rem' }}>&nbsp;</p>
                    )}
                  </div>
                  <p style={{ color: '#666', fontSize: '0.81rem', margin: '0.1rem 0', padding: '0.2rem 0.1rem' }}>Therapy session in progress. Use PAUSE to take a break, and END THERAPY when finished.</p>
                </div>
              )}
              {state === 'PAUSED' && (
                <div style={{ textAlign: 'center', width: '98%', backgroundColor: 'rgba(255,255,255,0.88)', border: '1px solid  rgba(235, 235, 235, 0.88)', borderRadius: '16px', padding: '0.5rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0rem 1.5rem', gap: '1rem', marginTop: '0.1rem' }}>
                    <IonIcon icon={pauseCircleOutline} style={{ fontSize: '2rem', color: '#d32e2d' }} />
                    <h2 style={{ color: '#d32e2d', fontSize: '1.3rem', textAlign: "left", width: '65%', padding: '0.5rem 0', margin: '0rem' }}>Therapy is Paused</h2>
                    {machineInfo && (
                      <p style={{ color: '#00838f', fontSize: '1.1rem', width: '35%' }}>Temp: {machineInfo.temp}°C</p>
                    )}
                    {!machineInfo && (
                      <p style={{ color: '#00838f', fontSize: '1.1rem', width: '35%', margin: '0.1rem 0', padding: '0.2rem 0.1rem' }}>&nbsp;</p>
                    )}
                  </div>
                  <p style={{ color: '#666', fontSize: '0.81rem', margin: '0.1rem 0', padding: '0.2rem 0.1rem' }}>Therapy session is paused. Use RESUME to continue, and END THERAPY when finished.</p>
                </div>
              )}
            </IonCol>
          </IonRow>
        </IonGrid>
      </IonContent>

      {/* Add Therapist Modal */}
      <IonModal isOpen={showAddTherapist} className="borderedModal" onDidDismiss={() => setShowAddTherapist(false)}>
        <IonHeader>
          <IonToolbar color="primary">
            <IonTitle>Add Therapist</IonTitle>
            <IonButton slot="end" fill="clear" color="light" onClick={() => setShowAddTherapist(false)}>Cancel</IonButton>
          </IonToolbar>
        </IonHeader>
        <IonContent className="ion-padding">
          <IonItem>
            {/* <IonLabel position="floating">First Name *</IonLabel> */}
            <IonInput fill="outline" label='First Name' className="ion-padding-top" value={tFirstName} onIonInput={(e) => setTFirstName((e.target as HTMLIonInputElement).value as string || '')} />
          </IonItem>
          <IonItem>
            {/* <IonLabel position="floating">Last Name *</IonLabel> */}
            <IonInput fill="outline" label='Last Name' className="ion-padding-top" value={tLastName} onIonInput={(e) => setTLastName((e.target as HTMLIonInputElement).value as string || '')} />
          </IonItem>
          <IonItem>
            {/* <IonLabel position="floating">Phone *</IonLabel> */}
            <IonInput fill="outline" label='Phone' className="ion-padding-top" type="tel" value={tPhone} onIonInput={(e) => setTPhone((e.target as HTMLIonInputElement).value as string || '')} />
          </IonItem>
          <IonItem>
            {/* <IonLabel position="floating">Email *</IonLabel> */}
            <IonInput fill="outline"  label='Email' className="ion-padding-top" type="email" value={tEmail} onIonInput={(e) => setTEmail((e.target as HTMLIonInputElement).value as string || '')} />
          </IonItem>
          <IonItem>
            {/* <IonLabel>Gender</IonLabel> */}
            <IonSelect fill="outline" label='Gender' value={tGender} onIonChange={(e) => setTGender(e.detail.value)} placeholder="Select...">
              {genderOptions}
            </IonSelect>
          </IonItem>
          {tError && (
            <IonText color="danger"><p style={{ padding: '0.5rem 1rem', margin: 0 }}>{tError}</p></IonText>
          )}
          <IonButton expand="block" style={{ marginTop: '1.5rem' }} onClick={saveTherapist} disabled={tSaving}>
            {tSaving ? <IonSpinner name="crescent" /> : 'Save Therapist'}
          </IonButton>
        </IonContent>
      </IonModal>

      {/* Add Patient Modal */}
      <IonModal style={{ '--height': '90%' }} isOpen={showAddPatient} className="ion-border" onDidDismiss={() => setShowAddPatient(false)}>
        <IonHeader>
          <IonToolbar color="primary">
            <IonTitle>Add Patient</IonTitle>
            <IonButton slot="end" fill="clear" color="light" onClick={() => setShowAddPatient(false)}>Cancel</IonButton>
          </IonToolbar>
        </IonHeader>
        <IonContent className="ion-padding">
          <IonItem>
            {/* <IonLabel position="floating">First Name *</IonLabel> */}
            <IonInput label='First Name' className="ion-padding-top" value={pFirstName} onIonInput={(e) => setPFirstName((e.target as HTMLIonInputElement).value as string || '')} />
          </IonItem>
          <IonItem>
            {/* <IonLabel position="floating">Last Name *</IonLabel> */}
            <IonInput label='Last Name' className="ion-padding-top" value={pLastName} onIonInput={(e) => setPLastName((e.target as HTMLIonInputElement).value as string || '')} />
          </IonItem>
          <IonItem>
            {/* <IonLabel position="floating">Phone *</IonLabel> */}
            <IonInput label='Phone' className="ion-padding-top" type="tel" value={pPhone} onIonInput={(e) => setPPhone((e.target as HTMLIonInputElement).value as string || '')} />
          </IonItem>
          <IonItem>
            {/* <IonLabel position="floating">Email *</IonLabel> */}
            <IonInput label='Email' className="ion-padding-top" type="email" value={pEmail} onIonInput={(e) => setPEmail((e.target as HTMLIonInputElement).value as string || '')} />
          </IonItem>
          <IonItem>
            {/* <IonLabel>Gender</IonLabel> */}
            <IonSelect label='Gender' value={pGender} onIonChange={(e) => setPGender(e.detail.value)} placeholder="Select...">
              {genderOptions}
            </IonSelect>
          </IonItem>
          <IonItem lines="none">
            <DobPicker value={pDob} onChange={setPDob} />
          </IonItem>
          <IonItem>
            {/* <IonLabel position="stacked">Notes</IonLabel> */}
            <IonTextarea label='Notes' rows={3} value={pNotes} onIonInput={(e) => setPNotes((e.target as HTMLIonTextareaElement).value as string || '')} />
          </IonItem>
          {pError && (
            <IonText color="danger"><p style={{ padding: '0.5rem 1rem', margin: 0 }}>{pError}</p></IonText>
          )}
          <IonButton expand="block" style={{ marginTop: '1.5rem' }} onClick={savePatient} disabled={pSaving}>
            {pSaving ? <IonSpinner name="crescent" /> : 'Save Patient'}
          </IonButton>
        </IonContent>
      </IonModal>

      {/* Manage Therapists Modal */}
      <IonModal isOpen={showManageTherapists} onDidDismiss={() => { setShowManageTherapists(false); setEditTherapist(null); setTManageSearch(''); }} style={{ '--height': '100%', '--width': '100%', '--border-radius': '0' }}>
        <IonHeader>
          <IonToolbar color="primary">
            <IonTitle>{editTherapist ? 'Edit Therapist' : 'Manage Therapists'}</IonTitle>
            {editTherapist && (
              <IonButton slot="end" fill="clear" color="light" onClick={() => setEditTherapist(null)}><IonIcon icon={arrowBack} /></IonButton>
            )}
            {!editTherapist && (
            <IonButton slot="end" fill="clear" color="light" onClick={() => { setShowManageTherapists(false); setEditTherapist(null); }}>
              <IonIcon icon={arrowBack} />
            </IonButton>)}
          </IonToolbar>
        </IonHeader>
        <IonContent className="ion-padding">
          {editTherapist ? (
            <div>
              <IonItem>
                {/* <IonLabel position="floating">First Name *</IonLabel> */}
                <IonInput label='First Name' className="ion-padding-top" value={etFirstName} onIonInput={(e) => setEtFirstName((e.target as HTMLIonInputElement).value as string || '')} />
              </IonItem>
              <IonItem>
                {/* <IonLabel position="floating">Last Name *</IonLabel> */}
                <IonInput label='Last Name' className="ion-padding-top" value={etLastName} onIonInput={(e) => setEtLastName((e.target as HTMLIonInputElement).value as string || '')} />
              </IonItem>
              <IonItem>
                {/* <IonLabel position="floating">Phone *</IonLabel> */}
                <IonInput label='Phone' className="ion-padding-top" type="tel" value={etPhone} onIonInput={(e) => setEtPhone((e.target as HTMLIonInputElement).value as string || '')} />
              </IonItem>
              <IonItem>
                {/* <IonLabel position="floating">Email *</IonLabel> */}
                <IonInput label='Email' className="ion-padding-top" type="email" value={etEmail} onIonInput={(e) => setEtEmail((e.target as HTMLIonInputElement).value as string || '')} />
              </IonItem>
              <IonItem>
                {/* <IonLabel>Gender</IonLabel> */}
                <IonSelect label='Gender' value={etGender} onIonChange={(e) => setEtGender(e.detail.value)} placeholder="Select...">
                  {genderOptions}
                </IonSelect>
              </IonItem>
              {etError && (
                <IonText color="danger"><p style={{ padding: '0.5rem 1rem', margin: 0 }}>{etError}</p></IonText>
              )}
              <IonButton expand="block" style={{ marginTop: '1.5rem' }} onClick={saveEditTherapist} disabled={etSaving}>
                {etSaving ? <IonSpinner name="crescent" /> : 'Save Changes'}
              </IonButton>
            </div>
          ) : (
            <div>
              <div style={{display:'flex',justifyContent:'space-between', alignItems:'center'}}>
              <div style={{ display: 'flex',width:'70%', alignItems: 'center', gap: '0.5rem', border: '1px solid #ccc', borderRadius: '8px', padding: '0.4rem 0.75rem', backgroundColor: 'white', marginBottom: '1rem' }}>
                <IonIcon icon={searchOutline} style={{ color: '#999', flexShrink: 0 }} />
                <input
                  value={tManageSearch}
                  onChange={(e) => setTManageSearch(e.target.value)}
                  placeholder="Search by name, mobile or email..."
                  style={{ border: 'none', outline: 'none', flex: 1, fontSize: '0.9rem' }}
                />
              </div>
                <IonButton style={{marginTop:'-11px'}} fill='outline' slot="end" color="primary" onClick={() => { openAddTherapist(); }}>
                  <IonIcon icon={addOutline} />&nbsp;Add New Therapist
                </IonButton>
                </div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      <th style={thStyle}>Name</th>
                      <th style={thStyle}>Mobile</th>
                      <th style={thStyle}>Email</th>
                      <th style={thStyle}>Gender</th>
                      <th style={thStyle}>Total<br/>Sessions</th>
                      <th style={thStyle}>Last Session</th>
                      <th style={thStyle}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tFiltered.length === 0 && (
                      <tr>
                        <td colSpan={7} style={{ ...tdStyle, textAlign: 'center', color: '#999', padding: '2rem' }}>
                          No therapists found.
                        </td>
                      </tr>
                    )}
                    {tFiltered.map((t) => {
                      const stats = getTherapistStats(t);
                      return (
                        <tr
                          key={t.id}
                          onClick={() => { setSelectedTherapistId(t.id!); setShowManageTherapists(false); }}
                          style={{ cursor: 'pointer', backgroundColor: selectedTherapistId === t.id ? '#eef5f9' : 'white' }}
                          onMouseEnter={(e) => { if (selectedTherapistId !== t.id) e.currentTarget.style.backgroundColor = '#f4f5f8'; }}
                          onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = selectedTherapistId === t.id ? '#eef5f9' : 'white'; }}
                        >
                          <td style={tdStyle}>{t.first_name} {t.last_name}</td>
                          <td style={tdStyle}>{t.phone}</td>
                          <td style={tdStyle}>{t.email}</td>
                          <td style={tdStyle}>{t.gender || '—'}</td>
                          <td style={{ ...tdStyle, textAlign: 'center' }}>{stats.total}</td>
                          <td style={tdStyle}>{formatDateTime(stats.last)}</td>
                          <td style={tdStyle} onClick={(e) => e.stopPropagation()}>
                            <IonIcon
                              icon={pencilOutline}
                              style={{ color: '#0a5c99', cursor: 'pointer', fontSize: '1.2rem', marginRight: '0.75rem' }}
                              onClick={() => openEditTherapist(t)}
                            />
                            <IonIcon
                              icon={trashOutline}
                              style={{ color: '#eb445a', cursor: 'pointer', fontSize: '1.2rem' }}
                              onClick={() => deleteTherapist(t)}
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </IonContent>
      </IonModal>

      {/* Manage Patients Modal */}
      <IonModal isOpen={showManagePatients} onDidDismiss={() => { setShowManagePatients(false); setEditPatient(null); setPManageSearch(''); }} style={{ '--height': '100%', '--width': '100%', '--border-radius': '0' }}>
        <IonHeader>
          <IonToolbar color="primary">
            <IonTitle>{editPatient ? 'Edit Patient' : 'Manage Patients'}</IonTitle>
            {editPatient && (
              <IonButton slot="end" fill="clear" color="light" onClick={() => setEditPatient(null)}><IonIcon icon={arrowBack} /></IonButton>
            )}
            {!editPatient && (
            <IonButton slot="end" fill="clear" color="light" onClick={() => { setShowManagePatients(false); setEditPatient(null); }}>
              <IonIcon icon={arrowBack} />
            </IonButton>
            )}
          </IonToolbar>
        </IonHeader>
        <IonContent className="ion-padding">
          {editPatient ? (
            <div>
              <IonItem>
                {/* <IonLabel position="floating">First Name *</IonLabel> */}
                <IonInput label='First Name' className="ion-padding-top" value={epFirstName} onIonInput={(e) => setEpFirstName((e.target as HTMLIonInputElement).value as string || '')} />
              </IonItem>
              <IonItem>
                {/* <IonLabel position="floating">Last Name *</IonLabel> */}
                <IonInput label='Last Name' className="ion-padding-top" value={epLastName} onIonInput={(e) => setEpLastName((e.target as HTMLIonInputElement).value as string || '')} />
              </IonItem>
              <IonItem>
                {/* <IonLabel position="floating">Phone *</IonLabel> */}
                <IonInput label='Phone' className="ion-padding-top" type="tel" value={epPhone} onIonInput={(e) => setEpPhone((e.target as HTMLIonInputElement).value as string || '')} />
              </IonItem>
              <IonItem>
                {/* <IonLabel position="floating">Email *</IonLabel> */}
                <IonInput label='Email' className="ion-padding-top" type="email" value={epEmail} onIonInput={(e) => setEpEmail((e.target as HTMLIonInputElement).value as string || '')} />
              </IonItem>
              <IonItem>
                {/* <IonLabel>Gender</IonLabel> */}
                <IonSelect label='Gender' value={epGender} onIonChange={(e) => setEpGender(e.detail.value)} placeholder="Select...">
                  {genderOptions}
                </IonSelect>
              </IonItem>
              <IonItem>
                {/* <IonLabel position="floating">Date of Birth</IonLabel> */}
                <DobPicker value={epDob} onChange={setEpDob} />
              </IonItem>
              <IonItem>
                {/* <IonLabel position="stacked">Notes</IonLabel> */}
                <IonTextarea label='Notes' rows={3} value={epNotes} onIonInput={(e) => setEpNotes((e.target as HTMLIonTextareaElement).value as string || '')} />
              </IonItem>
              {epError && (
                <IonText color="danger"><p style={{ padding: '0.5rem 1rem', margin: 0 }}>{epError}</p></IonText>
              )}
              <IonButton expand="block" style={{ marginTop: '1.5rem' }} onClick={saveEditPatient} disabled={epSaving}>
                {epSaving ? <IonSpinner name="crescent" /> : 'Save Changes'}
              </IonButton>
            </div>
          ) : (
            <div>
              <div style={{ display: 'flex', alignItems: 'stretch', gap: '0.5rem',width:'100%',justifyContent:"space-between" }}>
                  <div style={{ display: 'flex', width: '70%', alignItems: 'center', gap: '0.5rem', border: '1px solid #ccc', borderRadius: '8px', padding: '0.4rem 0.75rem', backgroundColor: 'white', marginBottom: '1rem' }}>
                    <IonIcon icon={searchOutline} style={{ color: '#999', flexShrink: 0 }} />
                    <input
                  value={pManageSearch}
                  onChange={(e) => setPManageSearch(e.target.value)}
                  placeholder="Search by name, mobile or email..."
                  style={{ border: 'none', outline: 'none', flex: 1, fontSize: '0.9rem' }}
                />
                  </div>
                  <IonButton fill='clear' slot="end" color="primary" onClick={() => { openAddPatient(); }}>
                    <IonIcon icon={addOutline} />&nbsp;Add New Patient
                  </IonButton>
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      <th style={thStyle}>Name</th>
                      <th style={thStyle}>Mobile</th>
                      <th style={thStyle}>Email</th>
                      <th style={thStyle}>Gender</th>
                      <th style={thStyle}>DOB</th>
                      <th style={thStyle}>Age</th>
                      <th style={thStyle}>Total<br/>Sessions</th>
                      <th style={thStyle}>Last<br />Session</th>
                      <th style={thStyle}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pFiltered.length === 0 && (
                      <tr>
                        <td colSpan={9} style={{ ...tdStyle, textAlign: 'center', color: '#999', padding: '2rem' }}>
                          No patients found.
                        </td>
                      </tr>
                    )}
                    {pFiltered.map((p) => {
                      const stats = getPatientStats(p);
                      return (
                        <tr
                          key={p.id}
                          onClick={() => { setSelectedPatientId(p.id!); setShowManagePatients(false); }}
                          style={{ cursor: 'pointer', backgroundColor: selectedPatientId === p.id ? '#eef5f9' : 'white' }}
                          onMouseEnter={(e) => { if (selectedPatientId !== p.id) e.currentTarget.style.backgroundColor = '#f4f5f8'; }}
                          onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = selectedPatientId === p.id ? '#eef5f9' : 'white'; }}
                        >
                          <td style={tdStyle}>{p.first_name} {p.last_name}</td>
                          <td style={tdStyle}>{p.phone}</td>
                          <td style={tdStyle}>{p.email}</td>
                          <td style={tdStyle}>{p.gender || '—'}</td>
                          <td style={tdStyle}>{formatDate(p.dob) || '—'}</td>
                          <td style={{ ...tdStyle, textAlign: 'center' }}>{computeAge(p.dob)}</td>
                          <td style={{ ...tdStyle, textAlign: 'center' }}>{stats.total}</td>
                          <td style={tdStyle}>{stats.last ? formatDate(stats.last.toString()) : '—'}<br />{formatTime(stats.last) }</td>
                          <td style={tdStyle} onClick={(e) => e.stopPropagation()}>
                            <IonIcon
                              icon={pencilOutline}
                              style={{ color: '#0a5c99', cursor: 'pointer', fontSize: '1.2rem', marginRight: '0.75rem' }}
                              onClick={() => openEditPatient(p)}
                            />
                            <IonIcon
                              icon={trashOutline}
                              style={{ color: '#eb445a', cursor: 'pointer', fontSize: '1.2rem' }}
                              onClick={() => deletePatient(p)}
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </IonContent>
      </IonModal>

      <style>{`
      .sc-ion-label-md-h {color:#6e6565 !important;}
        /* Hide number input spinners */
        .native-input[type="date"]::-webkit-calendar-picker-indicator {
  filter: invert(0);
}
        input[type=number]::-webkit-inner-spin-button,
        input[type=number]::-webkit-outer-spin-button {
          -webkit-appearance: none;
          margin: 0;
        }
        input[type=number] {
          -moz-appearance: textfield;
        }
      `}</style>

      <MachineInfoModal isOpen={showMachineInfo} onClose={() => setShowMachineInfo(false)} />

      {/* Session auto-paused due to machine disconnection modal */}
      {showDisconnectPauseModal && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 10000,
          backgroundColor: 'rgba(0,0,0,0.55)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <div style={{
            backgroundColor: 'white', borderRadius: '14px',
            padding: '2rem 2rem 1.5rem',
            maxWidth: '420px', width: '90%',
            boxShadow: '0 8px 32px rgba(0,0,0,0.28)',
            textAlign: 'center',
          }}>
            <div style={{ fontSize: '2.8rem', marginBottom: '0.5rem' }}>⚠️</div>
            <h2 style={{ margin: '0 0 0.5rem', fontSize: '1.3rem', color: '#b71c1c', fontWeight: 700 }}>
              Session Paused
            </h2>
            <p style={{ margin: '0 0 0.25rem', fontSize: '0.95rem', color: '#333', lineHeight: 1.5 }}>
              The machine became unreachable and your session has been <strong>automatically paused</strong>.
            </p>
            <p style={{ margin: '0 0 1.5rem', fontSize: '0.88rem', color: '#666', lineHeight: 1.5 }}>
              Please ensure the machine is powered on and connected to the same network, then press <strong>Resume</strong> to continue the session.
            </p>
            <button
              onClick={() => setShowDisconnectPauseModal(false)}
              style={{
                backgroundColor: '#0a5c99', color: 'white',
                border: 'none', borderRadius: '8px',
                padding: '0.65rem 2rem', fontSize: '1rem',
                fontWeight: 600, cursor: 'pointer', width: '100%',
              }}
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Low water level — session auto-paused modal */}
      {showLowWaterModal && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 10000,
          backgroundColor: 'rgba(0,0,0,0.55)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <div style={{
            backgroundColor: 'white', borderRadius: '14px',
            padding: '2rem 2rem 1.5rem',
            maxWidth: '460px', width: '90%',
            boxShadow: '0 8px 32px rgba(0,0,0,0.28)',
          }}>
            <div style={{ fontSize: '2.8rem', marginBottom: '0.5rem', textAlign: 'center' }}>⚠️</div>
            <h2 style={{ margin: '0 0 0.5rem', fontSize: '1.3rem', color: '#b71c1c', fontWeight: 700, textAlign: 'center' }}>
              Session Paused — Low Water Level
            </h2>
            <p style={{ margin: '0 0 1rem', fontSize: '0.95rem', color: '#333', lineHeight: 1.6, textAlign: 'center' }}>
              The water level in the machine has dropped. The session has been automatically paused.
            </p>
            <div style={{ backgroundColor: '#fff3f3', border: '1px solid #f5c2c2', borderRadius: '10px', padding: '1rem 1.25rem', marginBottom: '1.25rem' }}>
              <p style={{ fontWeight: 700, color: '#555', fontSize: '0.88rem', marginBottom: '0.5rem' }}>Please check the following:</p>
              <ol style={{ margin: 0, paddingLeft: '1.2rem', color: '#444', fontSize: '0.88rem', lineHeight: '2' }}>
                <li>Check the <strong>water level</strong> in the machine tank — refill if low.</li>
                <li>Check the <strong>water pump</strong> — ensure it is running and not blocked.</li>
                <li>Check the <strong>main water supply tank</strong> — ensure it has sufficient water.</li>
              </ol>
            </div>
            <p style={{ margin: '0 0 1.25rem', fontSize: '0.85rem', color: '#888', textAlign: 'center', lineHeight: 1.5 }}>
              The session will remain paused. This dialog will close automatically once water level is restored.
            </p>
            <button
              onClick={() => setShowLowWaterModal(false)}
              style={{
                backgroundColor: '#b71c1c', color: 'white',
                border: 'none', borderRadius: '8px',
                padding: '0.65rem 2rem', fontSize: '1rem',
                fontWeight: 600, cursor: 'pointer', width: '100%',
              }}
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Water level restored modal */}
      {showWaterRecoveredModal && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 10000,
          backgroundColor: 'rgba(0,0,0,0.55)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <div style={{
            backgroundColor: 'white', borderRadius: '14px',
            padding: '2rem 2rem 1.5rem',
            maxWidth: '420px', width: '90%',
            boxShadow: '0 8px 32px rgba(0,0,0,0.28)',
            textAlign: 'center',
          }}>
            <div style={{ fontSize: '2.8rem', marginBottom: '0.5rem' }}>✅</div>
            <h2 style={{ margin: '0 0 0.5rem', fontSize: '1.3rem', color: '#2dd36f', fontWeight: 700 }}>
              Water Level Restored
            </h2>
            <p style={{ margin: '0 0 1.5rem', fontSize: '0.95rem', color: '#333', lineHeight: 1.6 }}>
              The water level is back to normal. The machine is ready to continue.
              Press <strong>RESUME</strong> to continue the therapy session.
            </p>
            <button
              onClick={() => setShowWaterRecoveredModal(false)}
              style={{
                backgroundColor: '#2dd36f', color: 'white',
                border: 'none', borderRadius: '8px',
                padding: '0.65rem 2rem', fontSize: '1rem',
                fontWeight: 600, cursor: 'pointer', width: '100%',
              }}
            >
              OK
            </button>
          </div>
        </div>
      )}

      {/* Machine disconnected alert */}
      {showMachineAlert && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, zIndex: 9999,
          backgroundColor: '#d32f2f', color: 'white',
          padding: '0.75rem 1.25rem',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
        }}>
          <span style={{ fontWeight: 600 }}>
            ⚠ Machine not reachable — please switch on the machine and ensure it is connected to the same network.
          </span>
          <button
            onClick={() => setShowMachineAlert(false)}
            style={{ background: 'none', border: 'none', color: 'white', fontSize: '1.2rem', cursor: 'pointer', marginLeft: '1rem' }}
          >
            ✕
          </button>
        </div>
      )}
    </IonPage>
  );
};

export default Therapy;
