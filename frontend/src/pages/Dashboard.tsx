import React from 'react';
import { IonContent, IonHeader, IonPage, IonTitle, IonToolbar, IonGrid, IonRow, IonCol, IonCard, IonCardHeader, IonCardTitle, IonIcon, IonBadge } from '@ionic/react';
import { useStore } from '../store/useStore';
import { waterOutline, listOutline, settingsOutline, bookOutline, wifiOutline } from 'ionicons/icons';
import { useHistory } from 'react-router';

const Dashboard: React.FC = () => {
  const { online, machineId } = useStore();
  const history = useHistory();

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar color="primary">
          <IonTitle>Dashboard - {machineId}</IonTitle>
          <IonBadge slot="end" color={online ? 'success' : 'danger'} style={{ marginRight: '1rem' }}>
            <IonIcon icon={wifiOutline} /> {online ? 'Online' : 'Offline'}
          </IonBadge>
        </IonToolbar>
      </IonHeader>
      <IonContent fullscreen className="ion-padding">
        <IonGrid style={{ height: '100%' }}>
          <IonRow style={{ height: '50%' }}>
            <IonCol size="6">
              <IonCard button onClick={() => history.push('/therapy')} style={{ width: 'auto', textAlign: 'center', height: '90%', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', backgroundColor: '#eef5f9' }}>
                <IonIcon icon={waterOutline} style={{ fontSize: '4rem', color: '#0a5c99' }} />
                <IonCardHeader>
                  <IonCardTitle>Therapy</IonCardTitle>
                </IonCardHeader>
              </IonCard>
            </IonCol>
            <IonCol size="6">
              <IonCard button onClick={() => history.push('/logs')} style={{ width: 'auto', textAlign: 'center', height: '90%', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', backgroundColor: '#eef5f9' }}>
                <IonIcon icon={listOutline} style={{ fontSize: '4rem', color: '#0a5c99' }} />
                <IonCardHeader>
                  <IonCardTitle>Therapy Logs</IonCardTitle>
                </IonCardHeader>
              </IonCard>
            </IonCol>
          </IonRow>
          <IonRow style={{ height: '50%' }}>
            <IonCol size="6">
              <IonCard button onClick={() => history.push('/settings')} style={{ width: 'auto', textAlign: 'center', height: '90%', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', backgroundColor: '#eef5f9' }}>
                <IonIcon icon={settingsOutline} style={{ fontSize: '4rem', color: '#0a5c99' }} />
                <IonCardHeader>
                  <IonCardTitle>Settings</IonCardTitle>
                </IonCardHeader>
              </IonCard>
            </IonCol>
            <IonCol size="6">
              <IonCard button onClick={() => history.push('/resources')} style={{ width: 'auto', textAlign: 'center', height: '90%', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', backgroundColor: '#eef5f9' }}>
                <IonIcon icon={bookOutline} style={{ fontSize: '4rem', color: '#0a5c99' }} />
                <IonCardHeader>
                  <IonCardTitle>Resources</IonCardTitle>
                </IonCardHeader>
              </IonCard>
            </IonCol>
          </IonRow>
        </IonGrid>
      </IonContent>
    </IonPage>
  );
};

export default Dashboard;
