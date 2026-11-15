import type { ConsultationRecord, ConsultationStatus } from './firebase';

const CLIENT_ID_KEY = 'bohumplus_admin_cid';
const TOKEN_STORAGE_KEY = 'bohumplus_admin_token';
const TOKEN_EXP_STORAGE_KEY = 'bohumplus_admin_exp';

export interface AdminLockStatus {
  locked: boolean;
  failedAttempts: number;
  maxAttempts: number;
  remainingAttempts: number;
  lockedUntil: number | null;
  remainingSeconds: number;
  message?: string;
}

export interface AdminLoginResult extends AdminLockStatus {
  ok: boolean;
  token?: string;
  expiresAt?: number;
}

function getClientId(): string {
  try {
    const existing = localStorage.getItem(CLIENT_ID_KEY);
    if (existing && existing.length >= 8) return existing;
    const generated = `cid-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
    localStorage.setItem(CLIENT_ID_KEY, generated);
    return generated;
  } catch {
    return 'cid-ephemeral-session';
  }
}

export function getSavedAdminToken(): string | null {
  try {
    const token = sessionStorage.getItem(TOKEN_STORAGE_KEY);
    const expRaw = sessionStorage.getItem(TOKEN_EXP_STORAGE_KEY);
    const exp = expRaw ? Number(expRaw) : 0;
    if (!token || (exp > 0 && exp <= Date.now())) {
      sessionStorage.removeItem(TOKEN_STORAGE_KEY);
      sessionStorage.removeItem(TOKEN_EXP_STORAGE_KEY);
      return null;
    }
    return token;
  } catch {
    return null;
  }
}

function saveAdminToken(token: string, expiresAt: number): void {
  try {
    sessionStorage.setItem(TOKEN_STORAGE_KEY, token);
    sessionStorage.setItem(TOKEN_EXP_STORAGE_KEY, String(expiresAt));
  } catch {
    // ignore storage errors
  }
}

export function clearSavedAdminToken(): void {
  try {
    sessionStorage.removeItem(TOKEN_STORAGE_KEY);
    sessionStorage.removeItem(TOKEN_EXP_STORAGE_KEY);
  } catch {
    // ignore storage errors
  }
}

function baseHeaders(extra?: Record<string, string>): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    'x-admin-client-id': getClientId(),
    ...extra,
  };
}

function authHeaders(): Record<string, string> {
  const token = getSavedAdminToken();
  return baseHeaders(token ? { Authorization: `Bearer ${token}` } : undefined);
}

export async function getAdminLockStatus(): Promise<AdminLockStatus> {
  const res = await fetch('/api/admin/lock-status', {
    method: 'GET',
    headers: baseHeaders(),
  });
  if (!res.ok) {
    throw new Error('잠금 상태를 확인할 수 없습니다.');
  }
  return (await res.json()) as AdminLockStatus;
}

export async function loginAdminWithPassword(password: string): Promise<AdminLoginResult> {
  const res = await fetch('/api/admin/login', {
    method: 'POST',
    headers: baseHeaders(),
    body: JSON.stringify({ password }),
  });

  const data = (await res.json()) as AdminLoginResult;
  if (res.ok && data.ok && data.token) {
    saveAdminToken(data.token, data.expiresAt || Date.now() + 4 * 60 * 60 * 1000);
    return data;
  }
  return {
    ok: false,
    locked: Boolean(data.locked),
    failedAttempts: Number(data.failedAttempts) || 0,
    maxAttempts: Number(data.maxAttempts) || 5,
    remainingAttempts: Number(data.remainingAttempts) ?? 5,
    lockedUntil: data.lockedUntil ?? null,
    remainingSeconds: Number(data.remainingSeconds) || 0,
    message: data.message || '비밀번호가 올바르지 않습니다.',
  };
}

export async function verifyAdminToken(): Promise<boolean> {
  const token = getSavedAdminToken();
  if (!token) return false;
  try {
    const res = await fetch('/api/admin/verify', {
      method: 'GET',
      headers: authHeaders(),
    });
    if (!res.ok) {
      clearSavedAdminToken();
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

export async function logoutAdminPasswordSession(): Promise<void> {
  const token = getSavedAdminToken();
  clearSavedAdminToken();
  if (!token) return;
  try {
    await fetch('/api/admin/logout', {
      method: 'POST',
      headers: baseHeaders({ Authorization: `Bearer ${token}` }),
    });
  } catch {
    // ignore logout network errors
  }
}

interface RawServerConsultation {
  id: string;
  regCode: string;
  name: string;
  phone: string;
  birthDate: string;
  gender: 'male' | 'female';
  region: string;
  period: 5 | 7 | 10;
  monthlyAmount: 10 | 30 | 50 | 100 | 150 | 200;
  tenYearValue: number;
  status: ConsultationStatus;
  memo?: string;
  createdAt?: string | null;
  updatedAt?: string | null;
}

function mapServerRecord(raw: RawServerConsultation): ConsultationRecord {
  return {
    id: raw.id,
    regCode: raw.regCode,
    name: raw.name,
    phone: raw.phone,
    birthDate: raw.birthDate,
    gender: raw.gender === 'female' ? 'female' : 'male',
    region: raw.region,
    period: raw.period,
    monthlyAmount: raw.monthlyAmount,
    tenYearValue: raw.tenYearValue,
    status: raw.status,
    memo: raw.memo ?? '',
    createdAt: raw.createdAt ? new Date(raw.createdAt) : null,
    updatedAt: raw.updatedAt ? new Date(raw.updatedAt) : null,
  };
}

export async function fetchServerConsultations(): Promise<ConsultationRecord[]> {
  const res = await fetch('/api/admin/consultations', {
    method: 'GET',
    headers: authHeaders(),
  });
  if (res.status === 401) {
    clearSavedAdminToken();
    throw new Error('SESSION_EXPIRED');
  }
  if (!res.ok) {
    throw new Error('상담 내역을 불러오는 중 오류가 발생했습니다.');
  }
  const data = (await res.json()) as { records?: RawServerConsultation[] };
  return (data.records ?? []).map(mapServerRecord);
}

export async function updateServerConsultation(
  docId: string,
  status: ConsultationStatus,
  memo: string
): Promise<void> {
  const res = await fetch(`/api/admin/consultations/${encodeURIComponent(docId)}`, {
    method: 'PATCH',
    headers: authHeaders(),
    body: JSON.stringify({ status, memo }),
  });
  if (res.status === 401) {
    clearSavedAdminToken();
    throw new Error('세션이 만료되었습니다. 다시 로그인해 주세요.');
  }
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(err.error || '상담 내역 수정 중 오류가 발생했습니다.');
  }
}

export async function deleteServerConsultation(docId: string): Promise<void> {
  const res = await fetch(`/api/admin/consultations/${encodeURIComponent(docId)}`, {
    method: 'DELETE',
    headers: authHeaders(),
  });
  if (res.status === 401) {
    clearSavedAdminToken();
    throw new Error('세션이 만료되었습니다. 다시 로그인해 주세요.');
  }
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(err.error || '상담 내역 삭제 중 오류가 발생했습니다.');
  }
}

export async function syncCloudRecordsToServer(
  records: ConsultationRecord[]
): Promise<ConsultationRecord[]> {
  const payload = records.map((r) => ({
    id: r.id,
    regCode: r.regCode,
    name: r.name,
    phone: r.phone,
    birthDate: r.birthDate,
    gender: r.gender,
    region: r.region,
    period: r.period,
    monthlyAmount: r.monthlyAmount,
    tenYearValue: r.tenYearValue,
    status: r.status,
    memo: r.memo ?? '',
    createdAt: r.createdAt ? r.createdAt.toISOString() : new Date().toISOString(),
    updatedAt: r.updatedAt ? r.updatedAt.toISOString() : new Date().toISOString(),
  }));

  const res = await fetch('/api/admin/consultations/sync', {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ records: payload }),
  });
  if (!res.ok) {
    throw new Error('동기화 중 오류가 발생했습니다.');
  }
  const data = (await res.json()) as { records?: RawServerConsultation[] };
  return (data.records ?? []).map(mapServerRecord);
}
