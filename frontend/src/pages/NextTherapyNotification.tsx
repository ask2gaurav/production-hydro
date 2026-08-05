import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  IonContent, IonHeader, IonPage, IonTitle, IonToolbar, IonButton, IonIcon,
  IonSegment, IonSegmentButton, IonLabel, IonBadge, IonText,
} from '@ionic/react';
import { arrowBack, searchOutline, pencilOutline, checkmarkDoneOutline } from 'ionicons/icons';
import { useHistory } from 'react-router';
import { useStore } from '../store/useStore';
import { localDB, type LocalPatient } from '../db/localDB';

const DEFAULT_REMINDER_DAYS = 90;
const DEFAULT_LEAD_DAYS = 7;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

const thStyle: React.CSSProperties = {
  padding: '0.6rem 0.75rem', textAlign: 'left', fontWeight: 600,
  color: '#555', whiteSpace: 'nowrap', fontSize: '0.8rem',
  backgroundColor: '#f4f5f8', borderBottom: '2px solid #ddd',
};

const tdStyle: React.CSSProperties = {
  padding: '0.6rem 0.75rem', whiteSpace: 'nowrap', fontSize: '0.82rem',
  verticalAlign: 'middle', borderBottom: '1px solid #eee',
};

const cardStyle: React.CSSProperties = {
  backgroundColor: 'white',
  borderRadius: '10px',
  padding: '1rem',
  border: '1px solid #e0e0e0',
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

const inputStyle: React.CSSProperties = {
  width: '70px', padding: '0.3rem 0.5rem', border: '1px solid #ccc',
  borderRadius: '6px', fontSize: '0.88rem', textAlign: 'right', outline: 'none',
};

const formatDate = (d: Date | null): string => {
  if (!d) return '—';
  return d.toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' });
};

const startOfDay = (d: Date): Date => new Date(d.getFullYear(), d.getMonth(), d.getDate());

type DueStatus = 'Overdue' | 'Due Today' | 'Upcoming';

interface DueEntry {
  patient: LocalPatient;
  lastSession: Date;
  reminderDays: number;
  leadDays: number;
  dueDate: Date;
  status: DueStatus;
}

const NextTherapyNotification: React.FC = () => {
  const history = useHistory();
  const { machineId } = useStore();

  const [tab, setTab] = useState<'due' | 'settings'>('due');
  const [patients, setPatients] = useState<LocalPatient[]>([]);
  const [lastSessionByPatientId, setLastSessionByPatientId] = useState<Record<number, Date>>({});
  const [search, setSearch] = useState('');
  const [editingPatientId, setEditingPatientId] = useState<number | null>(null);
  const [reminderDaysDraft, setReminderDaysDraft] = useState('');
  const [leadDaysDraft, setLeadDaysDraft] = useState('');

  const [globalReminderDays, setGlobalReminderDays] = useState(DEFAULT_REMINDER_DAYS);
  const [globalLeadDays, setGlobalLeadDays] = useState(DEFAULT_LEAD_DAYS);
  const [reminderDaysInput, setReminderDaysInput] = useState(String(DEFAULT_REMINDER_DAYS));
  const [leadDaysInput, setLeadDaysInput] = useState(String(DEFAULT_LEAD_DAYS));

  const loadData = useCallback(async () => {
    const p = await localDB.patients
      .where('machine_id').equals(machineId)
      .and((r) => r.is_active !== false)
      .toArray();
    setPatients(p);

    const sessions = await localDB.sessions.where('machine_id').equals(machineId).toArray();
    const lastByPatient: Record<number, Date> = {};
    for (const s of sessions) {
      if (!s.patient_id) continue;
      const id = Number(s.patient_id);
      const st = s.start_time instanceof Date ? s.start_time : new Date(s.start_time);
      if (!lastByPatient[id] || st > lastByPatient[id]) lastByPatient[id] = st;
    }
    setLastSessionByPatientId(lastByPatient);

    const settings = await localDB.settings.get(machineId);
    const rd = settings?.next_therapy_reminder_days ?? DEFAULT_REMINDER_DAYS;
    const ld = settings?.next_therapy_alert_lead_days ?? DEFAULT_LEAD_DAYS;
    setGlobalReminderDays(rd);
    setGlobalLeadDays(ld);
    setReminderDaysInput(String(rd));
    setLeadDaysInput(String(ld));
  }, [machineId]);

  useEffect(() => { loadData(); }, [loadData]);

  const dueEntries = useMemo((): DueEntry[] => {
    const today = startOfDay(new Date());
    const entries: DueEntry[] = [];

    for (const patient of patients) {
      if (!patient.id) continue;
      const lastSession = lastSessionByPatientId[patient.id];
      if (!lastSession) continue;

      const reminderDays = patient.reminder_days_override ?? globalReminderDays;
      const leadDays = patient.alert_lead_days_override ?? globalLeadDays;
      const dueDate = startOfDay(new Date(lastSession.getTime() + reminderDays * MS_PER_DAY));
      const windowStart = startOfDay(new Date(dueDate.getTime() - leadDays * MS_PER_DAY));

      if (today < windowStart) continue;

      if (patient.last_reminded_at) {
        const remindedAt = startOfDay(new Date(patient.last_reminded_at));
        if (remindedAt >= windowStart) continue;
      }

      const status: DueStatus = dueDate < today ? 'Overdue' : dueDate.getTime() === today.getTime() ? 'Due Today' : 'Upcoming';

      entries.push({ patient, lastSession, reminderDays, leadDays, dueDate, status });
    }

    entries.sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());
    return entries;
  }, [patients, lastSessionByPatientId, globalReminderDays, globalLeadDays]);

  const filteredEntries = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return dueEntries;
    return dueEntries.filter((e) =>
      `${e.patient.first_name} ${e.patient.last_name}`.toLowerCase().includes(q) ||
      (e.patient.phone || '').toLowerCase().includes(q)
    );
  }, [dueEntries, search]);

  const statusColor = (status: DueStatus): string => {
    if (status === 'Overdue') return 'danger';
    if (status === 'Due Today') return 'warning';
    return 'primary';
  };

  const markAsReminded = async (patient: LocalPatient) => {
    if (!patient.id) return;
    await localDB.patients.update(patient.id, { last_reminded_at: new Date().toISOString() });
    await loadData();
  };

  const openOverrideEditor = (entry: DueEntry) => {
    setEditingPatientId(entry.patient.id!);
    setReminderDaysDraft(String(entry.reminderDays));
    setLeadDaysDraft(String(entry.leadDays));
  };

  const saveOverride = async (patient: LocalPatient) => {
    if (!patient.id) return;
    const reminderDays = parseInt(reminderDaysDraft, 10);
    const leadDays = parseInt(leadDaysDraft, 10);
    await localDB.patients.update(patient.id, {
      reminder_days_override: isNaN(reminderDays) ? undefined : reminderDays,
      alert_lead_days_override: isNaN(leadDays) ? undefined : leadDays,
    });
    setEditingPatientId(null);
    await loadData();
  };

  const clearOverride = async (patient: LocalPatient) => {
    if (!patient.id) return;
    await localDB.patients.update(patient.id, {
      reminder_days_override: undefined,
      alert_lead_days_override: undefined,
    });
    setEditingPatientId(null);
    await loadData();
  };

  const handleGlobalBlur = async (key: 'reminder' | 'lead') => {
    if (key === 'reminder') {
      const parsed = parseInt(reminderDaysInput, 10);
      const valid = !isNaN(parsed) && parsed > 0;
      const value = valid ? parsed : globalReminderDays;
      setReminderDaysInput(String(value));
      setGlobalReminderDays(value);
      const existing = await localDB.settings.get(machineId);
      await localDB.settings.put({ ...existing, machine_id: machineId, next_therapy_reminder_days: value });
    } else {
      const parsed = parseInt(leadDaysInput, 10);
      const valid = !isNaN(parsed) && parsed >= 0;
      const value = valid ? parsed : globalLeadDays;
      setLeadDaysInput(String(value));
      setGlobalLeadDays(value);
      const existing = await localDB.settings.get(machineId);
      await localDB.settings.put({ ...existing, machine_id: machineId, next_therapy_alert_lead_days: value });
    }
  };

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar color="primary">
          <IonTitle>Next Therapy Notification</IonTitle>
          <IonButton slot="end" color="primary" onClick={() => history.goBack()}>
            <IonIcon icon={arrowBack} />
          </IonButton>
        </IonToolbar>
      </IonHeader>
      <IonContent className="ion-padding">
        <IonSegment value={tab} onIonChange={(e) => setTab(e.detail.value as 'due' | 'settings')} style={{ marginBottom: '1rem' }}>
          <IonSegmentButton value="due">
            <IonLabel>Due List</IonLabel>
          </IonSegmentButton>
          <IonSegmentButton value="settings">
            <IonLabel>Settings</IonLabel>
          </IonSegmentButton>
        </IonSegment>

        {tab === 'due' ? (
          <div>
            <div style={{ display: 'flex', width: '50%', alignItems: 'center', gap: '0.5rem', border: '1px solid #ccc', borderRadius: '8px', padding: '0.4rem 0.75rem', backgroundColor: 'white', marginBottom: '1rem' }}>
              <IonIcon icon={searchOutline} style={{ color: '#999', flexShrink: 0 }} />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name or mobile..."
                style={{ border: 'none', outline: 'none', flex: 1, fontSize: '0.9rem' }}
              />
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={thStyle}>Name</th>
                    <th style={thStyle}>Mobile</th>
                    <th style={thStyle}>Last Session</th>
                    <th style={thStyle}>Due Date</th>
                    <th style={thStyle}>Status</th>
                    <th style={thStyle}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredEntries.length === 0 && (
                    <tr>
                      <td colSpan={6} style={{ ...tdStyle, textAlign: 'center', color: '#999', padding: '2rem' }}>
                        No patients due for a reminder today.
                      </td>
                    </tr>
                  )}
                  {filteredEntries.map((entry) => (
                    <React.Fragment key={entry.patient.id}>
                      <tr>
                        <td style={tdStyle}>{entry.patient.first_name} {entry.patient.last_name}</td>
                        <td style={tdStyle}>{entry.patient.phone}</td>
                        <td style={tdStyle}>{formatDate(entry.lastSession)}</td>
                        <td style={tdStyle}>{formatDate(entry.dueDate)}</td>
                        <td style={tdStyle}>
                          <IonBadge color={statusColor(entry.status)}>{entry.status}</IonBadge>
                        </td>
                        <td style={tdStyle}>
                          <IonIcon
                            icon={pencilOutline}
                            title="Set custom reminder days for this patient"
                            style={{ color: '#0a5c99', cursor: 'pointer', fontSize: '1.2rem', marginRight: '0.75rem' }}
                            onClick={() => openOverrideEditor(entry)}
                          />
                          <IonIcon
                            icon={checkmarkDoneOutline}
                            title="Mark as reminded"
                            style={{ color: '#2dd36f', cursor: 'pointer', fontSize: '1.2rem' }}
                            onClick={() => markAsReminded(entry.patient)}
                          />
                        </td>
                      </tr>
                      {editingPatientId === entry.patient.id && (
                        <tr>
                          <td colSpan={6} style={{ ...tdStyle, backgroundColor: '#f9f9f9' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                <span style={{ fontSize: '0.82rem', color: '#555' }}>Remind after</span>
                                <input
                                  type="number" min={1} style={inputStyle}
                                  value={reminderDaysDraft}
                                  onChange={(e) => setReminderDaysDraft(e.target.value)}
                                />
                                <span style={{ fontSize: '0.8rem', color: '#888' }}>days</span>
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                <span style={{ fontSize: '0.82rem', color: '#555' }}>Alert lead</span>
                                <input
                                  type="number" min={0} style={inputStyle}
                                  value={leadDaysDraft}
                                  onChange={(e) => setLeadDaysDraft(e.target.value)}
                                />
                                <span style={{ fontSize: '0.8rem', color: '#888' }}>days</span>
                              </div>
                              <IonButton size="small" onClick={() => saveOverride(entry.patient)}>Save</IonButton>
                              <IonButton size="small" fill="outline" onClick={() => clearOverride(entry.patient)}>Use Global Default</IonButton>
                              <IonButton size="small" fill="clear" onClick={() => setEditingPatientId(null)}>Cancel</IonButton>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div style={cardStyle}>
            <IonText color="medium"><p style={{ marginTop: 0, fontSize: '0.85rem' }}>These defaults apply to all patients unless overridden individually from the Due List.</p></IonText>
            <div style={rowStyle}>
              <span style={labelStyle}>Remind after (days since last session)</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <input
                  type="number" min={1}
                  value={reminderDaysInput}
                  onChange={(e) => setReminderDaysInput(e.target.value)}
                  onBlur={() => handleGlobalBlur('reminder')}
                  style={inputStyle}
                />
                <span style={{ fontSize: '0.8rem', color: '#888' }}>days</span>
              </div>
            </div>
            <div style={rowStyle}>
              <span style={labelStyle}>Alert lead time (days before due)</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <input
                  type="number" min={0}
                  value={leadDaysInput}
                  onChange={(e) => setLeadDaysInput(e.target.value)}
                  onBlur={() => handleGlobalBlur('lead')}
                  style={inputStyle}
                />
                <span style={{ fontSize: '0.8rem', color: '#888' }}>days</span>
              </div>
            </div>
          </div>
        )}
      </IonContent>
    </IonPage>
  );
};

export default NextTherapyNotification;
