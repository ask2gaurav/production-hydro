import { Redirect, Route } from 'react-router-dom';
import { IonApp, IonRouterOutlet, setupIonicReact } from '@ionic/react';
import { IonReactRouter } from '@ionic/react-router';
import { useEffect } from 'react';

/* Core CSS required for Ionic components to work properly */
import '@ionic/react/css/core.css';
import '@ionic/react/css/normalize.css';
import '@ionic/react/css/structure.css';
import '@ionic/react/css/typography.css';
import '@ionic/react/css/padding.css';
import '@ionic/react/css/float-elements.css';
import '@ionic/react/css/text-alignment.css';
import '@ionic/react/css/text-transformation.css';
import '@ionic/react/css/flex-utils.css';
import '@ionic/react/css/display.css';
import './theme/variables.css';

import Dashboard from './pages/Dashboard';
import Therapy from './pages/Therapy';
import TherapyLogs from './pages/TherapyLogs';
import Settings from './pages/Settings';
import Resources from './pages/Resources';
import LockScreen from './pages/LockScreen';

import { useStore } from './store/useStore';
import { checkModeOnBoot } from './services/modeCheck';

setupIonicReact();

const App: React.FC = () => {
  const { machineId, modeStatus } = useStore();

  useEffect(() => {
    checkModeOnBoot(machineId);
  }, [machineId]);

  return (
    <IonApp>
      {modeStatus.is_locked ? (
        <LockScreen />
      ) : (
        <IonReactRouter>
          <IonRouterOutlet>
            <Route exact path="/dashboard" component={Dashboard} />
            <Route exact path="/therapy" component={Therapy} />
            <Route exact path="/logs" component={TherapyLogs} />
            <Route exact path="/settings" component={Settings} />
            <Route exact path="/resources" component={Resources} />
            <Route exact path="/">
              <Redirect to="/dashboard" />
            </Route>
          </IonRouterOutlet>
        </IonReactRouter>
      )}
    </IonApp>
  );
};

export default App;
