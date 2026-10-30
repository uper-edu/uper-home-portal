import {reportClientFailure} from './services/clientDiagnostics';
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

// The same bounded, privacy-safe report is used by React, global errors and module loading.
window.addEventListener('error',event=>{if(event.error)reportClientFailure(event.error,'window');});
window.addEventListener('unhandledrejection',event=>{if(event.reason)reportClientFailure(event.reason,'promise');});
window.addEventListener('vite:preloadError',event=>{reportClientFailure((event as Event & {payload?:unknown}).payload,'preload');});

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
