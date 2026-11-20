import React from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.jsx';
import { SettingsProvider } from './lib/settings.jsx';
import { registerSW } from 'virtual:pwa-register';

// autoUpdate: reloads the page as soon as a new service worker takes control
registerSW({ immediate: true });
createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <SettingsProvider>
      <App />
    </SettingsProvider>
  </React.StrictMode>,
);
