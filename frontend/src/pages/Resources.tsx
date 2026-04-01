import React, { useState, useEffect } from 'react';
import { IonContent, IonHeader, IonPage, IonTitle, IonToolbar, IonAccordionGroup, IonAccordion, IonItem, IonLabel, IonCard, IonCardContent } from '@ionic/react';

const Resources: React.FC = () => {
  const [resources, setResources] = useState<any[]>([]);

  useEffect(() => {
    setResources([
      { id: 1, title: 'How do I start a new Therapy Session?', category: 'FAQ', content: '<p>Go to the Dashboard and tap Therapy.</p>' },
      { id: 2, title: 'What is the recommended temperature range?', category: 'FAQ', content: '<p>Between 35°C and 38°C.</p>' }
    ]);
  }, []);

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar color="primary">
          <IonTitle>Resources & Help</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent className="ion-padding">
        <IonCard>
          <IonCardContent>
            <h2>Need More Help?</h2>
            <p>Contact your supplier for hardware replacement or to extend your therapy sessions.</p>
          </IonCardContent>
        </IonCard>

        <h3>FAQ</h3>
        <IonAccordionGroup>
          {resources.filter(r => r.category === 'FAQ').map(r => (
            <IonAccordion key={r.id} value={`faq-${r.id}`}>
              <IonItem slot="header" color="light">
                <IonLabel>{r.title}</IonLabel>
              </IonItem>
              <div className="ion-padding" slot="content" dangerouslySetInnerHTML={{ __html: r.content }} />
            </IonAccordion>
          ))}
        </IonAccordionGroup>
      </IonContent>
    </IonPage>
  );
};

export default Resources;
