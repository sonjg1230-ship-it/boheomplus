import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import type { NextFunction, Request, Response } from 'express';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;
const DATA_DIR = path.join(__dirname, '.data');
const CONSULTATIONS_FILE = path.join(DATA_DIR, 'consultations.json');
const LOCKOUT_FILE = path.join(DATA_DIR, 'admin-lockout.json');
const SESSION_KEY_FILE = path.join(DATA_DIR, 'session-secret.key');

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 5 * 60 * 1000; // 5분 일시 잠금
const SESSION_TTL_MS = 4 * 60 * 60 * 1000; // 4시간 세션 유효

// Salted scrypt hash of the administrator password (never store plaintext)
const DEFAULT_PASSWORD_SALT = '75376529fc32cffe1d8e0f88152929bc';
const DEFAULT_PASSWORD_HASH =
  '8a9bb0951cfa223bb7bdd0ea21c95222c8455630614fad1e6bbeccf5fe7d3ca54ca152ad27b906a7bb4468c592d774ac3d9fd9195ada3dd6201574653ed81962';

type ConsultationStatus = '접수대기' | '상담배정' | '상담완료' | '보류';

interface StoredConsultation {
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
  memo: string;
  createdAt: string;
  updatedAt: string;
}

interface LockEntry {
  failedAttempts: number;
  lockedUntil: number | null;
  lastAttemptAt: number;
}

type LockStore = Record<string, LockEntry>;

const ALLOWED_STATUSES: ConsultationStatus[] = ['접수대기', '상담배정', '상담완료', '보류'];
const ALLOWED_PERIODS = [5, 7, 10] as const;
const ALLOWED_AMOUNTS = [10, 30, 50, 100, 150, 200] as const;

