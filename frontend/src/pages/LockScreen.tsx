import React, { useState } from 'react';
import {
  IonPage, IonContent, IonButton, IonIcon, IonCard, IonCardContent,
  IonCardHeader, IonCardTitle, IonAlert, IonSpinner, IonText
} from '@ionic/react';
import { lockClosedOutline, mailOutline, callOutline, refreshOutline, wifiOutline } from 'ionicons/icons';
import { useStore } from '../store/useStore';
import { checkModeOnBoot } from '../services/modeCheck';
import { useHistory } from 'react-router-dom';

const LockScreen: React.FC = () => {
  const { modeStatus, machineId, online } = useStore();
  const contact = modeStatus.lock_screen_contact || {};
  const history = useHistory();
  const [checking, setChecking] = useState(false);
  const [showOfflineAlert, setShowOfflineAlert] = useState(false);
  const [stillLocked, setStillLocked] = useState(false);

  const handleCheckForUpdates = async () => {
    if (!online) {
      setShowOfflineAlert(true);
      return;
    }

    setChecking(true);
    setStillLocked(false);

    await checkModeOnBoot(machineId);

    // If still locked after the check, show feedback
    if (useStore.getState().modeStatus.is_locked) {
      setStillLocked(true);
    }
    // If unlocked, App.tsx routing automatically redirects away from this screen

    setChecking(false);
  };
  // if(!stillLocked){
  //   history.replace('/dashboard');
  // }
  return (
    <IonPage>
      <IonContent className="ion-padding" style={{ '--background': '#f4f5f8' }}>
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', justifyContent: 'center', alignItems: 'center', textAlign: 'center' }}>
          <IonIcon icon={lockClosedOutline} style={{ fontSize: '6rem', color: '#dc3545' }} />
          <h1 style={{ color: '#dc3545' }}>Application Locked</h1>
          <p style={{ maxWidth: '600px', fontSize: '1.2rem' }}>
            You have used all {modeStatus.demo_session_limit} demo therapy sessions included with this device.
            To continue using the system, please contact your supplier.
          </p>

          <IonCard style={{ width: '100%', maxWidth: '600px', marginTop: '2rem' }}>
            <IonCardHeader>
              <IonCardTitle>Your Supplier</IonCardTitle>
            </IonCardHeader>
            <IonCardContent>
              <h2 style={{ color: '#000' }}>{contact.supplier_name || 'System Supplier'}</h2>
              <p>📧 {contact.supplier_email || 'support@example.com'}</p>
              <p>📞 {contact.supplier_phone || '+1 (555) 000-0000'}</p>
              <p>🕐 {contact.supplier_available_hours || 'Mon-Fri, 9am-6pm'}</p>
              <br />
              <i>{contact.custom_message || '"Contact us to add more sessions or activate full mode."'}</i>
            </IonCardContent>
          </IonCard>

          <div style={{ marginTop: '2rem', display: 'flex', gap: '1rem' }}>
            <IonButton color="primary" href={`mailto:${contact.supplier_email}?subject=Demo Limit Reached - ${machineId}`}>
              <IonIcon icon={mailOutline} slot="start" /> Email Supplier
            </IonButton>
            <IonButton color="primary" href={`tel:${contact.supplier_phone}`}>
              <IonIcon icon={callOutline} slot="start" /> Call Supplier
            </IonButton>
          </div>

          {/* Check for supplier changes */}
          <div style={{ marginTop: '2.5rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.6rem' }}>
            <IonButton
              color="success"
              onClick={handleCheckForUpdates}
              disabled={checking}
              style={{ minWidth: '220px' }}
            >
              {checking
                ? <><IonSpinner name="crescent" style={{ marginRight: '8px' }} /> Checking...</>
                : <><IonIcon icon={refreshOutline} slot="start" /> Check for Updates</>
              }
            </IonButton>

            {stillLocked && (
              <IonText color="medium">
                <p style={{ fontSize: '0.9rem', margin: 0 }}>
                  Still locked — no changes found. Please contact your supplier.
                </p>
              </IonText>
            )}
          </div>
        </div>

        {/* Offline alert */}
        <IonAlert
          isOpen={showOfflineAlert}
          onDidDismiss={() => setShowOfflineAlert(false)}
          header="No Internet Connection"
          message="Please connect to Wi-Fi or mobile data, then try again. Open your device Settings → Wi-Fi to connect."
          buttons={[
            {
              text: 'OK',
              role: 'cancel',
            }
          ]}
        />
      </IonContent>
    </IonPage>
  );
};

export default LockScreen;
