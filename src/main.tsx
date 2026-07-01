import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './client/App';
import { initTheme } from './client/ThemeToggle';
import './client/theme.css';

initTheme();

const rootEl = document.getElementById('root');
if (!rootEl) throw new Error('Root element #root not found');

ReactDOM.createRoot(rootEl).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