function ensureDataDir(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function getOrCreateSessionSecret(): Buffer {
  if (process.env.ADMIN_SESSION_SECRET && process.env.ADMIN_SESSION_SECRET.length >= 16) {
    return Buffer.from(process.env.ADMIN_SESSION_SECRET, 'utf8');
  }
  ensureDataDir();
  if (fs.existsSync(SESSION_KEY_FILE)) {
    const raw = fs.readFileSync(SESSION_KEY_FILE, 'utf8').trim();
    if (raw.length >= 32) {
      return Buffer.from(raw, 'hex');
    }
  }
  const secret = crypto.randomBytes(32);
  fs.writeFileSync(SESSION_KEY_FILE, secret.toString('hex'), { mode: 0o600 });
  return secret;
}

const SESSION_SECRET = getOrCreateSessionSecret();
const revokedTokens = new Set<string>();

function readJsonFile<T>(filePath: string, fallback: T): T {
  try {
    if (!fs.existsSync(filePath)) return fallback;
    const raw = fs.readFileSync(filePath, 'utf8');
    if (!raw.trim()) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeJsonAtomic(filePath: string, data: unknown): void {
  ensureDataDir();
  const tmpPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(tmpPath, JSON.stringify(data, null, 2), { encoding: 'utf8', mode: 0o600 });
  fs.renameSync(tmpPath, filePath);
}

function readConsultations(): StoredConsultation[] {
  const list = readJsonFile<StoredConsultation[]>(CONSULTATIONS_FILE, []);
  return Array.isArray(list) ? list : [];
}

function writeConsultations(records: StoredConsultation[]): void {
  writeJsonAtomic(CONSULTATIONS_FILE, records);
}

function readLockStore(): LockStore {
  const store = readJsonFile<LockStore>(LOCKOUT_FILE, {});
  return store && typeof store === 'object' ? store : {};
}

function writeLockStore(store: LockStore): void {
  writeJsonAtomic(LOCKOUT_FILE, store);
}

function getClientKeys(req: Request): string[] {
  const forwarded = req.headers['x-forwarded-for'];
  const rawIp = Array.isArray(forwarded)
    ? forwarded[0]
    : typeof forwarded === 'string'
      ? forwarded.split(',')[0]
      : req.ip || req.socket.remoteAddress || 'unknown';
  const normalizedIp = rawIp.trim().replace(/^::ffff:/, '') || 'unknown';

  const rawClientId = req.headers['x-admin-client-id'];
  const clientId =
    typeof rawClientId === 'string'
      ? rawClientId.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64)
      : '';

  const keys = [`ip:${normalizedIp}`];
  if (clientId.length >= 8) {
    keys.push(`dev:${clientId}`);
  }
  return keys;
}

function computeCombinedLockStatus(keys: string[]): {
  locked: boolean;
  failedAttempts: number;
  maxAttempts: number;
  remainingAttempts: number;
  lockedUntil: number | null;
  remainingSeconds: number;
} {
  const store = readLockStore();
  const now = Date.now();
  let changed = false;
  let maxFailed = 0;
  let maxLockedUntil: number | null = null;

  for (const key of keys) {
    const entry = store[key];
    if (!entry) continue;

    if (entry.lockedUntil !== null && entry.lockedUntil <= now) {
      delete store[key];
      changed = true;
      continue;
    }

    if (entry.lockedUntil !== null && entry.lockedUntil > now) {
      if (maxLockedUntil === null || entry.lockedUntil > maxLockedUntil) {
        maxLockedUntil = entry.lockedUntil;
      }
      maxFailed = Math.max(maxFailed, entry.failedAttempts);
    } else {
      maxFailed = Math.max(maxFailed, entry.failedAttempts);
    }
  }

  if (changed) {
    writeLockStore(store);
  }

  const locked = maxLockedUntil !== null && maxLockedUntil > now;
  const remainingSeconds = locked && maxLockedUntil ? Math.ceil((maxLockedUntil - now) / 1000) : 0;
  const clampedFailed = locked ? MAX_FAILED_ATTEMPTS : Math.min(MAX_FAILED_ATTEMPTS, maxFailed);
  const remainingAttempts = locked ? 0 : Math.max(0, MAX_FAILED_ATTEMPTS - clampedFailed);

  return {
    locked,
    failedAttempts: clampedFailed,
    maxAttempts: MAX_FAILED_ATTEMPTS,
    remainingAttempts,
    lockedUntil: maxLockedUntil,
    remainingSeconds,
  };
}

function recordFailedAttempt(keys: string[]) {
  const store = readLockStore();
  const now = Date.now();

  let nextFailed = 0;
  for (const key of keys) {
    const existing = store[key];
    if (existing && (!existing.lockedUntil || existing.lockedUntil > now)) {
      nextFailed = Math.max(nextFailed, existing.failedAttempts);
    }
  }
  nextFailed += 1;

  const shouldLock = nextFailed >= MAX_FAILED_ATTEMPTS;
  const lockedUntil = shouldLock ? now + LOCKOUT_DURATION_MS : null;

  for (const key of keys) {
    store[key] = {
      failedAttempts: nextFailed,
      lockedUntil,
      lastAttemptAt: now,
    };
  }

  writeLockStore(store);
  return computeCombinedLockStatus(keys);
}

function clearLockout(keys: string[]): void {
  const store = readLockStore();
  let changed = false;
  for (const key of keys) {
    if (store[key]) {
      delete store[key];
      changed = true;
    }
  }
  if (changed) {
    writeLockStore(store);
  }
}

function verifyAdminPassword(candidate: string): boolean {
  if (typeof candidate !== 'string' || candidate.length === 0 || candidate.length > 256) {
    return false;
  }

  const envSalt = process.env.ADMIN_PASSWORD_SALT || DEFAULT_PASSWORD_SALT;
  const envHash = process.env.ADMIN_PASSWORD_HASH || DEFAULT_PASSWORD_HASH;

  try {
    const expectedBuf = Buffer.from(envHash, 'hex');
    const derivedBuf = crypto.scryptSync(candidate, envSalt, expectedBuf.length);
    if (derivedBuf.length !== expectedBuf.length) {
      return false;
    }
    return crypto.timingSafeEqual(derivedBuf, expectedBuf);
  } catch {
    return false;
  }
}

function signSessionToken(): { token: string; expiresAt: number } {
  const now = Date.now();
  const expiresAt = now + SESSION_TTL_MS;
  const payloadObj = {
    role: 'admin',
    iat: now,
    exp: expiresAt,
    jti: crypto.randomBytes(12).toString('hex'),
  };
  const payloadB64 = Buffer.from(JSON.stringify(payloadObj), 'utf8').toString('base64url');
  const sigB64 = crypto.createHmac('sha256', SESSION_SECRET).update(payloadB64).digest('base64url');
  return {
    token: `${payloadB64}.${sigB64}`,
    expiresAt,
  };
}

function verifySessionToken(token: string): boolean {
  if (!token || revokedTokens.has(token)) return false;
  const parts = token.split('.');
  if (parts.length !== 2) return false;
  const [payloadB64, sigB64] = parts;
  if (!payloadB64 || !sigB64) return false;

  try {
    const expectedSig = crypto
      .createHmac('sha256', SESSION_SECRET)
      .update(payloadB64)
      .digest('base64url');
    const sigBuf = Buffer.from(sigB64, 'utf8');
    const expBuf = Buffer.from(expectedSig, 'utf8');
    if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
      return false;
    }
    const decoded = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8')) as {
      role?: string;
      exp?: number;
    };
    if (decoded.role !== 'admin' || typeof decoded.exp !== 'number') {
      return false;
    }
    return decoded.exp > Date.now();
  } catch {
    return false;
  }
}

