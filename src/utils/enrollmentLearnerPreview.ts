export function learnerPreviewToken() {
  if (window.parent === window || !/^\/enrollment\/?$/.test(window.location.pathname)) return null;
  const token = new URLSearchParams(window.location.search).get('learnerPreview');
  return token && /^[a-f0-9-]{36}$/i.test(token) ? token : null;
}
