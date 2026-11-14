export function toPersianDigits(input: number | string): string {
  const persian = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
  return String(input).replace(/\d/g, (d) => persian[Number(d)]);
}

export function formatToman(amount: number | null | undefined): string {
  if (amount === null || amount === undefined) return '۰ تومان';
  return `${Number(amount).toLocaleString('fa-IR')} تومان`;
}

export function formatPersianDate(isoDate?: string | null): string {
  if (!isoDate) return '—';
  try {
    return new Intl.DateTimeFormat('fa-IR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }).format(new Date(isoDate));
  } catch {
    return isoDate;
  }
}

export const ORDER_STATUS_META: Record<string, { label: string; tone: string }> = {
  pending_payment: { label: 'در انتظار پرداخت', tone: 'text-amber-700 bg-amber-50 border-amber-200' },
  payment_verification: { label: 'در حال بررسی فیش واریزی', tone: 'text-sky-700 bg-sky-50 border-sky-200' },
  paid: { label: 'پرداخت تایید شده', tone: 'text-emerald-700 bg-emerald-50 border-emerald-200' },
  processing: { label: 'در حال پردازش', tone: 'text-indigo-700 bg-indigo-50 border-indigo-200' },
  preparing: { label: 'در حال آماده‌سازی انبار', tone: 'text-violet-700 bg-violet-50 border-violet-200' },
  shipped: { label: 'تحویل به پیک / باربری', tone: 'text-cyan-700 bg-cyan-50 border-cyan-200' },
  delivered: { label: 'تحویل داده شده', tone: 'text-emerald-800 bg-emerald-100 border-emerald-300' },
  cancelled: { label: 'لغو شده', tone: 'text-rose-700 bg-rose-50 border-rose-200' },
  refunded: { label: 'مسترد شده', tone: 'text-stone-700 bg-stone-100 border-stone-300' },
};

let memorySessionToken: string | null = null;
let memoryGuestToken: string | null = null;

function readStorage(key: string): string | null {
  try {
    return window.localStorage.getItem(key) || window.sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorage(key: string, value: string | null) {
  try {
    if (value) {
      window.localStorage.setItem(key, value);
      window.sessionStorage.setItem(key, value);
    } else {
      window.localStorage.removeItem(key);
      window.sessionStorage.removeItem(key);
    }
  } catch {
    // ignore storage access errors in restricted iframes
  }
}

export function getSessionToken(): string | null {
  return memorySessionToken || readStorage('bp_session_token');
}

export function setSessionToken(token: string | null) {
  memorySessionToken = token;
  writeStorage('bp_session_token', token);
}

export function getGuestToken(): string | null {
  return memoryGuestToken || readStorage('bp_guest_token');
}

export function setGuestToken(token: string | null) {
  memoryGuestToken = token;
  writeStorage('bp_guest_token', token);
}

export async function apiFetch<T = any>(url: string, options?: RequestInit): Promise<T> {
  const isFormData = typeof FormData !== 'undefined' && options?.body instanceof FormData;
  const headers: Record<string, string> = isFormData
    ? {}
    : { 'Content-Type': 'application/json' };

  const sessionToken = getSessionToken();
  if (sessionToken) {
    headers['Authorization'] = `Bearer ${sessionToken}`;
  }
  const guestToken = getGuestToken();
  if (guestToken) {
    headers['x-guest-token'] = guestToken;
  }

  let res: Response;
  try {
    res = await fetch(url, {
      ...options,
      credentials: 'include',
      headers: {
        ...headers,
        ...(options?.headers as Record<string, string> | undefined),
      },
    });
  } catch {
    throw new Error('خطا در برقراری ارتباط با سرور. لطفاً دوباره تلاش کنید.');
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `خطا در ارتباط با سرور (کد ${res.status})`);
  }

  if (url.startsWith('/api/auth/login') || url.startsWith('/api/auth/register')) {
    if (data?.token) setSessionToken(data.token);
  } else if (url.startsWith('/api/auth/logout')) {
    setSessionToken(null);
  } else if (url.startsWith('/api/auth/me')) {
    if (data?.guestToken) setGuestToken(data.guestToken);
  }

  return data;
}

export async function downloadAuthenticatedFile(url: string, fallbackFilename: string): Promise<void> {
  const headers: Record<string, string> = {};
  const sessionToken = getSessionToken();
  if (sessionToken) {
    headers['Authorization'] = `Bearer ${sessionToken}`;
  }
  const res = await fetch(url, { credentials: 'include', headers });
  if (!res.ok) {
    throw new Error(`خطا در دانلود فایل (کد ${res.status})`);
  }
  const blob = await res.blob();
  const objectUrl = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = objectUrl;
  a.download = fallbackFilename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(objectUrl), 1500);
}

export function generateSlug(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '') || `item-${Date.now().toString(36)}`;
}

