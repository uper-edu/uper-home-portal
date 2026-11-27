let guard: ((event: PopStateEvent) => void) | undefined;

// Register before BrowserRouter so unsaved work can keep its route mounted.
export function installAdminWorkspaceHistoryGuard() {
  if (typeof window !== 'undefined') window.addEventListener('popstate', dispatch, true);
}

function dispatch(event: PopStateEvent) {
  guard?.(event);
}

export function guardAdminWorkspaceHistory(handler: (event: PopStateEvent) => void) {
  guard = handler;
  return () => {
    if (guard === handler) guard = undefined;
  };
}
