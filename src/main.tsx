import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './client/App';
import { initAppearance } from './client/appearance';
import './client/theme.css';

// Before render: no light-mode flash, and the active theme's overrides are on
// <html> by the time the first var() resolves.
initAppearance();

const rootEl = document.getElementById('root');
if (!rootEl) throw new Error('Root element #root not found');

ReactDOM.createRoot(rootEl).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