function extractBearerToken(req: Request): string {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) return '';
  return authHeader.slice(7).trim();
}

function requireAdminAuth(req: Request, res: Response, next: NextFunction): void {
  const token = extractBearerToken(req);
  if (!verifySessionToken(token)) {
    res.status(401).json({ error: '관리자 인증이 필요하거나 세션이 만료되었습니다.' });
    return;
  }
  next();
}

function formatLockMessage(remainingSeconds: number): string {
  const mins = Math.floor(remainingSeconds / 60);
  const secs = remainingSeconds % 60;
  return `비밀번호 5회 이상 오류로 보안상 일시 잠금되었습니다. (${mins}분 ${String(secs).padStart(2, '0')}초 후 재시도)`;
}

function sanitizeIncomingConsultation(body: Record<string, unknown>): StoredConsultation | null {
  const id =
    typeof body.id === 'string' && /^[a-zA-Z0-9_-]{3,128}$/.test(body.id)
      ? body.id
      : `lead-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  const regCode =
    typeof body.regCode === 'string' && /^PC-[0-9]{4}-[0-9]{4}$/.test(body.regCode)
      ? body.regCode
      : `PC-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;

  const name = typeof body.name === 'string' ? body.name.trim().slice(0, 40) : '';
  const phone = typeof body.phone === 'string' ? body.phone.replace(/[^0-9-]/g, '').slice(0, 20) : '';
  const birthDate =
    typeof body.birthDate === 'string' ? body.birthDate.replace(/[^0-9]/g, '').slice(0, 6) : '';
  const gender: 'male' | 'female' = body.gender === 'female' ? 'female' : 'male';
  const region = typeof body.region === 'string' ? body.region.trim().slice(0, 40) : '';
  const rawPeriod = Number(body.period);
  const period = (ALLOWED_PERIODS.includes(rawPeriod as 5 | 7 | 10) ? rawPeriod : 5) as 5 | 7 | 10;
  const rawAmount = Number(body.monthlyAmount);
  const monthlyAmount = (ALLOWED_AMOUNTS.includes(rawAmount as (typeof ALLOWED_AMOUNTS)[number])
    ? rawAmount
    : 50) as 10 | 30 | 50 | 100 | 150 | 200;
  const tenYearValue = Math.min(1000000, Math.max(1, Math.round(Number(body.tenYearValue) || 0)));

  if (!name || phone.length < 9 || !/^[0-9]{6}$/.test(birthDate) || region.length < 2) {
    return null;
  }

  const rawStatus = body.status as ConsultationStatus;
  const status: ConsultationStatus = ALLOWED_STATUSES.includes(rawStatus) ? rawStatus : '접수대기';
  const memo = typeof body.memo === 'string' ? body.memo.trim().slice(0, 300) : '';
  const nowIso = new Date().toISOString();
  const createdAt = typeof body.createdAt === 'string' && body.createdAt ? body.createdAt : nowIso;
  const updatedAt = typeof body.updatedAt === 'string' && body.updatedAt ? body.updatedAt : nowIso;

  return {
    id,
    regCode,
    name,
    phone,
    birthDate,
    gender,
    region,
    period,
    monthlyAmount,
    tenYearValue,
    status,
    memo,
    createdAt,
    updatedAt,
  };
}

