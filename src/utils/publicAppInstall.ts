type InstallChoice = {outcome: 'accepted' | 'dismissed'};
type PublicInstallEvent = Event & {prompt: () => Promise<InstallChoice>};

let pending: PublicInstallEvent | undefined;
let installed = false;
const listeners = new Set<() => void>();

function notify() {
  for (const listener of listeners) listener();
}

if (typeof window !== 'undefined' && /Android/i.test(navigator.userAgent)) {
  // Capture the single-use browser event before the user opens the share panel.
  window.addEventListener('beforeinstallprompt', event => {
    const candidate = event as PublicInstallEvent;
    if (installed || typeof candidate.prompt !== 'function') return;
    candidate.preventDefault();
    pending = candidate;
    notify();
  });
  window.addEventListener('appinstalled', () => {
    pending = undefined;
    installed = true;
    notify();
  });
}

export function subscribePublicInstall(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export function publicInstallState() {
  return installed ? 'installed' : pending ? 'ready' : 'unavailable';
}

export function promptPublicInstall() {
  const event = pending;
  if (!event) return;
  pending = undefined;
  try {
    return event.prompt();
  } finally {
    notify();
  }
}
