import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  IonContent, IonIcon, IonHeader, IonPage, IonTitle, IonToolbar,
  IonGrid, IonRow, IonCol, IonButton, IonBadge, IonProgressBar,
  IonModal, IonItem, IonLabel, IonInput, IonTextarea, IonSpinner,
  IonText
} from '@ionic/react';
import { arrowBack, addOutline, personOutline, personCircleOutline } from 'ionicons/icons';
import { useStore } from '../store/useStore';
import { localDB, type LocalTherapist, type LocalPatient } from '../db/localDB';
import { runSync } from '../services/syncService';

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

type SessionState = 'IDLE' | 'PREPARING' | 'ACTIVE' | 'PAUSED';
//get the session duration from settings in localDB and use it here instead of hardcoding 40 minutes  
//const TOTAL_SECONDS = 40 * 60;
const TOTAL_SECONDS = 2 * 60;

const Therapy: React.FC = () => {
  const { modeStatus, machineId } = useStore();
  const [state, setState] = useState<SessionState>('IDLE');
  const [timeLeft, setTimeLeft] = useState(TOTAL_SECONDS);
  const [sessionError, setSessionError] = useState('');

  const [therapists, setTherapists] = useState<LocalTherapist[]>([]);
  const [patients, setPatients] = useState<LocalPatient[]>([]);
  const [selectedTherapistId, setSelectedTherapistId] = useState<number | null>(null);
  const [selectedPatientId, setSelectedPatientId] = useState<number | null>(null);
  const [sessionNotes, setSessionNotes] = useState('');

  // Local DB id of the active session record
  const activeSessionLocalId = useRef<number | null>(null);
  const sessionStartTime = useRef<Date | null>(null);

  // Add therapist modal
  const [showAddTherapist, setShowAddTherapist] = useState(false);
  const [tFirstName, setTFirstName] = useState('');
  const [tLastName, setTLastName] = useState('');
  const [tPhone, setTPhone] = useState('');
  const [tEmail, setTEmail] = useState('');
  const [tSaving, setTSaving] = useState(false);
  const [tError, setTError] = useState('');

  // Add patient modal
  const [showAddPatient, setShowAddPatient] = useState(false);
  const [pFirstName, setPFirstName] = useState('');
  const [pLastName, setPLastName] = useState('');
  const [pPhone, setPPhone] = useState('');
  const [pEmail, setPEmail] = useState('');
  const [pDob, setPDob] = useState('');
  const [pNotes, setPNotes] = useState('');
  const [pSaving, setPSaving] = useState(false);
  const [pError, setPError] = useState('');

  const isLocked = state === 'ACTIVE' || state === 'PAUSED';

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

  useEffect(() => {
    if (!machineId) return;
    loadLocal();
    console.log('Checking for pending sync on boot...', machineId);
    runSync(machineId).then(loadLocal);

    const handleOnline = () => runSync(machineId).then(loadLocal);
    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, [machineId, loadLocal]);

  // ---------- Session lifecycle ----------

  const endSession = useCallback(async () => {
    const now = new Date();
    const elapsed = TOTAL_SECONDS - timeLeft;
    const duration = Math.round(elapsed / 60);

    if (activeSessionLocalId.current !== null) {
      await localDB.sessions.update(activeSessionLocalId.current, {
        end_time: now,
        duration_minutes: duration,
        status: 'completed',
        synced: 0,
      });
      runSync(machineId);
    }

    // Reset all state
    activeSessionLocalId.current = null;
    sessionStartTime.current = null;
    setState('IDLE');
    setTimeLeft(TOTAL_SECONDS);
    setSelectedTherapistId(null);
    setSelectedPatientId(null);
    setSessionNotes('');
    setSessionError('');
  }, [timeLeft, machineId]);

  // Timer — only ticks when ACTIVE
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
      therapist_id: therapist?.server_id ?? String(selectedTherapistId),
      patient_id: patient?.server_id ?? String(selectedPatientId),
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

    // Sync in background — therapist/patient first, then session
    runSync(machineId);
  };

  const handlePauseResume = () => {
    setState((s) => (s === 'ACTIVE' ? 'PAUSED' : 'ACTIVE'));
  };

  // ---------- Add therapist ----------

  const openAddTherapist = () => {
    setTFirstName(''); setTLastName(''); setTPhone(''); setTEmail(''); setTError('');
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
    setPFirstName(''); setPLastName(''); setPPhone(''); setPEmail(''); setPDob(''); setPNotes(''); setPError('');
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

  const refPatientDob = useRef<HTMLDivElement>(null);

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar color="primary">
          <IonTitle>Therapy Session</IonTitle>
          {modeStatus && modeStatus.mode === 'demo' && (
            <IonBadge color="warning" slot="end" style={{ marginRight: '1rem' }}>
              DEMO MODE: {modeStatus.sessions_remaining} sessions left
            </IonBadge>
          )}
          <IonButton color="tertiary" slot="end" style={{ marginRight: '1rem' }} onClick={() => history.back()}>
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
                <IonProgressBar value={1 - (timeLeft / TOTAL_SECONDS)} color="primary" />
                <small>40 min</small>
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <label style={{ fontSize: '0.85rem', fontWeight: 600, color: '#555' }}>Therapist</label>
                <div style={{ marginTop: '0.4rem' }}>
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
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <label style={{ fontSize: '0.85rem', fontWeight: 600, color: '#555' }}>Patient</label>
                <div style={{ marginTop: '0.4rem' }}>
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
                  <IonButton expand="block" color="warning" onClick={() => setState('PREPARING')} disabled={state !== 'IDLE'}>
                    PREPARE
                  </IonButton>
                </IonCol>
                <IonCol>
                  {state === 'ACTIVE' || state === 'PAUSED' ? (
                    <IonButton expand="block" color={state === 'ACTIVE' ? 'warning' : 'success'} onClick={handlePauseResume}>
                      {state === 'ACTIVE' ? 'PAUSE' : 'RESUME'}
                    </IonButton>
                  ) : (
                    <IonButton expand="block" color="success" onClick={handleStart} disabled={state !== 'PREPARING'}>
                      START
                    </IonButton>
                  )}
                </IonCol>
              </IonRow>
              <IonRow>
                <IonCol>
                  <IonButton expand="block" color="medium" onClick={endSession} disabled={state === 'IDLE'}>
                    END THERAPY
                  </IonButton>
                </IonCol>
                <IonCol>
                  <IonButton expand="block" color="danger">FLUSH</IonButton>
                </IonCol>
              </IonRow>
            </IonCol>

            {/* Right panel */}
            <IonCol size="7" style={{ backgroundColor: '#f4f5f8', display: 'flex', flexWrap: 'wrap', justifyContent: 'center', alignItems: 'center', padding: '2rem' }}>
              {state === 'IDLE' && (
                <div style={{ textAlign: 'center' }}>
                  <h2 style={{ color: '#999' }}>System Ready - Idle</h2>
                  <div style={{ width: '200px', height: '200px', backgroundColor: '#eef5f9', borderRadius: '50%', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>[GIF]</div>
                </div>
              )}
              {state === 'PREPARING' && (
                <div style={{ width: '100%', display: 'flex', justifyContent: 'space-around' }}>
                  <div style={{ textAlign: 'center' }}>
                    <h3>Water Temperature (°C)</h3>
                    <div style={{ width: '150px', height: '150px', border: '10px solid #2dd36f', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2rem' }}>36°</div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <h3>Water Level (%)</h3>
                    <div style={{ width: '100px', height: '200px', border: '2px solid #ccc', margin: '0 auto', position: 'relative' }}>
                      <div style={{ position: 'absolute', bottom: 0, width: '100%', height: '70%', backgroundColor: '#3880ff' }} />
                    </div>
                  </div>
                </div>
              )}
              {state === 'ACTIVE' && (
                <div style={{ width: '100%', height: '100%', backgroundColor: '#e0f7fa', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '5px solid #2dd36f' }}>
                  <h2 style={{ color: '#00838f' }}>Active Therapy Visualization...</h2>
                </div>
              )}
              {state === 'PAUSED' && (
                <div style={{ width: '100%', height: '100%', backgroundColor: '#fff8e1', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '5px solid #ffc409' }}>
                  <h2 style={{ color: '#b28900' }}>Session Paused</h2>
                </div>
              )}
            </IonCol>
          </IonRow>
        </IonGrid>
      </IonContent>

      {/* Add Therapist Modal */}
      <IonModal isOpen={showAddTherapist} onDidDismiss={() => setShowAddTherapist(false)}>
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
          {tError && (
            <IonText color="danger"><p style={{ padding: '0.5rem 1rem', margin: 0 }}>{tError}</p></IonText>
          )}
          <IonButton expand="block" style={{ marginTop: '1.5rem' }} onClick={saveTherapist} disabled={tSaving}>
            {tSaving ? <IonSpinner name="crescent" /> : 'Save Therapist'}
          </IonButton>
        </IonContent>
      </IonModal>

      {/* Add Patient Modal */}
      <IonModal isOpen={showAddPatient} onDidDismiss={() => setShowAddPatient(false)}>
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
            <IonLabel position="floating">Date of Birth</IonLabel>
            <IonInput ref={refPatientDob} className="ion-padding-top" onClick={() => refPatientDob.current?.showDatePicker()}   type="date" value={pDob} onIonChange={(e) => setPDob(e.detail.value || '')} />
            <IonIcon name="calendarOutline" slot="end"></IonIcon>
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
    </IonPage>
  );
};

export default Therapy;
