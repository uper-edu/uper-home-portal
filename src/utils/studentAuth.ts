import { useEffect, useState } from 'react';

export const STUDENT_PORTAL_URL =
  (import.meta as any).env.VITE_STUDENT_PORTAL_URL || 'https://student.uperedu.com/';
const STUDENT_API_BASE =
  (import.meta as any).env.VITE_STUDENT_API_URL || 'https://student-api.uperedu.com/bootstrap';

const SSO_COOKIE_NAME = 'uper_sso_token';
const COOKIE_DOMAIN = '.uperedu.com';

function isUperHost(): boolean {
  return typeof location !== 'undefined' && location.hostname.endsWith('uperedu.com');
}

export function readSsoToken(): string {
  if (typeof document === 'undefined') return '';
  const match = document.cookie.match(new RegExp('(?:^|; )' + SSO_COOKIE_NAME + '=([^;]*)'));
  return match ? decodeURIComponent(match[1]) : '';
}

export function clearSsoToken(): void {
  if (!isUperHost()) return;
  document.cookie = `${SSO_COOKIE_NAME}=; Domain=${COOKIE_DOMAIN}; Path=/; Max-Age=0; SameSite=Lax`;
}

type ProfileEnvelope = {
  data?: {
    realName?: string;
    nickname?: string;
    username?: string;
  };
};

export async function fetchStudentName(token: string, locale: string): Promise<string | null> {
  if (!token) return null;
  try {
    const res = await fetch(`${STUDENT_API_BASE}/api/student/auth/get-profile`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        'X-Client-Type': 'student',
        'X-Tenant-Id': '8888',
        'X-Locale': locale,
      },
      body: '{}',
    });
    if (res.status === 401) {
      clearSsoToken();
      return null;
    }
    if (!res.ok) return null;
    const payload = (await res.json()) as ProfileEnvelope;
    if (payload?.data == null) {
      clearSsoToken();
      return null;
    }
    const { realName, nickname, username } = payload.data;
    return realName || nickname || username || null;
  } catch {
    return null;
  }
}

export function useStudentName(locale: string): { name: string | null; loading: boolean } {
  const [name, setName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = readSsoToken();
    if (!token) {
      setLoading(false);
      return;
    }

    let active = true;
    setLoading(true);
    fetchStudentName(token, locale).then((result) => {
      if (!active) return;
      setName(result);
      setLoading(false);
    });

    return () => {
      active = false;
    };
  }, [locale]);

  return { name, loading };
}
