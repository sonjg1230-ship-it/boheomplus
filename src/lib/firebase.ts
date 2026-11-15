import { initializeApp } from 'firebase/app';
import {
  GoogleAuthProvider,
  User,
  getAuth,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
} from 'firebase/auth';
import {
  Timestamp,
  collection,
  deleteDoc,
  doc,
  getDocFromServer,
  getFirestore,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  writeBatch,
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

export const ADMIN_EMAIL = 'sonjg1230@gmail.com';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
    }
  }
}

void testConnection();

export type ConsultationStatus = '접수대기' | '상담배정' | '상담완료' | '보류';

export interface ConsultationRecord {
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
  createdAt: Date | null;
  updatedAt: Date | null;
}

export interface PublicFeedRecord {
  id: string;
  maskedName: string;
  regionLabel: string;
  period: 5 | 7 | 10;
  monthlyAmount: 10 | 30 | 50 | 100 | 150 | 200;
  tenYearValue: number;
  createdAt: Date | null;
}

export interface SubmitConsultationInput {
  name: string;
  phone: string;
  birthDate: string;
  gender: 'male' | 'female';
  region: string;
  period: number;
  monthlyAmount: number;
  tenYearValue: number;
}

const ALLOWED_PERIODS = [5, 7, 10] as const;
const ALLOWED_AMOUNTS = [10, 30, 50, 100, 150, 200] as const;
const ALLOWED_STATUSES: ConsultationStatus[] = ['접수대기', '상담배정', '상담완료', '보류'];

function maskKoreanName(rawName: string): string {
  const trimmed = rawName.trim().slice(0, 20);
  if (trimmed.length <= 1) return trimmed;
  if (trimmed.length === 2) return `${trimmed[0]}*`;
  return `${trimmed[0]}*${trimmed.slice(2)}`.slice(0, 20);
}

export function normalizePhoneInput(rawPhone: string): string {
  const cleaned = rawPhone.replace(/[^0-9-]/g, '').trim();
  if (cleaned.includes('-')) return cleaned.slice(0, 20);
  const digits = cleaned.replace(/-/g, '');
  if (digits.length === 11) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
  }
  if (digits.length === 10) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  return digits.slice(0, 20);
}

export function validateConsultationInput(input: SubmitConsultationInput): {
  valid: boolean;
  errorMessage?: string;
  sanitized?: {
    name: string;
    phone: string;
    birthDate: string;
    gender: 'male' | 'female';
    region: string;
    period: 5 | 7 | 10;
    monthlyAmount: 10 | 30 | 50 | 100 | 150 | 200;
    tenYearValue: number;
  };
} {
  const name = input.name.trim().slice(0, 40);
  if (name.length < 1 || name.length > 40) {
    return { valid: false, errorMessage: '성함을 1~40자 이내로 입력해 주세요.' };
  }

  const phone = normalizePhoneInput(input.phone);
  if (phone.length < 9 || phone.length > 20 || !/^[0-9-]+$/.test(phone)) {
    return { valid: false, errorMessage: '연락처를 정확히 입력해 주세요. (예: 010-1234-5678)' };
  }

  const birthDate = input.birthDate.replace(/[^0-9]/g, '').slice(0, 6);
  if (!/^[0-9]{6}$/.test(birthDate)) {
    return { valid: false, errorMessage: '생년월일 6자리 숫자를 입력해 주세요. (예: 850315)' };
  }

  const gender: 'male' | 'female' = input.gender === 'female' ? 'female' : 'male';
  const region = input.region.trim().slice(0, 40);
  if (region.length < 2) {
    return { valid: false, errorMessage: '거주 지역을 선택해 주세요.' };
  }

  const period = (ALLOWED_PERIODS.includes(input.period as 5 | 7 | 10)
    ? input.period
    : 5) as 5 | 7 | 10;

  const monthlyAmount = (ALLOWED_AMOUNTS.includes(input.monthlyAmount as (typeof ALLOWED_AMOUNTS)[number])
    ? input.monthlyAmount
    : 50) as 10 | 30 | 50 | 100 | 150 | 200;

  const tenYearValue = Math.min(1000000, Math.max(1, Math.round(input.tenYearValue)));

  return {
    valid: true,
    sanitized: {
      name,
      phone,
      birthDate,
      gender,
      region,
      period,
      monthlyAmount,
      tenYearValue,
    },
  };
}

