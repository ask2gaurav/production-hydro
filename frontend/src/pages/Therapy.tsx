import React, { useState, useEffect } from 'react';
import { IonContent, IonIcon, IonHeader, IonPage, IonTitle, IonToolbar, IonGrid, IonRow, IonCol, IonButton, IonBadge, IonProgressBar } from '@ionic/react';
import { arrowBack } from 'ionicons/icons';
import { useStore } from '../store/useStore';

const Therapy: React.FC = () => {
  const { modeStatus } = useStore();
  const [state, setState] = useState('IDLE'); // IDLE, PREPARING, ACTIVE, COMPLETE
  const [timeLeft, setTimeLeft] = useState(40 * 60); // 40 minutes

  const handleStart = () => {
    setState('ACTIVE');
  }

  const handlePrepare = () => {
    setState('PREPARING');
  }

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar color="primary">
          <IonTitle>Therapy Session</IonTitle>
          {modeStatus && modeStatus.mode === 'demo' && (
            <IonBadge color="warning" slot="end" style={{ marginRight: '1rem' }}>
              DEMO MODE: {modeStatus.sessions_remaining} sessions left
            </IonBadge>
          )}

          <IonButton color="tertiary" slot="end" style={{ marginRight: '1rem' }} onClick={() => history.back()}>
            <IonIcon icon={arrowBack} />
          </IonButton>

        </IonToolbar>
      </IonHeader>
      <IonContent fullscreen>
        <IonGrid style={{ height: '100%', margin: 0, padding: 0 }}>
          <IonRow style={{ height: '100%' }}>
            <IonCol size="4" style={{ borderRight: '1px solid #ccc', padding: '1rem', display: 'flex', flexDirection: 'column' }}>
              <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
                <h1 style={{ fontSize: '4rem', margin: 0 }}>
                  {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, '0')}
                </h1>
                <IonProgressBar value={1 - (timeLeft / (40 * 60))} color="primary"></IonProgressBar>
                <small>40 min</small>
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <label>Therapist [Search ▾]</label>
                <input type="text" className="ion-input" style={{ backgroundColor: 'white', borderRadius: '10px', width: '100%', padding: '0.5rem', marginTop: '0.5rem', border: '1px solid #ccc' }} placeholder="Select Therapist..." />
              </div>

              <div style={{ marginBottom: '2rem' }}>
                <label>Patient [Search ▾]</label>
                <input type="text" className="ion-input" style={{ backgroundColor: 'white', borderRadius: '10px', width: '100%', padding: '0.5rem', marginTop: '0.5rem', border: '1px solid #ccc' }} placeholder="Select Patient..." />
              </div>

              <IonRow>
                <IonCol><IonButton expand="block" color="warning" onClick={handlePrepare} disabled={state !== 'IDLE'}>PREPARE</IonButton></IonCol>
                <IonCol><IonButton expand="block" color="success" onClick={handleStart} disabled={state !== 'PREPARING'}>START</IonButton></IonCol>
              </IonRow>
              <IonRow>
                <IonCol><IonButton expand="block" color="medium" onClick={() => setState('IDLE')}>NEW THERAPY</IonButton></IonCol>
                <IonCol><IonButton expand="block" color="danger">FLUSH</IonButton></IonCol>
              </IonRow>

              <div style={{ flexGrow: 1, marginTop: '2rem', display: 'flex', flexDirection: 'column' }}>
                <label>Session Notes:</label>
                <textarea style={{ backgroundColor: 'white', borderRadius: '10px', flexGrow: 1, width: '100%', marginTop: '0.5rem', padding: '0.5rem', border: '1px solid #ccc' }}></textarea>
              </div>
            </IonCol>

            <IonCol size="8" style={{ backgroundColor: '#f4f5f8', display: 'flex', flexWrap: 'wrap', justifyContent: 'center', alignItems: 'center', padding: '2rem' }}>
              {state === 'IDLE' && (
                <div style={{ textAlign: 'center' }}>
                  <h2 style={{ color: '#999' }}>System Ready - Idle</h2>
                  <div style={{ width: '200px', height: '200px', backgroundColor: '#eef5f9', borderRadius: '50%', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>[GIF]</div>
                </div>
              )}
              {state === 'PREPARING' && (
                <div style={{ width: '100%', display: 'flex', justifyContent: 'space-around' }}>
                  <div style={{ textAlign: 'center' }}>
                    <h3>Water Temperature (°C)</h3>
                    <div style={{ width: '150px', height: '150px', border: '10px solid #2dd36f', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2rem' }}>
                      36°
                    </div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <h3>Water Level (%)</h3>
                    <div style={{ width: '100px', height: '200px', border: '2px solid #ccc', margin: '0 auto', position: 'relative' }}>
                      <div style={{ position: 'absolute', bottom: 0, width: '100%', height: '70%', backgroundColor: '#3880ff' }}></div>
                    </div>
                  </div>
                </div>
              )}
              {state === 'ACTIVE' && (
                <div style={{ width: '100%', height: '100%', backgroundColor: '#e0f7fa', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '5px solid #2dd36f' }}>
                  <h2 style={{ color: '#00838f' }}>Active Therapy Visualization...</h2>
                </div>
              )}
            </IonCol>
          </IonRow>
        </IonGrid>
      </IonContent>
    </IonPage>
  );
};

export default Therapy;
