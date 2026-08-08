import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  IonContent, IonHeader, IonPage, IonTitle, IonToolbar, IonButton, IonIcon,
  IonSegment, IonSegmentButton, IonLabel, IonBadge, IonText, IonModal,
} from '@ionic/react';
import {
  arrowBack, searchOutline, alarmOutline, checkmarkDoneOutline, paperPlaneOutline, closeOutline,
  chatbubbleOutline, logoWhatsapp, mailOutline, callOutline, createOutline, eyeOutline,
} from 'ionicons/icons';
import { useHistory } from 'react-router';
import { useStore } from '../store/useStore';
import { localDB, type LocalPatient, type LocalReminderLog } from '../db/localDB';

const DEFAULT_REMINDER_DAYS = 15;
const DEFAULT_LEAD_DAYS = 2;
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

interface DueStatusInfo {
  reminderDays: number;
  leadDays: number;
  dueDate: Date;
  windowStart: Date;
  status: DueStatus;
}

const computeDueStatus = (
  patient: LocalPatient,
  lastSession: Date,
  globalReminderDays: number,
  globalLeadDays: number
): DueStatusInfo => {
  const today = startOfDay(new Date());
  const reminderDays = patient.reminder_days_override ?? globalReminderDays;
  const leadDays = patient.alert_lead_days_override ?? globalLeadDays;
  const dueDate = startOfDay(new Date(lastSession.getTime() + reminderDays * MS_PER_DAY));
  const windowStart = startOfDay(new Date(dueDate.getTime() - leadDays * MS_PER_DAY));
  const status: DueStatus = dueDate < today ? 'Overdue' : dueDate.getTime() === today.getTime() ? 'Due Today' : 'Upcoming';
  return { reminderDays, leadDays, dueDate, windowStart, status };
};

const METHOD_LABEL: Record<'sms' | 'whatsapp' | 'email' | 'call', string> = {
  sms: 'SMS', whatsapp: 'WhatsApp', email: 'Email', call: 'Call',
};

const METHOD_ICON: Record<'sms' | 'whatsapp' | 'email' | 'call', string> = {
  sms: chatbubbleOutline, whatsapp: logoWhatsapp, email: mailOutline, call: callOutline,
};

const METHOD_COLOR: Record<'sms' | 'whatsapp' | 'email' | 'call', string> = {
  sms: '#0a5c99', whatsapp: '#25D366', email: '#eb445a', call: '#666',
};

