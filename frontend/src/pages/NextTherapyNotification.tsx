import React from 'react';
import { IonContent, IonHeader, IonPage, IonTitle, IonToolbar, IonButton, IonIcon } from '@ionic/react';
import { arrowBack } from 'ionicons/icons';
import { useHistory } from 'react-router';

const NextTherapyNotification: React.FC = () => {
  const history = useHistory();

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
        <h2>Next Therapy Notification</h2>
        <p>Notification scheduling functionality will be added here.</p>
      </IonContent>
    </IonPage>
  );
};

export default NextTherapyNotification;
