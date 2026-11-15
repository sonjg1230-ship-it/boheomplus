import type { ConsultationRecord, ConsultationStatus } from './firebase';
import {
  ImportedVaultKeys,
  UnlockedVaultKeyPair,
  importVaultKeyPair,
  unlockVaultWithPassword,
} from './vaultCrypto';

const CLIENT_ID_KEY = 'bohumplus_admin_cid';
const TOKEN_STORAGE_KEY = 'bohumplus_admin_token';
const TOKEN_EXP_STORAGE_KEY = 'bohumplus_admin_exp';
const VAULT_SESSION_KEY = 'bohumplus_vault_session_v1';
const LOCAL_LOCKOUT_KEY = 'bohumplus_admin_lockout_v1';

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 5 * 60 * 1000; // 5분 일시 잠금

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
  vaultKeys?: ImportedVaultKeys;
}

interface LocalLockRecord {
  failedAttempts: number;
  lockedUntil: number | null;
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

function readLocalLock(): AdminLockStatus {
  try {
    const raw = localStorage.getItem(LOCAL_LOCKOUT_KEY);
    if (!raw) {
      return {
        locked: false,
        failedAttempts: 0,
        maxAttempts: MAX_FAILED_ATTEMPTS,
        remainingAttempts: MAX_FAILED_ATTEMPTS,
        lockedUntil: null,
        remainingSeconds: 0,
      };
    }
    const parsed = JSON.parse(raw) as LocalLockRecord;
    const now = Date.now();
    if (parsed.lockedUntil && parsed.lockedUntil <= now) {
      localStorage.removeItem(LOCAL_LOCKOUT_KEY);
      return {
        locked: false,
        failedAttempts: 0,
        maxAttempts: MAX_FAILED_ATTEMPTS,
        remainingAttempts: MAX_FAILED_ATTEMPTS,
        lockedUntil: null,
        remainingSeconds: 0,
      };
    }

    const locked = Boolean(parsed.lockedUntil && parsed.lockedUntil > now);
    const remainingSeconds =
      locked && parsed.lockedUntil ? Math.ceil((parsed.lockedUntil - now) / 1000) : 0;
    const failedAttempts = locked
      ? MAX_FAILED_ATTEMPTS
      : Math.min(MAX_FAILED_ATTEMPTS, Number(parsed.failedAttempts) || 0);
    return {
      locked,
      failedAttempts,
      maxAttempts: MAX_FAILED_ATTEMPTS,
      remainingAttempts: locked ? 0 : Math.max(0, MAX_FAILED_ATTEMPTS - failedAttempts),
      lockedUntil: parsed.lockedUntil ?? null,
      remainingSeconds,
    };
  } catch {
    return {
      locked: false,
      failedAttempts: 0,
      maxAttempts: MAX_FAILED_ATTEMPTS,
      remainingAttempts: MAX_FAILED_ATTEMPTS,
      lockedUntil: null,
      remainingSeconds: 0,
    };
  }
}

function recordLocalFailure(): AdminLockStatus {
  const current = readLocalLock();
  const nextFailed = current.failedAttempts + 1;
  const shouldLock = nextFailed >= MAX_FAILED_ATTEMPTS;
  const lockedUntil = shouldLock ? Date.now() + LOCKOUT_DURATION_MS : null;

  try {
    localStorage.setItem(
      LOCAL_LOCKOUT_KEY,
      JSON.stringify({ failedAttempts: nextFailed, lockedUntil })
    );
  } catch {
    // ignore storage errors
  }

  return readLocalLock();
}

function clearLocalLock(): void {
  try {
    localStorage.removeItem(LOCAL_LOCKOUT_KEY);
  } catch {
    // ignore storage errors
  }
}

function formatLockMessage(remainingSeconds: number): string {
  const mins = Math.floor(remainingSeconds / 60);
  const secs = remainingSeconds % 60;
  return `비밀번호 5회 이상 오류로 보안상 일시 잠금되었습니다. (${mins}분 ${String(secs).padStart(2, '0')}초 후 재시도)`;
}

function mergeLockStatus(a: AdminLockStatus, b: AdminLockStatus): AdminLockStatus {
  const locked = a.locked || b.locked;
  const lockedUntil =
    Math.max(a.lockedUntil ?? 0, b.lockedUntil ?? 0) || null;
  const remainingSeconds = Math.max(a.remainingSeconds, b.remainingSeconds);
  const failedAttempts = locked
    ? MAX_FAILED_ATTEMPTS
    : Math.max(a.failedAttempts, b.failedAttempts);
  return {
    locked,
    failedAttempts,
    maxAttempts: MAX_FAILED_ATTEMPTS,
    remainingAttempts: locked ? 0 : Math.max(0, MAX_FAILED_ATTEMPTS - failedAttempts),
    lockedUntil,
    remainingSeconds,
    message: locked ? formatLockMessage(remainingSeconds) : b.message || a.message,
  };
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

function saveVaultSession(jwkPair: UnlockedVaultKeyPair): void {
  try {
    sessionStorage.setItem(VAULT_SESSION_KEY, JSON.stringify(jwkPair));
  } catch {
    // ignore storage errors
  }
}

export async function restoreVaultSession(): Promise<ImportedVaultKeys | null> {
  try {
    const raw = sessionStorage.getItem(VAULT_SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as UnlockedVaultKeyPair;
    if (!parsed?.rsaPrivateJwk || !parsed?.ecdsaPrivateJwk) return null;
    return await importVaultKeyPair(parsed);
  } catch {
    return null;
  }
}

export function clearSavedAdminSession(): void {
  try {
    sessionStorage.removeItem(TOKEN_STORAGE_KEY);
    sessionStorage.removeItem(TOKEN_EXP_STORAGE_KEY);
    sessionStorage.removeItem(VAULT_SESSION_KEY);
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

async function safeParseJson<T>(res: Response): Promise<T | null> {
  try {
    const contentType = res.headers.get('content-type') || '';
    const text = await res.text();
    if (!text) return null;
    if (!contentType.includes('application/json') && !text.trim().startsWith('{')) {
      return null;
    }
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

export async function getAdminLockStatus(): Promise<AdminLockStatus> {
  const local = readLocalLock();
  try {
    const res = await fetch('/api/admin/lock-status', {
      method: 'GET',
      headers: baseHeaders(),
    });
    const remote = await safeParseJson<AdminLockStatus>(res);
    if (res.ok && remote) {
      return mergeLockStatus(local, remote);
    }
  } catch {
    // Static hosting fallback (e.g. Shared App URL without Express backend)
  }
  return local;
}

export async function loginAdminWithPassword(password: string): Promise<AdminLoginResult> {
  const localBefore = readLocalLock();
  if (localBefore.locked) {
    return {
      ok: false,
      ...localBefore,
      message: formatLockMessage(localBefore.remainingSeconds),
    };
  }

  // 1. Check backend lock/verify if Express /api is reachable
  let remoteResult: AdminLoginResult | null = null;
  try {
    const res = await fetch('/api/admin/login', {
      method: 'POST',
      headers: baseHeaders(),
      body: JSON.stringify({ password }),
    });
    const parsed = await safeParseJson<AdminLoginResult>(res);
    if (parsed) {
      remoteResult = parsed;
      if (parsed.locked) {
        try {
          localStorage.setItem(
            LOCAL_LOCKOUT_KEY,
            JSON.stringify({
              failedAttempts: MAX_FAILED_ATTEMPTS,
              lockedUntil: parsed.lockedUntil ?? Date.now() + LOCKOUT_DURATION_MS,
            })
          );
        } catch {
          // ignore
        }
        return {
          ok: false,
          ...mergeLockStatus(readLocalLock(), parsed),
          message: parsed.message || formatLockMessage(parsed.remainingSeconds),
        };
      }
      if (res.ok && parsed.ok && parsed.token) {
        saveAdminToken(parsed.token, parsed.expiresAt || Date.now() + 4 * 60 * 60 * 1000);
      }
    }
  } catch {
    // Backend /api unavailable on static Shared App URL — verify via WebCrypto vault below
  }

  // 2. Cryptographic WebCrypto PBKDF2 + AES-GCM zero-knowledge vault verification (works on ALL PC/Mobile hosts)
  try {
    const vaultKeys = await unlockVaultWithPassword(password);
    clearLocalLock();
    saveVaultSession(vaultKeys.jwkPair);
    return {
      ok: true,
      token: remoteResult?.token,
      expiresAt: remoteResult?.expiresAt,
      vaultKeys,
      locked: false,
      failedAttempts: 0,
      maxAttempts: MAX_FAILED_ATTEMPTS,
      remainingAttempts: MAX_FAILED_ATTEMPTS,
      lockedUntil: null,
      remainingSeconds: 0,
    };
  } catch {
    const nextLocal = recordLocalFailure();
    const combined = remoteResult ? mergeLockStatus(nextLocal, remoteResult) : nextLocal;

    if (combined.locked) {
      return {
        ok: false,
        ...combined,
        message: formatLockMessage(combined.remainingSeconds),
      };
    }

    return {
      ok: false,
      ...combined,
      message: `비밀번호가 올바르지 않습니다. (${combined.failedAttempts}/${MAX_FAILED_ATTEMPTS}회 오류 · ${combined.remainingAttempts}회 남음)`,
    };
  }
}

export async function logoutAdminPasswordSession(): Promise<void> {
  const token = getSavedAdminToken();
  clearSavedAdminSession();
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

export async function fetchServerConsultationsOptional(): Promise<ConsultationRecord[]> {
  if (!getSavedAdminToken()) return [];
  try {
    const res = await fetch('/api/admin/consultations', {
      method: 'GET',
      headers: authHeaders(),
    });
    const data = await safeParseJson<{ records?: RawServerConsultation[] }>(res);
    if (!res.ok || !data?.records) return [];
    return data.records.map(mapServerRecord);
  } catch {
    return [];
  }
}

export async function updateServerConsultationOptional(
  docId: string,
  status: ConsultationStatus,
  memo: string
): Promise<void> {
  if (!getSavedAdminToken()) return;
  try {
    await fetch(`/api/admin/consultations/${encodeURIComponent(docId)}`, {
      method: 'PATCH',
      headers: authHeaders(),
      body: JSON.stringify({ status, memo }),
    });
  } catch {
    // Best-effort sync
  }
}

export async function deleteServerConsultationOptional(docId: string): Promise<void> {
  if (!getSavedAdminToken()) return;
  try {
    await fetch(`/api/admin/consultations/${encodeURIComponent(docId)}`, {
      method: 'DELETE',
      headers: authHeaders(),
    });
  } catch {
    // Best-effort sync
  }
}

export async function syncCloudRecordsToServerOptional(
  records: ConsultationRecord[]
): Promise<void> {
  if (!getSavedAdminToken()) return;
  try {
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
    await fetch('/api/admin/consultations/sync', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ records: payload }),
    });
  } catch {
    // Best-effort sync
  }
}
