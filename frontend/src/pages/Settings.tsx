import React, { useState, useEffect } from 'react';
import { IonContent, IonHeader, IonPage, IonTitle, IonToolbar, IonList, IonItem, IonLabel, IonToggle, IonRange, IonInput, IonListHeader, useIonAlert, IonBadge, IonButton, IonIcon } from '@ionic/react';
import { arrowBack } from 'ionicons/icons';
import { localDB } from '../db/localDB';
import { useStore } from '../store/useStore';

const Settings: React.FC = () => {
  const [presentAlert] = useIonAlert();
  const { machineId, online } = useStore();
  const [settings, setSettings] = useState<any>({
    default_session_minutes: 40,
    default_temperature: 37,
    max_temperature: 40,
    water_inlet_valve: false,
    flush_valve: false,
    blower_switch: false,
    heater_switch: false
  });

  useEffect(() => {
    localDB.settings.get(machineId).then((s: any) => {
      if (s) setSettings({ ...settings, ...s });
    });
  }, [machineId]);

  const handleChange = (key: string, value: string | number | boolean) => {
    const newSettings = { ...settings, [key]: value };
    setSettings(newSettings);
    localDB.settings.put({ machine_id: machineId, ...newSettings });
  };

  const handleToggle = (key: string, value: boolean) => {
    if (!online) {
      presentAlert({
         header: 'Offline Warning',
         message: 'You are currently offline. This hardware toggle will be queued, but it will not take effect on the machine immediately.',
         buttons: ['OK']
      });
    }
    handleChange(key, value);
  };

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar color="primary">
          <IonTitle>Machine Settings</IonTitle>
          <IonButton color="primary" slot="end" style={{ marginRight: '1rem' }} onClick={() => history.back()}>
            <IonIcon icon={arrowBack} />
          </IonButton>
        </IonToolbar>
      </IonHeader>
      <IonContent>
        <IonList>
          <IonListHeader>
             <IonLabel>Session Defaults</IonLabel>
          </IonListHeader>
          <IonItem>
            <IonLabel>Default Session Duration (min) - {settings.default_session_minutes}</IonLabel>
            <IonRange min={1} max={60} value={settings.default_session_minutes} onIonChange={e => handleChange('default_session_minutes', e.detail.value as number)} />
          </IonItem>
          <IonItem>
            <IonLabel>Default Temperature (°C)</IonLabel>
            <IonInput type="number" value={settings.default_temperature} onIonChange={e => handleChange('default_temperature', parseInt(e.detail.value as string, 10))} />
          </IonItem>
          <IonItem>
            <IonLabel>Max Temperature Alert (°C)</IonLabel>
            <IonInput type="number" value={settings.max_temperature} onIonChange={e => handleChange('max_temperature', parseInt(e.detail.value as string, 10))} />
          </IonItem>
          
          <IonListHeader>
             <IonLabel>
               Hardware Controls
               {!online && <IonBadge color="danger" style={{marginLeft: '1rem'}}>Offline</IonBadge>}
             </IonLabel>
          </IonListHeader>
          <IonItem>
            <IonLabel>Water Inlet Valve</IonLabel>
            <IonToggle checked={settings.water_inlet_valve} onIonChange={e => handleToggle('water_inlet_valve', e.detail.checked)} />
          </IonItem>
          <IonItem>
            <IonLabel>Flush Valve</IonLabel>
            <IonToggle checked={settings.flush_valve} onIonChange={e => handleToggle('flush_valve', e.detail.checked)} />
          </IonItem>
          <IonItem>
            <IonLabel>Blower Switch</IonLabel>
            <IonToggle checked={settings.blower_switch} onIonChange={e => handleToggle('blower_switch', e.detail.checked)} />
          </IonItem>
          <IonItem>
            <IonLabel>Heater Switch</IonLabel>
            <IonToggle checked={settings.heater_switch} onIonChange={e => handleToggle('heater_switch', e.detail.checked)} />
          </IonItem>

          <IonListHeader>
             <IonLabel>System Info</IonLabel>
          </IonListHeader>
          <IonItem>
             <IonLabel>Machine ID: {machineId}</IonLabel>
          </IonItem>
        </IonList>
      </IonContent>
    </IonPage>
  );
};

export default Settings;