async function startServer() {
  const app = express();
  app.set('trust proxy', true);
  app.use(express.json({ limit: '256kb' }));

  // 1. Admin Lock Status
  app.get('/api/admin/lock-status', (req: Request, res: Response) => {
    const keys = getClientKeys(req);
    const status = computeCombinedLockStatus(keys);
    res.json(status);
  });

  // 2. Admin Password Login (with 5-attempt lockout)
  app.post('/api/admin/login', (req: Request, res: Response) => {
    const keys = getClientKeys(req);
    const currentLock = computeCombinedLockStatus(keys);

    if (currentLock.locked) {
      res.status(429).json({
        ok: false,
        ...currentLock,
        message: formatLockMessage(currentLock.remainingSeconds),
      });
      return;
    }

    const password = typeof req.body?.password === 'string' ? req.body.password : '';
    if (!verifyAdminPassword(password)) {
      const nextLock = recordFailedAttempt(keys);
      if (nextLock.locked) {
        res.status(429).json({
          ok: false,
          ...nextLock,
          message: formatLockMessage(nextLock.remainingSeconds),
        });
        return;
      }

      res.status(401).json({
        ok: false,
        ...nextLock,
        message: `비밀번호가 올바르지 않습니다. (${nextLock.failedAttempts}/${MAX_FAILED_ATTEMPTS}회 오류 · ${nextLock.remainingAttempts}회 남음)`,
      });
      return;
    }

    clearLockout(keys);
    const session = signSessionToken();
    res.json({
      ok: true,
      token: session.token,
      expiresAt: session.expiresAt,
      locked: false,
      failedAttempts: 0,
      maxAttempts: MAX_FAILED_ATTEMPTS,
      remainingAttempts: MAX_FAILED_ATTEMPTS,
      remainingSeconds: 0,
    });
  });

  // 3. Verify & Logout
  app.get('/api/admin/verify', requireAdminAuth, (_req: Request, res: Response) => {
    res.json({ ok: true });
  });

  app.post('/api/admin/logout', (req: Request, res: Response) => {
    const token = extractBearerToken(req);
    if (token) {
      revokedTokens.add(token);
    }
    res.json({ ok: true });
  });

  // 4. Public Consultation Creation (called alongside Firestore write)
  app.post('/api/consultations', (req: Request, res: Response) => {
    const record = sanitizeIncomingConsultation((req.body ?? {}) as Record<string, unknown>);
    if (!record) {
      res.status(400).json({ error: '입력 항목을 다시 확인해 주세요.' });
      return;
    }

    const records = readConsultations();
    const existingIdx = records.findIndex((r) => r.id === record.id);
    if (existingIdx >= 0) {
      records[existingIdx] = record;
    } else {
      records.unshift(record);
    }
    writeConsultations(records.slice(0, 1000));
    res.status(201).json({ ok: true, id: record.id, regCode: record.regCode });
  });

  // 5. Admin Protected Consultation CRUD
  app.get('/api/admin/consultations', requireAdminAuth, (_req: Request, res: Response) => {
    const records = readConsultations().sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
    res.json({ records });
  });

  app.post('/api/admin/consultations/sync', requireAdminAuth, (req: Request, res: Response) => {
    const incomingList = Array.isArray(req.body?.records) ? req.body.records : [];
    const current = readConsultations();
    const byId = new Map<string, StoredConsultation>(current.map((r) => [r.id, r]));

    let added = 0;
    for (const raw of incomingList) {
      if (!raw || typeof raw !== 'object') continue;
      const sanitized = sanitizeIncomingConsultation(raw as Record<string, unknown>);
      if (!sanitized) continue;
      if (!byId.has(sanitized.id)) {
        byId.set(sanitized.id, sanitized);
        added += 1;
      }
    }

    const merged = Array.from(byId.values()).sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
    writeConsultations(merged.slice(0, 1000));
    res.json({ ok: true, added, total: merged.length, records: merged });
  });

  app.patch('/api/admin/consultations/:id', requireAdminAuth, (req: Request, res: Response) => {
    const id = req.params.id;
    const status = req.body?.status as ConsultationStatus;
    const memo = typeof req.body?.memo === 'string' ? req.body.memo.trim().slice(0, 300) : '';

    if (!ALLOWED_STATUSES.includes(status)) {
      res.status(400).json({ error: '유효하지 않은 상담 상태입니다.' });
      return;
    }

    const records = readConsultations();
    const idx = records.findIndex((r) => r.id === id);
    if (idx < 0) {
      res.status(404).json({ error: '해당 상담 내역을 찾을 수 없습니다.' });
      return;
    }

    records[idx] = {
      ...records[idx],
      status,
      memo,
      updatedAt: new Date().toISOString(),
    };
    writeConsultations(records);
    res.json({ ok: true, record: records[idx] });
  });

  app.delete('/api/admin/consultations/:id', requireAdminAuth, (req: Request, res: Response) => {
    const id = req.params.id;
    const records = readConsultations();
    const filtered = records.filter((r) => r.id !== id);
    writeConsultations(filtered);
    res.json({ ok: true });
  });

  // Vite middleware (dev) or static dist serving (prod)
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.join(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server listening on http://0.0.0.0:${PORT}`);
  });
}

void startServer();
