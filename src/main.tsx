import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './client/App';
import { initTheme } from './client/ThemeToggle';
import { initSettings } from './client/settings';
import './client/theme.css';

initTheme();
initSettings();

const rootEl = document.getElementById('root');
if (!rootEl) throw new Error('Root element #root not found');

ReactDOM.createRoot(rootEl).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
