import React, { useState } from 'react';
import {
  IonPage, IonContent, IonHeader, IonToolbar, IonTitle,
  IonItem, IonLabel, IonInput, IonButton, IonText, IonSpinner
} from '@ionic/react';
import { useHistory } from 'react-router';
import api from '../services/api';
import { useStore } from '../store/useStore';
import { checkModeOnBoot } from '../services/modeCheck';
import { fetchAndCacheResources, runSync } from '../services/syncService';

const LoginPage: React.FC = () => {
  const history = useHistory();
  const { setMachineId, setToken } = useStore();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

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
      // runSync pushes any pending offline data first, then fetches fresh mode status.
      // If offline, fall back to checkModeOnBoot which reads from local cache.
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

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar color="primary">
          <IonTitle>Owner Login</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent className="ion-padding" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ maxWidth: 400, margin: '4rem auto' }}>
          {/* {<IonItem>} */}
            {/* {<IonLabel position="floating">Email</IonLabel>} */}
            <IonInput
              label='Email:'
              type="email"
              placeholder='Enter email address'
              value={email}
              onIonChange={(e) => setEmail(e.detail.value || '')}
              autocomplete="email"
              fill="outline" 
              style={{ marginBottom: "15px" }}
            />
          {/* {</IonItem>} */}
          {/* {<IonItem>} */}
            {/* <IonLabel position="floating">Password</IonLabel> */}
            <IonInput
              label='Password:'
              placeholder='Enter password'
              fill="outline" 
              type="password"
              value={password}
              onIonChange={(e) => setPassword(e.detail.value || '')}
              onKeyDown={(e) => { if (e.key === 'Enter') handleLogin(); }}
            />
          {/* {</IonItem>} */}
          {error && (
            <IonText color="danger">
              <p style={{ padding: '0.5rem 1rem', margin: 0 }}>{error}</p>
            </IonText>
          )}
          <IonButton
            expand="block"
            style={{ marginTop: '1.5rem' }}
            onClick={handleLogin}
            disabled={loading || !email || !password}
          >
            {loading ? <IonSpinner name="crescent" /> : 'Login'}
          </IonButton>
        </div>
      </IonContent>
    </IonPage>
  );
};

export default LoginPage;
