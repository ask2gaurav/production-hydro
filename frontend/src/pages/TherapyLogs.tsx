import React, { useState, useEffect, useCallback } from 'react';
import {
  IonContent, IonHeader, IonPage, IonTitle, IonToolbar,
  IonButton, IonIcon, IonSpinner, IonBadge
} from '@ionic/react';
import { arrowBack, searchOutline } from 'ionicons/icons';
import { useStore } from '../store/useStore';
import { localDB, type LocalSession, type LocalTherapist, type LocalPatient } from '../db/localDB';

type EnrichedSession = LocalSession & {
  patientName: string;
  therapistName: string;
};

const STATUS_COLOR: Record<string, string> = {
  completed: 'success',
  active: 'warning',
  paused: 'warning',
};

const formatDate = (d: Date): string =>
  new Date(d).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });

const formatTime = (d: Date): string =>
  new Date(d).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });

const thStyle: React.CSSProperties = {
  padding: '0.65rem 1rem', textAlign: 'left', fontWeight: 600,
  color: '#555', whiteSpace: 'nowrap', fontSize: '0.82rem',
  backgroundColor: '#f4f5f8', borderBottom: '2px solid #ddd',
};

const tdStyle: React.CSSProperties = {
  padding: '0.65rem 1rem', fontSize: '0.85rem',
  verticalAlign: 'middle', borderBottom: '1px solid #eee', color: '#333',
};

const TherapyLogs: React.FC = () => {
  const { machineId } = useStore();

  const [sessions, setSessions] = useState<EnrichedSession[]>([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [rawSessions, therapists, patients] = await Promise.all([
        localDB.sessions.where('machine_id').equals(machineId).toArray(),
        localDB.therapists.where('machine_id').equals(machineId).toArray(),
        localDB.patients.where('machine_id').equals(machineId).toArray(),
      ]);

      const findTherapist = (id?: string): LocalTherapist | undefined => {
        if (!id) return undefined;
        return therapists.find((t) => t.server_id === id || String(t.id) === id);
      };

      const findPatient = (id?: string): LocalPatient | undefined => {
        if (!id) return undefined;
        return patients.find((p) => p.server_id === id || String(p.id) === id);
      };

      const enriched: EnrichedSession[] = rawSessions
        .map((s) => {
          const t = findTherapist(s.therapist_id);
          const p = findPatient(s.patient_id);
          return {
            ...s,
            therapistName: t ? `${t.first_name} ${t.last_name}` : '—',
            patientName: p ? `${p.first_name} ${p.last_name}` : '—',
          };
        })
        .sort((a, b) => new Date(b.start_time).getTime() - new Date(a.start_time).getTime());

      setSessions(enriched);
    } finally {
      setLoading(false);
    }
  }, [machineId]);

  useEffect(() => {
    if (!machineId) return;
    loadData();
  }, [machineId, loadData]);

  const filtered = sessions.filter((s) => {
    const start = new Date(s.start_time);

    if (fromDate) {
      const from = new Date(fromDate);
      from.setHours(0, 0, 0, 0);
      if (start < from) return false;
    }

    if (toDate) {
      const to = new Date(toDate);
      to.setHours(23, 59, 59, 999);
      if (start > to) return false;
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      const haystack = `${s.patientName} ${s.therapistName}`.toLowerCase();
      if (!haystack.includes(q)) return false;
    }

    return true;
  });

  const handleExport = () => {
    alert('Export to PDF triggered');
  };

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar color="primary">
          <IonTitle>Therapy Logs</IonTitle>
          {/* <IonButton slot="end" onClick={handleExport} fill="clear" color="light">Export PDF</IonButton> */}
          <IonButton color="primary" slot="end" style={{ marginRight: '1rem' }} onClick={() => history.back()}>
              <IonIcon icon={arrowBack} />
            </IonButton>
        </IonToolbar>
      </IonHeader>

      <IonContent className="ion-padding">
        {/* Filters */}
        <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.25rem', flexWrap: 'wrap', alignItems: 'center' }}>
          {/* Search */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', border: '1px solid #ccc', borderRadius: '8px', padding: '0.4rem 0.75rem', backgroundColor: 'white', flex: '1 1 220px' }}>
            <IonIcon icon={searchOutline} style={{ color: '#999', flexShrink: 0 }} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by patient or therapist name..."
              style={{ border: 'none', outline: 'none', flex: 1, fontSize: '0.9rem' }}
            />
          </div>

          {/* From date */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <label style={{ fontSize: '0.82rem', color: '#555', fontWeight: 600, whiteSpace: 'nowrap' }}>From</label>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              style={{ padding: '0.4rem 0.6rem', border: '1px solid #ccc', borderRadius: '8px', fontSize: '0.88rem', outline: 'none' }}
            />
          </div>

          {/* To date */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <label style={{ fontSize: '0.82rem', color: '#555', fontWeight: 600, whiteSpace: 'nowrap' }}>To</label>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              style={{ padding: '0.4rem 0.6rem', border: '1px solid #ccc', borderRadius: '8px', fontSize: '0.88rem', outline: 'none' }}
            />
          </div>

          {(search || fromDate || toDate) && (
            <button
              onClick={() => { setSearch(''); setFromDate(''); setToDate(''); }}
              style={{ padding: '0.4rem 0.75rem', border: '1px solid #ccc', borderRadius: '8px', background: 'white', cursor: 'pointer', fontSize: '0.85rem', color: '#666' }}
            >
              Clear
            </button>
          )}
        </div>

        {/* Results count */}
        <p style={{ fontSize: '0.82rem', color: '#888', marginBottom: '0.75rem' }}>
          {loading ? '' : `${filtered.length} session${filtered.length !== 1 ? 's' : ''} found`}
        </p>

        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}>
            <IonSpinner name="crescent" />
          </div>
        ) : (
          <div style={{ overflowX: 'auto', backgroundColor: 'white', borderRadius: '8px', border: '1px solid #e0e0e0' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={thStyle}>Patient Name</th>
                  <th style={thStyle}>Therapist Name</th>
                  <th style={thStyle}>Session Date</th>
                  <th style={thStyle}>Session Time</th>
                  <th style={thStyle}>Duration</th>
                  <th style={thStyle}>Status</th>
                  <th style={{ ...thStyle, maxWidth: '260px' }}>Session Notes</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ ...tdStyle, textAlign: 'center', color: '#999', padding: '3rem' }}>
                      No sessions found.
                    </td>
                  </tr>
                ) : (
                  filtered.map((s) => (
                    <tr key={s.id} style={{ backgroundColor: 'white' }}
                      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#f9fafb')}
                      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'white')}
                    >
                      <td style={{ ...tdStyle, fontWeight: 500 }}>{s.patientName}</td>
                      <td style={tdStyle}>{s.therapistName}</td>
                      <td style={tdStyle}>{formatDate(s.start_time)}</td>
                      <td style={tdStyle}>{formatTime(s.start_time)}</td>
                      <td style={tdStyle}>{s.duration_minutes > 0 ? `${s.duration_minutes} min` : '—'}</td>
                      <td style={tdStyle}>
                        <IonBadge color={STATUS_COLOR[s.status] ?? 'medium'} style={{ textTransform: 'capitalize' }}>
                          {s.status}
                        </IonBadge>
                      </td>
                      <td style={{ ...tdStyle, maxWidth: '260px', whiteSpace: 'normal', wordBreak: 'break-word', color: s.session_note ? '#333' : '#aaa' }}>
                        {s.session_note || '—'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </IonContent>
    </IonPage>
  );
};

export default TherapyLogs;
