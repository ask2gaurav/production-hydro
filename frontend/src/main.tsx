import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { DeviceProvider } from './context/DeviceContext'

const container = document.getElementById('root');
const root = createRoot(container!);
root.render(
  <React.StrictMode>
    <DeviceProvider>
      <App />
    </DeviceProvider>
  </React.StrictMode>
);