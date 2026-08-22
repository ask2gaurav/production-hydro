import React, { useEffect, useState } from 'react';
import { IonModal, IonHeader, IonToolbar, IonTitle, IonButton, IonContent, IonIcon } from '@ionic/react';
import { warningOutline } from 'ionicons/icons';
import { useStore } from '../store/useStore';

const MachineIdMismatchModal: React.FC = () => {
  const { machineIdMismatch } = useStore();
  const [dismissed, setDismissed] = useState(false);
  const [lastActual, setLastActual] = useState<string | null>(null);

  // Reopen on a genuinely new mismatch (e.g. a different wrong machine gets connected),
  // but don't keep reopening every poll tick while the same mismatch persists.
  useEffect(() => {
    if (machineIdMismatch && machineIdMismatch.actual !== lastActual) {
      setDismissed(false);
      setLastActual(machineIdMismatch.actual);
    } else if (!machineIdMismatch) {
      setLastActual(null);
    }
  }, [machineIdMismatch, lastActual]);

  const isOpen = !!machineIdMismatch && !dismissed;

  return (
    <IonModal isOpen={isOpen} onDidDismiss={() => setDismissed(true)} style={{ '--width': '440px', '--height': '380px', '--border-radius': '12px' } as React.CSSProperties}>
      <IonHeader>
        <IonToolbar color="danger">
          <IonTitle>Machine ID Mismatch</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent className="ion-padding">
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1rem' }}>
          <IonIcon icon={warningOutline} style={{ fontSize: '3rem', color: '#eb445a' }} />
        </div>
        <p style={{ fontSize: '0.92rem', color: '#333', lineHeight: 1.5 }}>
          This tablet is connected via USB-C to a different machine than the one this login is associated with.
          This could mean the app is connected to the wrong machine, or these login credentials are for a different machine.
        </p>
        <div style={{ backgroundColor: '#fafafa', border: '1px solid #eee', borderRadius: '8px', padding: '0.75rem 1rem', marginTop: '1rem', fontSize: '0.85rem' }}>
          <div style={{ marginBottom: '0.4rem' }}>
            <strong>Expected machine ID:</strong> {machineIdMismatch?.expected}
          </div>
          <div>
            <strong>Connected machine ID:</strong> {machineIdMismatch?.actual}
          </div>
        </div>
        <IonButton expand="block" style={{ marginTop: '1.5rem' }} onClick={() => setDismissed(true)}>
          Dismiss
        </IonButton>
      </IonContent>
    </IonModal>
  );
};

export default MachineIdMismatchModal;