const NextTherapyNotification: React.FC = () => {
  const history = useHistory();
  const { machineId } = useStore();

  const [tab, setTab] = useState<'due' | 'reminded' | 'settings'>('due');
  const [patients, setPatients] = useState<LocalPatient[]>([]);
  const [lastSessionByPatientId, setLastSessionByPatientId] = useState<Record<string, Date>>({});
  const [search, setSearch] = useState('');
  const [editingPatientId, setEditingPatientId] = useState<number | null>(null);
  const [reminderDaysDraft, setReminderDaysDraft] = useState('');
  const [leadDaysDraft, setLeadDaysDraft] = useState('');

  const [globalReminderDays, setGlobalReminderDays] = useState(DEFAULT_REMINDER_DAYS);
  const [globalLeadDays, setGlobalLeadDays] = useState(DEFAULT_LEAD_DAYS);
  const [reminderDaysInput, setReminderDaysInput] = useState(String(DEFAULT_REMINDER_DAYS));
  const [leadDaysInput, setLeadDaysInput] = useState(String(DEFAULT_LEAD_DAYS));

  const [messageEn, setMessageEn] = useState('');
  const [messageGu, setMessageGu] = useState('');
  const [messageHi, setMessageHi] = useState('');

  const [reminderLogs, setReminderLogs] = useState<LocalReminderLog[]>([]);
  const [editingLogId, setEditingLogId] = useState<number | null>(null);
  const [logMessageDraft, setLogMessageDraft] = useState('');
  const [viewMessageEntry, setViewMessageEntry] = useState<{ patientName: string; message: string } | null>(null);
  const [sendTarget, setSendTarget] = useState<LocalPatient | null>(null);
  const [selectedLang, setSelectedLang] = useState<'en' | 'gu' | 'hi'>('en');
  const [draftMessage, setDraftMessage] = useState('');

  const loadData = useCallback(async () => {
    const p = await localDB.patients
      .where('machine_id').equals(machineId)
      .and((r) => r.is_active !== false)
      .toArray();
    setPatients(p);

    const sessions = await localDB.sessions.where('machine_id').equals(machineId).toArray();
    const lastByPatient: Record<string, Date> = {};
    for (const s of sessions) {
      if (!s.patient_server_id) continue;
      const id = String(s.patient_server_id ?? s.patient_id);
      const st = s.start_time instanceof Date ? s.start_time : new Date(s.start_time);
      if (!lastByPatient[id] || st > lastByPatient[id]) lastByPatient[id] = st;
    }
    console.log('Last session by patient:', lastByPatient);
    setLastSessionByPatientId(lastByPatient);

    const settings = await localDB.settings.get(machineId);
    const rd = settings?.next_therapy_reminder_days ?? DEFAULT_REMINDER_DAYS;
    const ld = settings?.next_therapy_alert_lead_days ?? DEFAULT_LEAD_DAYS;
    setGlobalReminderDays(rd);
    setGlobalLeadDays(ld);
    setReminderDaysInput(String(rd));
    setLeadDaysInput(String(ld));
    setMessageEn(settings?.next_therapy_reminder_message_en ?? '');
    setMessageGu(settings?.next_therapy_reminder_message_gu ?? '');
    setMessageHi(settings?.next_therapy_reminder_message_hi ?? '');

    const logs = await localDB.reminder_logs.where('machine_id').equals(machineId).toArray();
    logs.sort((a, b) => new Date(b.sent_at).getTime() - new Date(a.sent_at).getTime());
    setReminderLogs(logs);
  }, [machineId]);

  useEffect(() => { loadData(); }, [loadData]);

  const dueEntries = useMemo((): DueEntry[] => {
    const today = startOfDay(new Date());
    const entries: DueEntry[] = [];
    for (const patient of patients) {
      if (!patient.server_id) continue;
      const lastSession = lastSessionByPatientId[patient.server_id];
      if (!lastSession) continue;

      const { reminderDays, leadDays, dueDate, windowStart, status } = computeDueStatus(patient, lastSession, globalReminderDays, globalLeadDays);

      if (today < windowStart) continue;

      if (patient.last_reminded_at) {
        const remindedAt = startOfDay(new Date(patient.last_reminded_at));
        if (remindedAt >= windowStart) continue;
      }

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

  const patientsById = useMemo(() => {
    const map: Record<number, LocalPatient> = {};
    for (const p of patients) if (p.id) map[p.id] = p;
    return map;
  }, [patients]);

  const remindedEntries = useMemo(() => {
    return reminderLogs
      .map((log) => {
        const patient = log.patient_id ? patientsById[log.patient_id] : undefined;
        if (!patient) return null;
        const lastSession = patient.server_id ? lastSessionByPatientId[patient.server_id] : undefined;
        const dueInfo = lastSession ? computeDueStatus(patient, lastSession, globalReminderDays, globalLeadDays) : undefined;
        const reminderDays = dueInfo?.reminderDays ?? patient.reminder_days_override ?? globalReminderDays;
        const leadDays = dueInfo?.leadDays ?? patient.alert_lead_days_override ?? globalLeadDays;
        return { log, patient, lastSession, status: dueInfo?.status, reminderDays, leadDays };
      })
      .filter((e): e is { log: LocalReminderLog; patient: LocalPatient; lastSession: Date | undefined; status: DueStatus | undefined; reminderDays: number; leadDays: number } => e !== null);
  }, [reminderLogs, patientsById, lastSessionByPatientId, globalReminderDays, globalLeadDays]);

  const filteredRemindedEntries = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return remindedEntries;
    return remindedEntries.filter((e) =>
      `${e.patient.first_name} ${e.patient.last_name}`.toLowerCase().includes(q) ||
      (e.patient.phone || '').toLowerCase().includes(q)
    );
  }, [remindedEntries, search]);

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

  const openSendModal = (patient: LocalPatient, presetLang?: 'en' | 'gu' | 'hi', presetMessage?: string) => {
    const lang = presetLang ?? 'en';
    setSendTarget(patient);
    setSelectedLang(lang);
    setDraftMessage(presetMessage ?? (lang === 'en' ? messageEn : lang === 'gu' ? messageGu : messageHi));
  };

  const closeSendModal = () => {
    setSendTarget(null);
    setDraftMessage('');
  };

  const selectTemplate = (lang: 'en' | 'gu' | 'hi') => {
    setSelectedLang(lang);
    setDraftMessage(lang === 'en' ? messageEn : lang === 'gu' ? messageGu : messageHi);
  };

  const sendVia = async (method: 'sms' | 'whatsapp' | 'email' | 'call') => {
    const patient = sendTarget;
    if (!patient) return;

    const phone = (patient.phone || '').trim();
    const digitsOnlyPhone = phone.replace(/[^\d]/g, '');
    let url = '';
    if (method === 'sms') {
      url = `sms:${phone}?body=${encodeURIComponent(draftMessage)}`;
    } else if (method === 'whatsapp') {
      url = `https://wa.me/${digitsOnlyPhone}?text=${encodeURIComponent(draftMessage)}`;
    } else if (method === 'email') {
      url = `mailto:${patient.email || ''}?subject=${encodeURIComponent('Next Therapy Reminder')}&body=${encodeURIComponent(draftMessage)}`;
    } else {
      url = `tel:${phone}`;
    }
    window.open(url, '_self');

    await localDB.reminder_logs.add({
      machine_id: machineId,
      patient_id: patient.id,
      patient_server_id: patient.server_id,
      method,
      language: selectedLang,
      message: method === 'call' ? undefined : draftMessage,
      sent_at: new Date().toISOString(),
    });

    if (patient.id) {
      await localDB.patients.update(patient.id, { last_reminded_at: new Date().toISOString() });
    }

    closeSendModal();
    await loadData();
  };

  const openLogMessageEditor = (log: LocalReminderLog) => {
    setEditingLogId(log.id!);
    setLogMessageDraft(log.message ?? '');
  };

  const saveLogMessage = async (log: LocalReminderLog) => {
    if (!log.id) return;
    await localDB.reminder_logs.update(log.id, { message: logMessageDraft.trim() || undefined });
    setEditingLogId(null);
    await loadData();
  };

  const openOverrideEditor = (patient: LocalPatient, reminderDays: number, leadDays: number) => {
    setEditingPatientId(patient.id!);
    setReminderDaysDraft(String(reminderDays));
    setLeadDaysDraft(String(leadDays));
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

  const handleMessageBlur = async (lang: 'en' | 'gu' | 'hi') => {
    const value = lang === 'en' ? messageEn : lang === 'gu' ? messageGu : messageHi;
    const existing = await localDB.settings.get(machineId);
    const key = lang === 'en' ? 'next_therapy_reminder_message_en' : lang === 'gu' ? 'next_therapy_reminder_message_gu' : 'next_therapy_reminder_message_hi';
    await localDB.settings.put({ ...existing, machine_id: machineId, [key]: value });
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
        <IonSegment value={tab} onIonChange={(e) => setTab(e.detail.value as 'due' | 'reminded' | 'settings')} style={{ marginBottom: '1rem' }}>
          <IonSegmentButton value="due">
            <IonLabel>Due List</IonLabel>
          </IonSegmentButton>
          <IonSegmentButton value="reminded">
            <IonLabel>Reminded</IonLabel>
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
                            icon={alarmOutline}
                            title="Set custom reminder days for this patient"
                            style={{ color: '#0a5c99', cursor: 'pointer', fontSize: '1.2rem', marginRight: '0.75rem' }}
                            onClick={() => openOverrideEditor(entry.patient, entry.reminderDays, entry.leadDays)}
                          />
                          <IonIcon
                            icon={paperPlaneOutline}
                            title="Send reminder"
                            style={{ color: '#0a5c99', cursor: 'pointer', fontSize: '1.2rem', marginRight: '0.75rem' }}
                            onClick={() => openSendModal(entry.patient)}
                          />
                          <IonIcon
                            icon={checkmarkDoneOutline}
                            title="Mark as reminded"
                            style={{display:'none', color: '#2dd36f', cursor: 'pointer', fontSize: '1.2rem' }}
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
        ) : tab === 'reminded' ? (
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
                    <th style={thStyle}>Method</th>
                    <th style={thStyle}>Message</th>
                    <th style={thStyle}>Sent On</th>
                    <th style={thStyle}>Current Status</th>
                    <th style={thStyle}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRemindedEntries.length === 0 && (
                    <tr>
                      <td colSpan={7} style={{ ...tdStyle, textAlign: 'center', color: '#999', padding: '2rem' }}>
                        No reminders have been sent yet.
                      </td>
                    </tr>
                  )}
                  {filteredRemindedEntries.map((entry) => (
                    <React.Fragment key={entry.log.id}>
                      <tr>
                        <td style={tdStyle}>{entry.patient.first_name} {entry.patient.last_name}</td>
                        <td style={tdStyle}>{entry.patient.phone}</td>
                        <td style={tdStyle}>
                          <IonIcon
                            icon={METHOD_ICON[entry.log.method]}
                            title={METHOD_LABEL[entry.log.method]}
                            style={{ color: METHOD_COLOR[entry.log.method], fontSize: '1.2rem' }}
                          />
                        </td>
                        <td style={{ ...tdStyle, maxWidth: '220px', overflow: 'hidden', textOverflow: 'ellipsis' }} title={entry.log.message || ''}>
                          {entry.log.message ? (entry.log.message.length > 40 ? `${entry.log.message.slice(0, 40)}…` : entry.log.message) : '—'}
                          {entry.log.message && (
                            <IonIcon
                              icon={eyeOutline}
                              title="View full message"
                              style={{ color: '#0a5c99', cursor: 'pointer', fontSize: '1.1rem', marginLeft: '0.5rem', verticalAlign: 'middle' }}
                              onClick={() => setViewMessageEntry({ patientName: `${entry.patient.first_name} ${entry.patient.last_name}`, message: entry.log.message! })}
                            />
                          )}
                          {entry.log.method === 'call' && (
                            <IonIcon
                              icon={createOutline}
                              title="Edit call notes"
                              style={{ color: '#0a5c99', cursor: 'pointer', fontSize: '1.1rem', marginLeft: '0.5rem', verticalAlign: 'middle' }}
                              onClick={() => openLogMessageEditor(entry.log)}
                            />
                          )}
                        </td>
                        <td style={tdStyle}>{formatDate(new Date(entry.log.sent_at))}</td>
                        <td style={tdStyle}>
                          {entry.status ? <IonBadge color={statusColor(entry.status)}>{entry.status}</IonBadge> : '—'}
                        </td>
                        <td style={tdStyle}>
                          {entry.log.message && (
                            <IonIcon
                              icon={eyeOutline}
                              title="View full message"
                              style={{ color: '#0a5c99', cursor: 'pointer', fontSize: '1.2rem', marginRight: '0.75rem' }}
                              onClick={() => setViewMessageEntry({ patientName: `${entry.patient.first_name} ${entry.patient.last_name}`, message: entry.log.message! })}
                            />
                          )}
                          <IonIcon
                            icon={alarmOutline}
                            title="Set custom reminder days for this patient"
                            style={{ color: '#0a5c99', cursor: 'pointer', fontSize: '1.2rem', marginRight: '0.75rem' }}
                            onClick={() => openOverrideEditor(entry.patient, entry.reminderDays, entry.leadDays)}
                          />
                          {entry.status ? (
                            <IonIcon
                              icon={paperPlaneOutline}
                              title="Resend reminder"
                              style={{ color: '#0a5c99', cursor: 'pointer', fontSize: '1.2rem' }}
                              onClick={() => openSendModal(entry.patient, entry.log.language, entry.log.message)}
                            />
                          ) : null}
                        </td>
                      </tr>
                      {editingPatientId === entry.patient.id && (
                        <tr>
                          <td colSpan={7} style={{ ...tdStyle, backgroundColor: '#f9f9f9' }}>
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
                      {editingLogId === entry.log.id && (
                        <tr>
                          <td colSpan={7} style={{ ...tdStyle, backgroundColor: '#f9f9f9' }}>
                            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', flexWrap: 'wrap' }}>
                              <textarea
                                value={logMessageDraft}
                                onChange={(e) => setLogMessageDraft(e.target.value)}
                                rows={2}
                                placeholder="Add call notes..."
                                style={{ flex: 1, minWidth: '220px', padding: '0.4rem 0.6rem', border: '1px solid #ccc', borderRadius: '6px', fontSize: '0.85rem', outline: 'none', resize: 'vertical', fontFamily: 'inherit' }}
                              />
                              <div style={{ display: 'flex', gap: '0.5rem' }}>
                                <IonButton size="small" onClick={() => saveLogMessage(entry.log)}>Save</IonButton>
                                <IonButton size="small" fill="clear" onClick={() => setEditingLogId(null)}>Cancel</IonButton>
                              </div>
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

            <div style={{ marginTop: '1.25rem', paddingTop: '1rem', borderTop: '1px solid #eee' }}>
              <IonText color="medium"><p style={{ marginTop: 0, fontSize: '0.85rem' }}>Default reminder message shown/sent to patients, per language.</p></IonText>

              <div style={{ marginBottom: '1rem' }}>
                <div style={{ ...labelStyle, marginBottom: '0.35rem' }}>English</div>
                <textarea
                  value={messageEn}
                  onChange={(e) => setMessageEn(e.target.value)}
                  onBlur={() => handleMessageBlur('en')}
                  rows={3}
                  placeholder="e.g. Your next therapy session is due. Please book your appointment."
                  style={{ width: '100%', padding: '0.5rem 0.65rem', border: '1px solid #ccc', borderRadius: '6px', fontSize: '0.88rem', outline: 'none', resize: 'vertical', fontFamily: 'inherit' }}
                />
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <div style={{ ...labelStyle, marginBottom: '0.35rem' }}>Gujarati</div>
                <textarea
                  value={messageGu}
                  onChange={(e) => setMessageGu(e.target.value)}
                  onBlur={() => handleMessageBlur('gu')}
                  rows={3}
                  placeholder="દા.ત. તમારું આગામી થેરાપી સેશન બાકી છે. કૃપા કરી એપોઈન્ટમેન્ટ બુક કરો."
                  style={{ width: '100%', padding: '0.5rem 0.65rem', border: '1px solid #ccc', borderRadius: '6px', fontSize: '0.88rem', outline: 'none', resize: 'vertical', fontFamily: 'inherit' }}
                />
              </div>

              <div>
                <div style={{ ...labelStyle, marginBottom: '0.35rem' }}>Hindi</div>
                <textarea
                  value={messageHi}
                  onChange={(e) => setMessageHi(e.target.value)}
                  onBlur={() => handleMessageBlur('hi')}
                  rows={3}
                  placeholder="उदा. आपका अगला थेरेपी सेशन बाकी है। कृपया अपॉइंटमेंट बुक करें।"
                  style={{ width: '100%', padding: '0.5rem 0.65rem', border: '1px solid #ccc', borderRadius: '6px', fontSize: '0.88rem', outline: 'none', resize: 'vertical', fontFamily: 'inherit' }}
                />
              </div>
            </div>
          </div>
        )}
      </IonContent>

      <IonModal isOpen={!!sendTarget} onDidDismiss={closeSendModal} style={{ '--width': '520px', '--height': '500px ', '--border-radius': '12px' } as React.CSSProperties}>
        <IonHeader>
          <IonToolbar color="primary">
            <IonTitle>Send Reminder{sendTarget ? ` — ${sendTarget.first_name} ${sendTarget.last_name}` : ''}</IonTitle>
            <IonButton slot="end" fill="clear" color="light" onClick={closeSendModal}>
              <IonIcon icon={closeOutline} />
            </IonButton>
          </IonToolbar>
        </IonHeader>
        <IonContent className="ion-padding">
          <div style={{ marginBottom: '1rem' }}>
            <div style={{ ...labelStyle, marginBottom: '0.5rem' }}>Template</div>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              <IonButton size="small" fill={selectedLang === 'en' ? 'solid' : 'outline'} onClick={() => selectTemplate('en')}>English</IonButton>
              <IonButton size="small" fill={selectedLang === 'gu' ? 'solid' : 'outline'} onClick={() => selectTemplate('gu')}>Gujarati</IonButton>
              <IonButton size="small" fill={selectedLang === 'hi' ? 'solid' : 'outline'} onClick={() => selectTemplate('hi')}>Hindi</IonButton>
            </div>
          </div>

          <div style={{ marginBottom: '1.25rem' }}>
            <div style={{ ...labelStyle, marginBottom: '0.5rem' }}>Message</div>
            <textarea
              value={draftMessage}
              onChange={(e) => setDraftMessage(e.target.value)}
              rows={5}
              style={{ width: '100%', padding: '0.5rem 0.65rem', border: '1px solid #ccc', borderRadius: '6px', fontSize: '0.88rem', outline: 'none', resize: 'vertical', fontFamily: 'inherit' }}
            />
          </div>

          <div style={{ ...labelStyle, marginBottom: '0.5rem' }}>Send via</div>
          <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
            <IonButton fill="outline" onClick={() => sendVia('sms')}>
              <IonIcon icon={chatbubbleOutline} slot="start" /> SMS
            </IonButton>
            <IonButton fill="outline" onClick={() => sendVia('whatsapp')}>
              <IonIcon icon={logoWhatsapp} slot="start" /> WhatsApp
            </IonButton>
            <IonButton fill="outline" onClick={() => sendVia('email')}>
              <IonIcon icon={mailOutline} slot="start" /> Email
            </IonButton>
            <IonButton fill="outline" onClick={() => sendVia('call')}>
              <IonIcon icon={callOutline} slot="start" /> Call
            </IonButton>
          </div>
        </IonContent>
      </IonModal>

      <IonModal isOpen={!!viewMessageEntry} onDidDismiss={() => setViewMessageEntry(null)} style={{ '--width': '460px', '--height': '340px', '--border-radius': '12px' } as React.CSSProperties}>
        <IonHeader>
          <IonToolbar color="primary">
            <IonTitle>Message{viewMessageEntry ? ` — ${viewMessageEntry.patientName}` : ''}</IonTitle>
            <IonButton slot="end" fill="clear" color="light" onClick={() => setViewMessageEntry(null)}>
              <IonIcon icon={closeOutline} />
            </IonButton>
          </IonToolbar>
        </IonHeader>
        <IonContent className="ion-padding">
          <p style={{ whiteSpace: 'pre-wrap', fontSize: '0.92rem', color: '#333', lineHeight: 1.5 }}>
            {viewMessageEntry?.message}
          </p>
        </IonContent>
      </IonModal>
    </IonPage>
  );
};

export default NextTherapyNotification;
