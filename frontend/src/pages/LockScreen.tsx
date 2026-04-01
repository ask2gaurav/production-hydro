import React from 'react';
import { IonPage, IonContent, IonButton, IonIcon, IonCard, IonCardContent, IonCardHeader, IonCardTitle } from '@ionic/react';
import { lockClosedOutline, mailOutline, callOutline, keyOutline } from 'ionicons/icons';
import { useStore } from '../store/useStore';

const LockScreen: React.FC = () => {
  const { modeStatus, machineId } = useStore();
  const contact = modeStatus.lock_screen_contact || {};

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
               <h2 style={{color: '#000'}}>{contact.supplier_name || 'System Supplier'}</h2>
               <p>📧 {contact.supplier_email || 'support@example.com'}</p>
               <p>📞 {contact.supplier_phone || '+1 (555) 000-0000'}</p>
               <p>🕐 {contact.supplier_available_hours || 'Mon-Fri, 9am-6pm'}</p>
               <br/>
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

           <div style={{ marginTop: '4rem', borderTop: '1px solid #ccc', paddingTop: '2rem', width: '100%', maxWidth: '600px' }}>
              <p>Admin / Supplier? Enter your credentials to unlock remotely.</p>
              <IonButton fill="outline" color="medium">
                <IonIcon icon={keyOutline} slot="start" /> Staff Login
              </IonButton>
           </div>
        </div>
      </IonContent>
    </IonPage>
  );
};

export default LockScreen;
