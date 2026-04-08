import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  IonContent, IonIcon, IonHeader, IonPage, IonTitle, IonToolbar,
  IonGrid, IonRow, IonCol, IonButton, IonBadge, IonProgressBar,
  IonModal, IonItem, IonLabel, IonInput, IonTextarea, IonSpinner,
  IonText, IonSelect, IonSelectOption, useIonViewDidEnter
} from '@ionic/react';
import {
  arrowBack, addOutline, personOutline, personCircleOutline,
  peopleOutline, pencilOutline, trashOutline, searchOutline,
  wifiOutline, cloudOfflineOutline, checkmarkCircleOutline
} from 'ionicons/icons';
import { useHistory } from 'react-router';
import { useStore } from '../store/useStore';
import { localDB, type LocalTherapist, type LocalPatient } from '../db/localDB';
import { runSync } from '../services/syncService';
import { onSessionComplete } from '../services/modeCheck';
import { fetchMachineInfo, sendPrepareParams } from '../services/esp32Service';
import MachineInfoModal from '../components/MachineInfoModal';

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
  return new Date(d).toLocaleString(undefined, {
    year: 'numeric', month: 'short', day: 'numeric',
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
  const refPatientDob = useRef<HTMLIonInputElement>(null);

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
  const refEpDob = useRef<HTMLIonInputElement>(null);

  // Session stats
  const [sessionStats, setSessionStats] = useState<StatMap>({});

  const isLocked = state === 'INIT' || state === 'ACTIVE' || state === 'PAUSED';
  const [defaultTemp, setDefaultTemp] = useState(37);
  const [showMachineAlert, setShowMachineAlert] = useState(false);

  const [showMachineInfo, setShowMachineInfo] = useState(false);
  const [bgIndex, setBgIndex] = useState(0);
  useEffect(() => {
    const images = ['/healthy_gut_1024x683.png', '/hydrad_soften_1024x683.png'];
    const interval = setInterval(() => {
      setBgIndex((prev) => (prev + 1) % images.length);
    }, 20000);
    return () => clearInterval(interval);
  }, []);

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
    const interval = state === 'PREPARING' ? 3000 : 15000;
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
      } catch {
        setMachineConnected(false);
        setMachineInfo(null);
        if (state === 'READY') {
          setState('INIT');
        } else if (state !== 'INIT') {
          // Show alert banner when connection drops mid-session
          setShowMachineAlert(true);
        }
      }
    };
    poll();
    const id = setInterval(poll, interval);
    return () => clearInterval(id);
  }, [state, defaultTemp, setMachineConnected, setMachineInfo]);

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
      endSession();
      return;
    }
    const t = setInterval(() => setTimeLeft((s) => s - 1), 1000);
    return () => clearInterval(t);
  }, [state, timeLeft, endSession]);

  const handleStart = async () => {
    setSessionError('');
    if (!selectedTherapistId) { setSessionError('Please select a therapist.'); return; }
    if (!selectedPatientId) { setSessionError('Please select a patient.'); return; }
    if (!sessionNotes.trim()) { setSessionError('Session notes are required.'); return; }

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

  const handlePauseResume = () => {
    setState((s) => (s === 'ACTIVE' ? 'PAUSED' : 'ACTIVE'));
  };

  const handlePrepare = async () => {
    setState('PREPARING');
    try {
      const s = await localDB.settings.get(machineId);
      const therapyTemp = s?.default_temperature ?? defaultTemp;
      const maxTemp = s?.max_temperature ?? 40;
      const flushFreq = s?.flush_frequency ?? 30;
      const current = machineInfo;

      const params: Record<string, number> = {
        default_temperature: therapyTemp,
        max_temperature: maxTemp,
        flush_frequency: flushFreq,
      };
      if (!current || current.temp < therapyTemp) params.heater = 1;
      if (!current || current.water_hl === 0) params.water_in_valve = 1;

      const updated = await sendPrepareParams(params);
      setMachineInfo(updated);
    } catch {
      // Polling will handle reconnection; stay in PREPARING
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
          <IonButton color="primary" slot="end" style={{ marginRight: '1rem' }} onClick={(e) => { (e.currentTarget as HTMLElement).blur(); history.goBack(); }}>
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
                    <IonButton expand="block" color={state === 'ACTIVE' ? 'warning' : 'success'} onClick={handlePauseResume}>
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
                  <IonButton expand="block" color="medium" onClick={endSession} disabled={state === 'INIT' || state === 'READY' || state === 'PREPARING'}>
                    END THERAPY
                  </IonButton>
                </IonCol>
                <IonCol>
                  <IonButton expand="block" color="danger" disabled={state === 'INIT' || state === 'READY'}>FLUSH</IonButton>
                </IonCol>
              </IonRow>
            </IonCol>

            {/* Right panel */}
            <IonCol size="7" style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', alignItems: 'start', padding: '2rem', backgroundImage: `url(${['/healthy_gut_1024x683.png', '/hydrad_soften_1024x683.png'][bgIndex]})`, backgroundSize: 'contain', backgroundRepeat: 'no-repeat', backgroundPosition: 'bottom center', transition: 'background-image 0.8s ease-in-out' }}>
              {state === 'INIT' && (
                <div style={{ textAlign: 'center', backgroundColor: 'rgba(255,255,255,0.88)', borderRadius: '16px', padding: '2rem', maxWidth: '420px' }}>
                  <IonIcon icon={cloudOfflineOutline} style={{ fontSize: '5rem', color: '#d32f2f' }} />
                  <h2 style={{ color: '#d32f2f', margin: '0.75rem 0 0.25rem' }}>Machine Not Connected</h2>
                  <p style={{ color: '#666', fontSize: '0.95rem', marginBottom: '1.5rem' }}>
                    Cannot reach the ESP32 device. Follow the steps below to connect.
                  </p>
                  <div style={{ textAlign: 'left', backgroundColor: '#fff3f3', border: '1px solid #f5c2c2', borderRadius: '10px', padding: '1rem 1.25rem' }}>
                    <p style={{ fontWeight: 700, color: '#555', marginBottom: '0.5rem' }}>Troubleshooting Steps:</p>
                    <ol style={{ margin: 0, paddingLeft: '1.2rem', color: '#444', fontSize: '0.9rem', lineHeight: '1.8' }}>
                      <li>Enable the <strong>hotspot</strong> on this tablet.</li>
                      <li>Set hotspot <strong>SSID</strong> to: <code style={{ backgroundColor: '#f0f0f0', padding: '0 4px', borderRadius: '4px' }}>{import.meta.env.VITE_HOTSPOT_SSID}</code></li>
                      <li>Set hotspot <strong>Password</strong> to: <code style={{ backgroundColor: '#f0f0f0', padding: '0 4px', borderRadius: '4px' }}>{import.meta.env.VITE_HOTSPOT_PASSWORD}</code></li>
                      <li>Turn on the <strong>ESP32 machine</strong> and wait for it to connect.</li>
                    </ol>
                  </div>
                </div>
              )}
              {state === 'READY' && (
                <div style={{ textAlign: 'center', backgroundColor: 'rgba(255,255,255,0.88)', borderRadius: '16px', padding: '2rem', maxWidth: '360px' }}>
                  <IonIcon icon={checkmarkCircleOutline} style={{ fontSize: '5rem', color: '#2dd36f' }} />
                  <h2 style={{ color: '#2dd36f', margin: '0.75rem 0 0.25rem' }}>Machine Connected</h2>
                  <p style={{ color: '#666', fontSize: '0.95rem' }}>
                    ESP32 is online. Select a therapist and patient, add session notes, then press <strong>PREPARE</strong> to begin.
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
                <div style={{ width: '100%' }}>
                  <h3 style={{ textAlign: 'center', marginBottom: '1.5rem', color: '#555' }}>
                    Preparing… waiting for water level and temperature
                  </h3>
                  <div style={{ display: 'flex', justifyContent: 'space-around', alignItems: 'center' }}>
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
                      <div style={{ width: '80px', height: '180px', border: '2px solid #ccc', borderRadius: '4px', margin: '0 auto', position: 'relative', backgroundColor: '#f9f9f9' }}>
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
                </div>
              )}
              {state === 'IDLE' && (
                <div style={{ textAlign: 'center' }}>
                  <h2 style={{ color: '#2dd36f' }}>System Ready</h2>
                  <p style={{ color: '#666' }}>Water level and temperature reached. Select therapist, patient, add notes and press START.</p>
                  <div style={{ display: 'flex', justifyContent: 'center', gap: '2rem', marginTop: '1rem' }}>
                    <div style={{ textAlign: 'center' }}>
                      <span style={{ fontSize: '1.8rem', fontWeight: 700, color: '#2dd36f' }}>{machineInfo ? `${machineInfo.temp}°C` : '—'}</span>
                      <p style={{ fontSize: '0.8rem', color: '#888', margin: 0 }}>Temperature</p>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <span style={{ fontSize: '1.8rem', fontWeight: 700, color: '#2dd36f' }}>✓</span>
                      <p style={{ fontSize: '0.8rem', color: '#888', margin: 0 }}>Water Level</p>
                    </div>
                  </div>
                </div>
              )}
              {state === 'ACTIVE' && (
                <div style={{ width: '100%', height: '40%', backgroundColor: '#e0f7fa', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', border: '5px solid #2dd36f' }}>
                  <h2 style={{ color: '#00838f' }}>Active Therapy</h2>
                  {machineInfo && (
                    <p style={{ color: '#00838f', fontSize: '1.1rem' }}>Temp: {machineInfo.temp}°C</p>
                  )}
                </div>
              )}
              {state === 'PAUSED' && (
                <div style={{ width: '100%', height: '40%', backgroundColor: '#fff8e1', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '5px solid #ffc409' }}>
                  <h2 style={{ color: '#b28900' }}>Session Paused</h2>
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
            <IonLabel position="floating">First Name *</IonLabel>
            <IonInput className="ion-padding-top" value={tFirstName} onIonChange={(e) => setTFirstName(e.detail.value || '')} />
          </IonItem>
          <IonItem>
            <IonLabel position="floating">Last Name *</IonLabel>
            <IonInput className="ion-padding-top" value={tLastName} onIonChange={(e) => setTLastName(e.detail.value || '')} />
          </IonItem>
          <IonItem>
            <IonLabel position="floating">Phone *</IonLabel>
            <IonInput className="ion-padding-top" type="tel" value={tPhone} onIonChange={(e) => setTPhone(e.detail.value || '')} />
          </IonItem>
          <IonItem>
            <IonLabel position="floating">Email *</IonLabel>
            <IonInput className="ion-padding-top" type="email" value={tEmail} onIonChange={(e) => setTEmail(e.detail.value || '')} />
          </IonItem>
          <IonItem>
            <IonLabel>Gender</IonLabel>
            <IonSelect value={tGender} onIonChange={(e) => setTGender(e.detail.value)} placeholder="Select...">
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
            <IonLabel position="floating">First Name *</IonLabel>
            <IonInput className="ion-padding-top" value={pFirstName} onIonChange={(e) => setPFirstName(e.detail.value || '')} />
          </IonItem>
          <IonItem>
            <IonLabel position="floating">Last Name *</IonLabel>
            <IonInput className="ion-padding-top" value={pLastName} onIonChange={(e) => setPLastName(e.detail.value || '')} />
          </IonItem>
          <IonItem>
            <IonLabel position="floating">Phone *</IonLabel>
            <IonInput className="ion-padding-top" type="tel" value={pPhone} onIonChange={(e) => setPPhone(e.detail.value || '')} />
          </IonItem>
          <IonItem>
            <IonLabel position="floating">Email *</IonLabel>
            <IonInput className="ion-padding-top" type="email" value={pEmail} onIonChange={(e) => setPEmail(e.detail.value || '')} />
          </IonItem>
          <IonItem>
            <IonLabel>Gender</IonLabel>
            <IonSelect value={pGender} onIonChange={(e) => setPGender(e.detail.value)} placeholder="Select...">
              {genderOptions}
            </IonSelect>
          </IonItem>
          <IonItem>
            <IonLabel position="floating">Date of Birth</IonLabel>
            <IonInput ref={refPatientDob} onClick={() => refPatientDob.current?.showPicker()} className="ion-padding-top" type="date" value={pDob} onIonChange={(e) => setPDob(e.detail.value || '')} />
          </IonItem>
          <IonItem>
            <IonLabel position="stacked">Notes</IonLabel>
            <IonTextarea rows={3} value={pNotes} onIonChange={(e) => setPNotes(e.detail.value || '')} />
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
                <IonLabel position="floating">First Name *</IonLabel>
                <IonInput className="ion-padding-top" value={etFirstName} onIonChange={(e) => setEtFirstName(e.detail.value || '')} />
              </IonItem>
              <IonItem>
                <IonLabel position="floating">Last Name *</IonLabel>
                <IonInput className="ion-padding-top" value={etLastName} onIonChange={(e) => setEtLastName(e.detail.value || '')} />
              </IonItem>
              <IonItem>
                <IonLabel position="floating">Phone *</IonLabel>
                <IonInput className="ion-padding-top" type="tel" value={etPhone} onIonChange={(e) => setEtPhone(e.detail.value || '')} />
              </IonItem>
              <IonItem>
                <IonLabel position="floating">Email *</IonLabel>
                <IonInput className="ion-padding-top" type="email" value={etEmail} onIonChange={(e) => setEtEmail(e.detail.value || '')} />
              </IonItem>
              <IonItem>
                <IonLabel>Gender</IonLabel>
                <IonSelect value={etGender} onIonChange={(e) => setEtGender(e.detail.value)} placeholder="Select...">
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
                      <th style={thStyle}>Total Sessions</th>
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
                <IonLabel position="floating">First Name *</IonLabel>
                <IonInput className="ion-padding-top" value={epFirstName} onIonChange={(e) => setEpFirstName(e.detail.value || '')} />
              </IonItem>
              <IonItem>
                <IonLabel position="floating">Last Name *</IonLabel>
                <IonInput className="ion-padding-top" value={epLastName} onIonChange={(e) => setEpLastName(e.detail.value || '')} />
              </IonItem>
              <IonItem>
                <IonLabel position="floating">Phone *</IonLabel>
                <IonInput className="ion-padding-top" type="tel" value={epPhone} onIonChange={(e) => setEpPhone(e.detail.value || '')} />
              </IonItem>
              <IonItem>
                <IonLabel position="floating">Email *</IonLabel>
                <IonInput className="ion-padding-top" type="email" value={epEmail} onIonChange={(e) => setEpEmail(e.detail.value || '')} />
              </IonItem>
              <IonItem>
                <IonLabel>Gender</IonLabel>
                <IonSelect value={epGender} onIonChange={(e) => setEpGender(e.detail.value)} placeholder="Select...">
                  {genderOptions}
                </IonSelect>
              </IonItem>
              <IonItem>
                <IonLabel position="floating">Date of Birth</IonLabel>
                <IonInput ref={refEpDob} onClick={() => refEpDob.current?.showPicker()} className="ion-padding-top" type="date" value={epDob} onIonChange={(e) => setEpDob(e.detail.value || '')} />
              </IonItem>
              <IonItem>
                <IonLabel position="stacked">Notes</IonLabel>
                <IonTextarea rows={3} value={epNotes} onIonChange={(e) => setEpNotes(e.detail.value || '')} />
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
                      <th style={thStyle}>Date of Birth</th>
                      <th style={thStyle}>Age</th>
                      <th style={thStyle}>Total Sessions</th>
                      <th style={thStyle}>Last Session</th>
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
                          <td style={tdStyle}>{p.dob || '—'}</td>
                          <td style={{ ...tdStyle, textAlign: 'center' }}>{computeAge(p.dob)}</td>
                          <td style={{ ...tdStyle, textAlign: 'center' }}>{stats.total}</td>
                          <td style={tdStyle}>{formatDateTime(stats.last)}</td>
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
