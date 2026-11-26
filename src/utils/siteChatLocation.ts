import type {Location} from 'react-router-dom';

type SiteChatBackground = {location: Location; scrollY: number};

export function siteChatBackground(current: Location): SiteChatBackground | undefined {
  if (current.pathname !== '/chat') return;
  const background = current.state?.siteChatBackground as SiteChatBackground | undefined;
  const path = background?.location?.pathname;
  if (!path?.startsWith('/') || path.startsWith('//') ||
    /^\/(?:chat|consult|link|enrollment|crm|system|cms)(?:\/|$)/i.test(path)) return;
  return background;
}
