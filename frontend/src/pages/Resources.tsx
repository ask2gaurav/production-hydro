import React, { useState, useEffect, useCallback } from 'react';
import {
  IonContent, IonHeader, IonPage, IonTitle, IonToolbar,
  IonAccordionGroup, IonAccordion, IonItem, IonLabel,
  IonCard, IonCardContent, IonSpinner, IonButton, IonIcon, IonBadge
} from '@ionic/react';
import { arrowBack } from 'ionicons/icons';
import { useStore } from '../store/useStore';
import { localDB, type LocalResource } from '../db/localDB';
import api from '../services/api';
import { useHistory } from 'react-router-dom';

// Fallback for resources saved before the type/category_label fields existed
const legacyCategoryLabel: Record<string, string> = {
  FAQ: 'Frequently Asked Questions',
  Guide: 'Guidelines & Best Practices',
  Help: 'Need More Help?',
  Troubleshooting: 'Troubleshooting',
  KeyboardTroubleshooting: 'Keyboard Troubleshooting',
};

const syncResources = async (machineId: string): Promise<void> => {
  if (!navigator.onLine || !machineId) return;
  try {
    type ServerResource = Omit<LocalResource, 'id' | 'server_id' | 'machine_id'> & { _id: string };
    const res = await api.get(`/resources?machine_id=${machineId}`);
    const serverList: ServerResource[] = res.data;

    for (const r of serverList) {
      const existing = await localDB.resources
        .where('server_id').equals(r._id).first();

      if (existing) {
        await localDB.resources.update(existing.id!, {
          title: r.title,
          slug: r.slug,
          content: r.content,
          category: r.category,
          category_label: r.category_label,
          type: r.type,
          sort_order: r.sort_order,
          is_active: r.is_active ?? true,
        });
      } else {
        await localDB.resources.add({
          server_id: r._id,
          machine_id: machineId,
          title: r.title,
          slug: r.slug,
          content: r.content,
          category: r.category,
          category_label: r.category_label,
          type: r.type,
          sort_order: r.sort_order,
          is_active: r.is_active ?? true,
        });
      }
    }
  } catch {
    // Offline or server error — continue with cached data
  }
};

const Resources: React.FC = () => {
  const { modeStatus, machineId } = useStore();
  const [resources, setResources] = useState<LocalResource[]>([]);
  const [loading, setLoading] = useState(true);
  const history = useHistory();
  const loadLocal = useCallback(async () => {
    const local = await localDB.resources
      .where('machine_id').equals(machineId)
      .and((r) => r.is_active !== false)
      .toArray();
    local.sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
    setResources(local);
    setLoading(false);
  }, [machineId]);

  const syncAndReload = useCallback(async () => {
    await syncResources(machineId);
    await loadLocal();
  }, [machineId, loadLocal]);

  useEffect(() => {
    if (!machineId) return;

    // Show cached data immediately, then sync if online
    loadLocal().then(() => syncResources(machineId).then(loadLocal));

    const handleOnline = () => syncAndReload();
    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, [machineId, loadLocal, syncAndReload]);

  const byCategory = (cat: string) => resources.filter((r) => r.category === cat);

  const resourceType = (r: LocalResource) => r.type || (r.category === 'FAQ' ? 'FAQ' : 'Description');

  const categories = Array.from(new Set(resources.map((r) => r.category)));

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar color="primary">
          <IonTitle>Resources & Help</IonTitle>
          <IonButton color="primary" slot="end" style={{ marginRight: '1rem' }} onClick={(e) => { (e.currentTarget as HTMLElement).blur(); history.goBack(); }}>
            <IonIcon icon={arrowBack} />
          </IonButton>
        </IonToolbar>
      </IonHeader>
      <IonContent className="ion-padding">

      {/* add if condition to check if app is in demo mode or full   */}
        {modeStatus && modeStatus.mode === 'demo' && (
        <IonCard>
          <IonCardContent>
            <h2>Need More Help?</h2>
            <p>Contact your supplier to extend your therapy sessions.</p>
          </IonCardContent>
        </IonCard>
      )}
        

        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}>
            <IonSpinner name="crescent" />
          </div>
        ) : resources.length === 0 ? (
          <div style={{ textAlign: 'center', color: '#999', padding: '2rem' }}>
            <p>No resources available. Connect to the internet to load resources.</p>
          </div>
        ) : (
          categories.map((cat) => {
            const items = byCategory(cat);
            if (items.length === 0) return null;
            const label = items[0].category_label || legacyCategoryLabel[cat] || cat;
            const faqItems = items.filter((r) => resourceType(r) === 'FAQ');
            const descriptionItems = items.filter((r) => resourceType(r) !== 'FAQ');
            return (
              <div key={cat}>
                <h3 style={{ marginTop: '1.25rem', marginBottom: '0.5rem' }}>{label}</h3>
                {faqItems.length > 0 && (
                  <IonAccordionGroup>
                    {faqItems.map((r) => (
                      <IonAccordion key={r.id} value={`faq-${r.id}`}>
                        <IonItem slot="header" color="light">
                          <IonLabel>{r.title}</IonLabel>
                        </IonItem>
                        <div
                          className="ion-padding"
                          slot="content"
                          dangerouslySetInnerHTML={{ __html: r.content }}
                        />
                      </IonAccordion>
                    ))}
                  </IonAccordionGroup>
                )}
                {descriptionItems.map((r) => (
                  <div
                    key={r.id}
                    style={{
                      border: '1px solid #ccc', borderRadius: '8px',
                      padding: '0.75rem', backgroundColor: 'white', marginBottom: '1rem',
                    }}
                  >
                    <IonLabel style={{ fontWeight: 600 }}>{r.title}</IonLabel>
                    <div
                      className="ion-padding"
                      dangerouslySetInnerHTML={{ __html: r.content }}
                    />
                  </div>
                ))}
              </div>
            );
          })
        )}
      </IonContent>
    </IonPage>
  );
};

export default Resources;