export async function submitConsultationLead(input: SubmitConsultationInput): Promise<{
  docId: string;
  regCode: string;
  maskedName: string;
}> {
  const validation = validateConsultationInput(input);
  if (!validation.valid || !validation.sanitized) {
    throw new Error(validation.errorMessage || '입력 값을 다시 확인해 주세요.');
  }

  const clean = validation.sanitized;
  const year = new Date().getFullYear();
  const randomDigits = Math.floor(1000 + Math.random() * 9000);
  const regCode = `PC-${year}-${randomDigits}`;
  const docId = `lead-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const maskedName = maskKoreanName(clean.name);

  try {
    const batch = writeBatch(db);
    const consultationRef = doc(db, 'consultations', docId);
    const feedRef = doc(db, 'public_feed', docId);

    batch.set(consultationRef, {
      regCode,
      name: clean.name,
      phone: clean.phone,
      birthDate: clean.birthDate,
      gender: clean.gender,
      region: clean.region,
      period: clean.period,
      monthlyAmount: clean.monthlyAmount,
      tenYearValue: clean.tenYearValue,
      status: '접수대기',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    batch.set(feedRef, {
      maskedName,
      regionLabel: clean.region,
      period: clean.period,
      monthlyAmount: clean.monthlyAmount,
      tenYearValue: clean.tenYearValue,
      createdAt: serverTimestamp(),
    });

    await batch.commit();

    // Also persist to backend store so password-only admin access works without Google OAuth
    try {
      await fetch('/api/consultations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: docId,
          regCode,
          name: clean.name,
          phone: clean.phone,
          birthDate: clean.birthDate,
          gender: clean.gender,
          region: clean.region,
          period: clean.period,
          monthlyAmount: clean.monthlyAmount,
          tenYearValue: clean.tenYearValue,
        }),
      });
    } catch {
      // Keep primary Firestore write succeeded
    }

    return { docId, regCode, maskedName };
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `consultations/${docId}`);
  }
}

export function subscribePublicFeed(
  onData: (items: PublicFeedRecord[]) => void,
  onError?: (err: Error) => void
): () => void {
  const path = 'public_feed';
  const q = query(collection(db, path), orderBy('createdAt', 'desc'), limit(20));

  return onSnapshot(
    q,
    (snapshot) => {
      const items: PublicFeedRecord[] = snapshot.docs.map((docSnap) => {
        const d = docSnap.data();
        const ts = d.createdAt instanceof Timestamp ? d.createdAt.toDate() : null;
        return {
          id: docSnap.id,
          maskedName: String(d.maskedName ?? ''),
          regionLabel: String(d.regionLabel ?? ''),
          period: (Number(d.period) || 5) as 5 | 7 | 10,
          monthlyAmount: (Number(d.monthlyAmount) || 50) as 10 | 30 | 50 | 100 | 150 | 200,
          tenYearValue: Number(d.tenYearValue) || 0,
          createdAt: ts,
        };
      });
      onData(items);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, path);
      } catch (wrapped) {
        if (onError && wrapped instanceof Error) {
          onError(wrapped);
        }
      }
    }
  );
}

export function isVerifiedAdminUser(user: User | null): boolean {
  return Boolean(user && user.emailVerified && user.email === ADMIN_EMAIL);
}

export function subscribeAuthUser(callback: (user: User | null) => void): () => void {
  return onAuthStateChanged(auth, callback);
}

export async function signInAdminWithGoogle(): Promise<User> {
  const result = await signInWithPopup(auth, googleProvider);
  return result.user;
}

export async function signOutAdmin(): Promise<void> {
  await signOut(auth);
}

export function subscribeConsultations(
  onData: (records: ConsultationRecord[]) => void,
  onError?: (err: Error) => void
): () => void {
  if (!isVerifiedAdminUser(auth.currentUser)) {
    return () => {};
  }

  const path = 'consultations';
  const q = query(collection(db, path), orderBy('createdAt', 'desc'), limit(200));

  return onSnapshot(
    q,
    (snapshot) => {
      const records: ConsultationRecord[] = snapshot.docs.map((docSnap) => {
        const d = docSnap.data();
        const createdTs = d.createdAt instanceof Timestamp ? d.createdAt.toDate() : null;
        const updatedTs = d.updatedAt instanceof Timestamp ? d.updatedAt.toDate() : null;
        return {
          id: docSnap.id,
          regCode: String(d.regCode ?? ''),
          name: String(d.name ?? ''),
          phone: String(d.phone ?? ''),
          birthDate: String(d.birthDate ?? ''),
          gender: d.gender === 'female' ? 'female' : 'male',
          region: String(d.region ?? ''),
          period: (Number(d.period) || 5) as 5 | 7 | 10,
          monthlyAmount: (Number(d.monthlyAmount) || 50) as 10 | 30 | 50 | 100 | 150 | 200,
          tenYearValue: Number(d.tenYearValue) || 0,
          status: (ALLOWED_STATUSES.includes(d.status) ? d.status : '접수대기') as ConsultationStatus,
          memo: typeof d.memo === 'string' ? d.memo : '',
          createdAt: createdTs,
          updatedAt: updatedTs,
        };
      });
      onData(records);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, path);
      } catch (wrapped) {
        if (onError && wrapped instanceof Error) {
          onError(wrapped);
        }
      }
    }
  );
}

export async function updateConsultationRecord(
  docId: string,
  status: ConsultationStatus,
  memo: string
): Promise<void> {
  if (!ALLOWED_STATUSES.includes(status)) {
    throw new Error('유효하지 않은 상담 상태입니다.');
  }
  const safeMemo = memo.trim().slice(0, 300);
  const path = `consultations/${docId}`;

  try {
    await updateDoc(doc(db, 'consultations', docId), {
      status,
      memo: safeMemo,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteConsultationRecord(docId: string): Promise<void> {
  const path = `consultations/${docId}`;
  try {
    await deleteDoc(doc(db, 'consultations', docId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

function escapeCsvCell(value: string | number): string {
  const str = String(value ?? '');
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function formatKoreanDateTime(date: Date | null): string {
  if (!date) return '방금 전';
  return new Intl.DateTimeFormat('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);
}

export function formatRelativeTime(date: Date | null): string {
  if (!date) return '방금 접수';
  const diffSec = Math.max(0, Math.floor((Date.now() - date.getTime()) / 1000));
  if (diffSec < 60) return '방금 접수 완료';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}분 전`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour}시간 전`;
  const diffDay = Math.floor(diffHour / 24);
  return `${diffDay}일 전`;
}

export function exportConsultationsToCsv(records: ConsultationRecord[]) {
  const headers = [
    '접수번호',
    '접수일시',
    '진행상태',
    '성함',
    '연락처',
    '성별',
    '생년월일',
    '거주지역',
    '희망납입기간(년)',
    '월납입금액(만원)',
    '10년예상환급금(만원)',
    '관리자메모',
  ];

  const lines = [
    headers.map(escapeCsvCell).join(','),
    ...records.map((r) =>
      [
        r.regCode,
        formatKoreanDateTime(r.createdAt),
        r.status,
        r.name,
        r.phone,
        r.gender === 'male' ? '남성' : '여성',
        r.birthDate,
        r.region,
        r.period,
        r.monthlyAmount,
        r.tenYearValue,
        r.memo ?? '',
      ]
        .map(escapeCsvCell)
        .join(',')
    ),
  ];

  const bom = '\uFEFF';
  const blob = new Blob([bom + lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const today = new Date().toISOString().slice(0, 10);
  link.href = url;
  link.download = `단기납_자산케어_상담신청내역_${today}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
