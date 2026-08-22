import { Redirect, Route } from 'react-router-dom';
import { IonApp, IonRouterOutlet, setupIonicReact } from '@ionic/react';
import { IonReactRouter } from '@ionic/react-router';
import { useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import { EspServer } from './plugins/espServer';
import { EspUsb } from './plugins/espUsb';

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
import NextTherapyNotification from './pages/NextTherapyNotification';
import DataExportImport from './pages/DataExportImport';
import SavedBackups from './pages/SavedBackups';
import LockScreen from './pages/LockScreen';
import LoginPage from './pages/LoginPage';

import { useStore } from './store/useStore';
import { checkModeOnBoot } from './services/modeCheck';
import { runSync } from './services/syncService';
import { addLog } from './services/debugLog';
import { useKeyboardScroll } from './hooks/useKeyboardScroll';
import { localDB } from './db/localDB';
import MachineIdMismatchModal from './components/MachineIdMismatchModal';

setupIonicReact();

const App: React.FC = () => {
  const { machineId, modeStatus, connectionMode } = useStore();
  useKeyboardScroll();

  // Start the embedded HTTP server so the ESP32 can POST its LAN IP on connect
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) {
      localStorage.setItem('esp32_ip', '127.0.0.1:8091');
      useStore.getState().setMachineConnected(true);
      return
    };
    EspServer.startServer();
    const listenerPromise = EspServer.addListener('espRegistered', ({ ip, serial }) => {
      localStorage.setItem('esp32_ip', ip);
      if (serial) localStorage.setItem('esp32_serial', serial);
      addLog({ type: 'registration', ip, serial: serial ?? '' });
      useStore.getState().setMachineConnected(true);
      // USB is preferred when active — don't let a WiFi registration downgrade the label.
      if (useStore.getState().activeTransport !== 'usb') {
        useStore.getState().setActiveTransport('wifi');
      }
    });
    return () => {
      listenerPromise.then(l => l.remove());
      EspServer.stopServer();
    };
  }, []);

  // Prefer a wired USB-C link to the ESP32 when available, falling back to the WiFi
  // hotspot registration flow above (esp32Service/nativeHttp pick the transport per call)
  // — unless the operator has explicitly set Connection Settings to WiFi-only, in which
  // case the USB port is never opened at all (opening it resets the ESP32 via DTR/RTS).
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    if (connectionMode === 'wifi') {
      EspUsb.disconnect().catch(() => {});
      return;
    }

    // In case a device is already attached when the app launches.
    EspUsb.isAvailable().then(({ available }) => {
      if (available) EspUsb.connect().catch(() => {});
    });

    const attachedPromise = EspUsb.addListener('usbDeviceAttached', () => {
      EspUsb.connect().catch(() => {});
    });
    const connectedPromise = EspUsb.addListener('usbConnected', () => {
      addLog({ type: 'info', message: 'ESP32 connected via USB' });
      useStore.getState().setActiveTransport('usb');
      useStore.getState().setMachineConnected(true);
    });
    const disconnectedPromise = EspUsb.addListener('usbDisconnected', ({ reason }) => {
      addLog({ type: 'info', message: `USB disconnected: ${reason}` });
      useStore.getState().setActiveTransport(localStorage.getItem('esp32_ip') ? 'wifi' : 'none');
    });

    return () => {
      attachedPromise.then(l => l.remove());
      connectedPromise.then(l => l.remove());
      disconnectedPromise.then(l => l.remove());
      EspUsb.disconnect();
    };
  }, [connectionMode]);

  useEffect(() => {
    if (!machineId) return;
    localDB.settings.get(machineId).then((s) => {
      useStore.getState().setConnectionMode(s?.connection_mode ?? 'auto');
    });
    if (navigator.onLine) {
      runSync(machineId);
    } else {
      checkModeOnBoot(machineId);
    }
  }, [machineId]);

  return (
    <IonApp>
      <MachineIdMismatchModal />
      <IonReactRouter>
        <IonRouterOutlet>
          <Route exact path="/login" component={LoginPage} />
          <Route exact path="/dashboard" component={machineId ? modeStatus.is_locked ? LockScreen : Dashboard : LoginPage} />
          <Route exact path="/therapy" component={machineId ? modeStatus.is_locked ? LockScreen : Therapy : LoginPage} />
          <Route exact path="/logs" component={machineId ? modeStatus.is_locked ? LockScreen : TherapyLogs : LoginPage} />
          <Route exact path="/settings" component={machineId ? modeStatus.is_locked ? LockScreen : Settings : LoginPage} />
          <Route exact path="/resources" component={machineId ? modeStatus.is_locked ? LockScreen : Resources : LoginPage} />
          <Route exact path="/notifications" component={machineId ? modeStatus.is_locked ? LockScreen : NextTherapyNotification : LoginPage} />
          <Route exact path="/data-export-import" component={machineId ? modeStatus.is_locked ? LockScreen : DataExportImport : LoginPage} />
          <Route exact path="/saved-backups" component={machineId ? modeStatus.is_locked ? LockScreen : SavedBackups : LoginPage} />
          {/* <Route exact path="/lockscreen" component={LockScreen} /> */}
          <Route exact path="/">
            {machineId ? <Redirect to="/dashboard" /> : <Redirect to="/login" />}
          </Route>
        </IonRouterOutlet>
      </IonReactRouter>
    </IonApp>
  );
};

export default App;
