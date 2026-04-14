import React, { useState, useEffect, useCallback } from 'react';
import {
  IonPage, IonContent, IonHeader, IonToolbar, IonTitle,
  IonItem, IonLabel, IonInput, IonButton, IonText, IonSpinner
} from '@ionic/react';
import { useHistory } from 'react-router';
import api from '../services/api';
import { useStore } from '../store/useStore';
import { checkModeOnBoot } from '../services/modeCheck';
import { fetchAndCacheResources, runSync } from '../services/syncService';

type ServerStatus = 'checking' | 'ok' | 'down';

const bannerStyle = (color: string): React.CSSProperties => ({
  backgroundColor: color,
  color: '#fff',
  padding: '0.6rem 1rem',
  display: 'flex',
  alignItems: 'center',
  gap: '0.5rem',
  fontSize: '0.875rem',
  fontWeight: 500,
});

const LoginPage: React.FC = () => {
  const history = useHistory();
  const { setMachineId, setToken } = useStore();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [online, setOnline] = useState(navigator.onLine);
  const [serverStatus, setServerStatus] = useState<ServerStatus>('checking');

  // Track live online/offline changes
  useEffect(() => {
    const goOnline  = () => setOnline(true);
    const goOffline = () => setOnline(false);
    window.addEventListener('online',  goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      window.removeEventListener('online',  goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, []);

  const checkServer = useCallback(() => {
    if (!online) return;
    setServerStatus('checking');
    const controller = new AbortController();
    api.get('/health', { signal: controller.signal, timeout: 5000 })
      .then(() => setServerStatus('ok'))
      .catch((err) => {
        if (err?.response?.status) {
          setServerStatus('ok');
        } else {
          setServerStatus('down');
        }
      });
    return controller;
  }, [online]);

  // Ping the server whenever we come online
  useEffect(() => {
    if (!online) {
      setServerStatus('checking');
      return;
    }
    const controller = checkServer();
    return () => controller?.abort();
  }, [online, checkServer]);

  const handleLogin = async () => {
    setError('');
    setLoading(true);
    try {
      const loginRes = await api.post('/auth/login', { email, password });
      const token: string = loginRes.data.token;

      const meRes = await api.get('/auth/me', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const machineId: string = meRes.data.machine_id;

      if (!machineId) {
        setError('No machine assigned to this account. Please contact your supplier.');
        setLoading(false);
        return;
      }

      setToken(token);
      setMachineId(machineId);
      await fetchAndCacheResources(machineId);
      if (navigator.onLine) {
        await runSync(machineId);
      } else {
        await checkModeOnBoot(machineId);
      }
      history.replace('/dashboard');
    } catch (err: any) {
      const msg = err?.response?.data?.error || 'Login failed. Please try again.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const loginBlocked = !online || serverStatus === 'down';

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar color="primary">
          <IonTitle>Owner Login</IonTitle>
        </IonToolbar>
      </IonHeader>

      {/* ── Connectivity banners ── */}
      {!online && (
        <div style={bannerStyle('#c0392b')}>
          <span>&#9888;</span>
          No internet connection. Please connect to the internet to log in.
        </div>
      )}
      {online && serverStatus === 'down' && (
        <div style={{ ...bannerStyle('#c0392b'), justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span>&#9888;</span>
            Backend server is unreachable. Please try again or contact support.
          </div>
          <button
            onClick={checkServer}
            style={{
              background: 'rgba(255,255,255,0.2)',
              border: '1px solid rgba(255,255,255,0.5)',
              borderRadius: '4px',
              color: '#fff',
              cursor: 'pointer',
              fontSize: '0.8rem',
              fontWeight: 600,
              padding: '0.25rem 0.75rem',
              whiteSpace: 'nowrap',
            }}
          >
            &#8635; Retry
          </button>
        </div>
      )}
      {online && serverStatus === 'checking' && (
        <div style={bannerStyle('#2980b9')}>
          <IonSpinner name="dots" style={{ width: 16, height: 16 }} />
          Checking server connection…
        </div>
      )}

      <IonContent className="ion-padding" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ maxWidth: 400, margin: '4rem auto' }}>
          <IonInput
            label='Email:'
            type="email"
            placeholder='Enter email address'
            value={email}
            onIonInput={(e) => setEmail((e.target as HTMLIonInputElement).value as string || '')}
            autocomplete="email"
            fill="outline"
            style={{ marginBottom: '15px' }}
          />
          <IonInput
            label='Password:'
            placeholder='Enter password'
            fill="outline"
            type="password"
            value={password}
            onIonInput={(e) => setPassword((e.target as HTMLIonInputElement).value as string || '')}
            onKeyDown={(e) => { if (e.key === 'Enter' && !loginBlocked) handleLogin(); }}
          />
          {error && (
            <IonText color="danger">
              <p style={{ padding: '0.5rem 1rem', margin: 0 }}>{error}</p>
            </IonText>
          )}
          <IonButton
            expand="block"
            style={{ marginTop: '1.5rem' }}
            onClick={handleLogin}
            disabled={loading || !email || !password || loginBlocked}
          >
            {loading ? <IonSpinner name="crescent" /> : 'Login'}
          </IonButton>
        </div>
      </IonContent>
    </IonPage>
  );
};

export default LoginPage;
