import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import {safeStorage} from './utils/safeStorage.ts';

// Initialize default preferences at startup (Indonesian, Modern Professional, Classic Mint) safely
try {
  if (typeof window !== 'undefined' && !safeStorage.getItem('uper-pref-init-v2')) {
    safeStorage.setItem('uper-pref-init-v2', 'true');
    safeStorage.setItem('i18nextLng', 'id');
    safeStorage.setItem('uper-design-style', 'default');
    safeStorage.setItem('uper-color-theme', 'teal');
  }
} catch (e) {
  console.warn('[Init] Preference init skipped due to storage restrictions:', e);
}

if (typeof window !== 'undefined') {
  try {
    window.history.scrollRestoration = 'manual';
  } catch (e) {
    // Ignore restricted history access in restricted iframes
  }
}

import App from './App.tsx';
import './index.css';
import './i18n';

const formatError = (err: any) => {
  if (!err) return null;
  if (err instanceof Error) {
    return { message: err.message || err.toString(), stack: err.stack || '' };
  }
  if (typeof err === 'object') {
    try {
      if (Object.keys(err).length === 0) return null;
      return { message: err.message || JSON.stringify(err), stack: err.stack || '' };
    } catch (e) {
      return null;
    }
  }
  const str = String(err).trim();
  if (!str || str === 'undefined' || str === 'null' || str === '[object Object]') return null;
  return { message: str, stack: '' };
};

window.addEventListener('error', (event) => {
  if (!event.error && (!event.message || event.message === 'Script error.')) {
    return;
  }
  
  const msg = (event.error?.message || event.message || '').toLowerCase();
  if (
    msg.includes('websocket') || 
    msg.includes('vite') || 
    msg.includes('extension') || 
    msg.includes('hmr') ||
    msg.includes('cross-origin')
  ) {
    return;
  }

  console.error("GLOBAL ERROR:", event.error || event.message);
  
  const errDetail = event.error 
    ? formatError(event.error) 
    : { message: event.message || 'Script error or cross-origin error', stack: `${event.filename || ''}:${event.lineno || 0}:${event.colno || 0}` };
    
  if (errDetail) {
    fetch('/api/log', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(errDetail),
    }).catch(() => {});
  }
});

window.addEventListener('unhandledrejection', (event) => {
  if (!event.reason) {
    return;
  }

  const reasonDetail = formatError(event.reason);
  if (!reasonDetail) {
    return;
  }

  const msg = reasonDetail.message.toLowerCase();
  if (
    msg.includes('websocket') || 
    msg.includes('vite') || 
    msg.includes('extension') || 
    msg.includes('hmr') ||
    msg.includes('cross-origin')
  ) {
    return;
  }

  console.error("UNHANDLED REJECTION:", event.reason);
  
  fetch('/api/log', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(reasonDetail),
  }).catch(() => {});
});

const rootElement = document.getElementById('root');
if (rootElement) {
  try {
    createRoot(rootElement).render(
      <StrictMode>
        <App />
      </StrictMode>,
    );
  } catch (mountErr) {
    console.error('Failed to mount React application:', mountErr);
    rootElement.innerHTML = `
      <div style="min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 24px; font-family: -apple-system, BlinkMacSystemFont, sans-serif;">
        <div style="max-width: 420px; width: 100%; text-align: center; background: white; padding: 32px; border-radius: 16px; box-shadow: 0 4px 20px rgba(0,0,0,0.08); border: 1px solid #e2e8f0;">
          <h2 style="font-size: 18px; font-weight: 700; color: #0f172a; margin-bottom: 8px;">UPER Education</h2>
          <p style="font-size: 13px; color: #64748b; margin-bottom: 20px;">Memuat aplikasi... Silakan muat ulang jika halaman tidak merespons.</p>
          <button onclick="window.location.reload()" style="background: #0d9488; color: white; border: none; padding: 10px 24px; border-radius: 9999px; font-weight: 600; cursor: pointer; font-size: 13px;">
            Muat Ulang Halaman
          </button>
        </div>
      </div>
    `;
  }
}
