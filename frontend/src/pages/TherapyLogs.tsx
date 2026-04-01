import React, { useState } from 'react';
import { IonContent, IonHeader, IonPage, IonTitle, IonToolbar, IonList, IonItem, IonLabel, IonBadge, IonInput, IonButton } from '@ionic/react';

const TherapyLogs: React.FC = () => {
  const [search, setSearch] = useState('');
  
  // Dummy logs
  const logs = [
    { id: 1, date: '2024-03-29', patient: 'John Doe', therapist: 'Dr. Smith', duration: 40, status: 'Completed' },
    { id: 2, date: '2024-03-28', patient: 'Jane Roe', therapist: 'Dr. Smith', duration: 38, status: 'Completed' }
  ];

  const handleExport = () => {
    alert("Export to PDF triggered");
  }

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar color="primary">
          <IonTitle>Therapy Logs</IonTitle>
          <IonButton slot="end" onClick={handleExport} fill="clear" color="light">Export PDF</IonButton>
        </IonToolbar>
      </IonHeader>
      <IonContent className="ion-padding">
         <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
            <IonInput value={search} onIonChange={e => setSearch(e.detail.value!)} placeholder="Search patient or therapist..." style={{ flexGrow: 1, border: '1px solid #ccc', padding: '0.5rem' }} />
            <input type="date" style={{ padding: '0.5rem', border: '1px solid #ccc' }} />
         </div>
         <IonList>
            {logs.map(l => (
               <IonItem key={l.id} button>
                  <IonLabel>
                     <h2>{l.date} - {l.patient}</h2>
                     <p>Therapist: {l.therapist} | Duration: {l.duration} min</p>
                  </IonLabel>
                  <IonBadge color="success">{l.status}</IonBadge>
               </IonItem>
            ))}
         </IonList>
      </IonContent>
    </IonPage>
  );
};

export default TherapyLogs;
