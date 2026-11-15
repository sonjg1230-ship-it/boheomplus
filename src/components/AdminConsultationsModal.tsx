import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  Clock,
  Download,
  Eye,
  EyeOff,
  Lock,
  LogIn,
  LogOut,
  RefreshCw,
  Search,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  X,
} from 'lucide-react';
import {
  ConsultationRecord,
  ConsultationStatus,
  auth,
  deleteConsultationRecord,
  exportConsultationsToCsv,
  fetchVaultConsultations,
  formatKoreanDateTime,
  isVerifiedAdminUser,
  signInAdminWithGoogle,
  subscribeConsultations,
  updateConsultationRecord,
  writeVaultConsultationEvent,
} from '../lib/firebase';
import {
  AdminLockStatus,
  deleteServerConsultationOptional,
  fetchServerConsultationsOptional,
  getAdminLockStatus,
  loginAdminWithPassword,
  logoutAdminPasswordSession,
  restoreVaultSession,
  syncCloudRecordsToServerOptional,
  updateServerConsultationOptional,
} from '../lib/adminAuth';
import { ImportedVaultKeys } from '../lib/vaultCrypto';
import { formatKoreanMoney } from '../data/wealthData';

interface AdminConsultationsModalProps {
  open: boolean;
  onClose: () => void;
}

const STATUS_OPTIONS: ConsultationStatus[] = ['접수대기', '상담배정', '상담완료', '보류'];

function statusBadgeClass(status: ConsultationStatus): string {
  switch (status) {
    case '접수대기':
      return 'bg-[#FEF3C7] text-[#925800] border-[#F4B441]/40';
    case '상담배정':
      return 'bg-[#EBF2FA] text-[#13294B] border-[#BDD4F2]';
    case '상담완료':
      return 'bg-[#DCFCE7] text-[#166534] border-[#86EFAC]';
    case '보류':
      return 'bg-[#F1F5F9] text-[#475569] border-[#CBD5E1]';
    default:
      return 'bg-[#F1F5F9] text-[#475569] border-[#CBD5E1]';
  }
}

function formatCountdown(totalSeconds: number): string {
  const safe = Math.max(0, totalSeconds);
  const mins = Math.floor(safe / 60);
  const secs = safe % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export function AdminConsultationsModal({ open, onClose }: AdminConsultationsModalProps) {
  const [authReady, setAuthReady] = useState(false);
  const [vaultKeys, setVaultKeys] = useState<ImportedVaultKeys | null>(null);
  const [authBusy, setAuthBusy] = useState(false);
  const [syncingCloud, setSyncingCloud] = useState(false);

  // Password login form state
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [lockStatus, setLockStatus] = useState<AdminLockStatus>({
    locked: false,
    failedAttempts: 0,
    maxAttempts: 5,
    remainingAttempts: 5,
    lockedUntil: null,
    remainingSeconds: 0,
  });
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [infoMsg, setInfoMsg] = useState<string | null>(null);

  const [records, setRecords] = useState<ConsultationRecord[]>([]);
  const [extraLegacyRecords, setExtraLegacyRecords] = useState<ConsultationRecord[]>([]);
  const [loadingRecords, setLoadingRecords] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'전체' | ConsultationStatus>('전체');

  // Row edit drafts
  const [draftStatus, setDraftStatus] = useState<Record<string, ConsultationStatus>>({});
  const [draftMemo, setDraftMemo] = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [savedToastId, setSavedToastId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const isAuthenticated = Boolean(vaultKeys);

  const syncDraftsFromItems = useCallback((items: ConsultationRecord[]) => {
    setDraftStatus((prev) => {
      const next = { ...prev };
      for (const item of items) {
        if (!next[item.id]) next[item.id] = item.status;
      }
      return next;
    });
    setDraftMemo((prev) => {
      const next = { ...prev };
      for (const item of items) {
        if (next[item.id] === undefined) next[item.id] = item.memo ?? '';
      }
      return next;
    });
  }, []);

  const loadRecords = useCallback(
    async (keysToUse?: ImportedVaultKeys | null) => {
      const activeKeys = keysToUse ?? vaultKeys;
      if (!activeKeys) return;

      setLoadingRecords(true);
      try {
        const [vaultItems, serverItems] = await Promise.all([
          fetchVaultConsultations(activeKeys),
          fetchServerConsultationsOptional(),
        ]);

        const mergedMap = new Map<string, ConsultationRecord>();
        for (const item of serverItems) {
          mergedMap.set(item.id, item);
        }
        for (const item of extraLegacyRecords) {
          if (!mergedMap.has(item.id)) mergedMap.set(item.id, item);
        }
        for (const item of vaultItems) {
          mergedMap.set(item.id, item);
        }

        const merged = Array.from(mergedMap.values()).sort(
          (a, b) => (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0)
        );
        setRecords(merged);
        syncDraftsFromItems(merged);
      } catch (err) {
        const msg = err instanceof Error ? err.message : '상담 내역을 불러오지 못했습니다.';
        setErrorMsg(
          msg.startsWith('{')
            ? '클라우드 DB 조회 권한을 확인하지 못했습니다. 잠시 후 다시 시도해 주세요.'
            : msg
        );
      } finally {
        setLoadingRecords(false);
      }
    },
    [vaultKeys, extraLegacyRecords, syncDraftsFromItems]
  );

  // Initialize session & lockout status whenever modal opens
  useEffect(() => {
    if (!open) return;
    let cancelled = false;

    const init = async () => {
      setAuthReady(false);
      setErrorMsg(null);
      setInfoMsg(null);

      try {
        const [status, restored] = await Promise.all([
          getAdminLockStatus().catch(
            (): AdminLockStatus => ({
              locked: false,
              failedAttempts: 0,
              maxAttempts: 5,
              remainingAttempts: 5,
              lockedUntil: null,
              remainingSeconds: 0,
            })
          ),
          restoreVaultSession(),
        ]);
        if (cancelled) return;
        setLockStatus(status);
        setVaultKeys(restored);
      } finally {
        if (!cancelled) {
          setAuthReady(true);
        }
      }
    };

    void init();
    return () => {
      cancelled = true;
    };
  }, [open]);

  // Countdown timer when temporarily locked
  useEffect(() => {
    if (!open || !lockStatus.locked || lockStatus.remainingSeconds <= 0) return;

    const timer = window.setInterval(() => {
      setLockStatus((prev) => {
        if (!prev.locked) return prev;
        const nextSec = prev.remainingSeconds - 1;
        if (nextSec <= 0) {
          void getAdminLockStatus()
            .then((fresh) => setLockStatus(fresh))
            .catch(() => {});
          return {
            ...prev,
            locked: false,
            failedAttempts: 0,
            remainingAttempts: prev.maxAttempts,
            lockedUntil: null,
            remainingSeconds: 0,
          };
        }
        return { ...prev, remainingSeconds: nextSec };
      });
    }, 1000);

    return () => window.clearInterval(timer);
  }, [open, lockStatus.locked, lockStatus.remainingSeconds]);

  // Load records & auto-refresh when authenticated
  useEffect(() => {
    if (!open || !authReady || !vaultKeys) {
      if (!vaultKeys) setRecords([]);
      return;
    }

    void loadRecords(vaultKeys);
    const interval = window.setInterval(() => {
      void loadRecords(vaultKeys);
    }, 15000);

    return () => window.clearInterval(interval);
  }, [open, authReady, vaultKeys, loadRecords]);

  const counts = useMemo(() => {
    return {
      total: records.length,
      waiting: records.filter((r) => r.status === '접수대기').length,
      assigned: records.filter((r) => r.status === '상담배정').length,
      completed: records.filter((r) => r.status === '상담완료').length,
    };
  }, [records]);

  const filteredRecords = useMemo(() => {
    const keyword = searchTerm.trim().toLowerCase();
    return records.filter((r) => {
      if (statusFilter !== '전체' && r.status !== statusFilter) return false;
      if (!keyword) return true;
      return (
        r.name.toLowerCase().includes(keyword) ||
        r.phone.toLowerCase().includes(keyword) ||
        r.regCode.toLowerCase().includes(keyword) ||
        r.region.toLowerCase().includes(keyword) ||
        (r.memo ?? '').toLowerCase().includes(keyword)
      );
    });
  }, [records, searchTerm, statusFilter]);

  if (!open) return null;

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (authBusy || lockStatus.locked || !password) return;

    setAuthBusy(true);
    setErrorMsg(null);
    setInfoMsg(null);

    try {
      const result = await loginAdminWithPassword(password);
      setLockStatus({
        locked: result.locked,
        failedAttempts: result.failedAttempts,
        maxAttempts: result.maxAttempts,
        remainingAttempts: result.remainingAttempts,
        lockedUntil: result.lockedUntil,
        remainingSeconds: result.remainingSeconds,
      });

      if (result.ok && result.vaultKeys) {
        setPassword('');
        setShowPassword(false);
        setVaultKeys(result.vaultKeys);
      } else {
        setPassword('');
        setErrorMsg(result.message || '비밀번호가 올바르지 않습니다.');
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : '로그인 확인 중 오류가 발생했습니다.';
      setErrorMsg(msg);
    } finally {
      setAuthBusy(false);
    }
  };

  const handleLogout = async () => {
    setAuthBusy(true);
    setErrorMsg(null);
    setInfoMsg(null);
    try {
      await logoutAdminPasswordSession();
      setVaultKeys(null);
      setRecords([]);
    } finally {
      setAuthBusy(false);
    }
  };

  const handleSyncLegacyFromFirestore = async () => {
    setSyncingCloud(true);
    setErrorMsg(null);
    setInfoMsg(null);
    try {
      if (!isVerifiedAdminUser(auth.currentUser)) {
        await signInAdminWithGoogle();
      }
      if (!isVerifiedAdminUser(auth.currentUser)) {
        setErrorMsg('과거 내역 가져오기는 승인된 관리자 Google 계정 인증이 필요합니다.');
        setSyncingCloud(false);
        return;
      }

      const cloudItems = await new Promise<ConsultationRecord[]>((resolve, reject) => {
        let settled = false;
        const unsub = subscribeConsultations(
          (items) => {
            if (settled) return;
            settled = true;
            unsub();
            resolve(items);
          },
          (err) => {
            if (settled) return;
            settled = true;
            unsub();
            reject(err);
          }
        );
      });

      setExtraLegacyRecords(cloudItems);
      await syncCloudRecordsToServerOptional(cloudItems);
      setInfoMsg(`과거 클라우드 내역 ${cloudItems.length}건을 함께 불러왔습니다.`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : '클라우드 동기화 중 오류가 발생했습니다.';
      setErrorMsg(msg);
    } finally {
      setSyncingCloud(false);
    }
  };

  const handleSaveRow = async (record: ConsultationRecord) => {
    if (!vaultKeys) return;
    const nextStatus = draftStatus[record.id] ?? record.status;
    const nextMemo = draftMemo[record.id] ?? record.memo ?? '';
    setSavingId(record.id);
    setErrorMsg(null);
    try {
      await writeVaultConsultationEvent(vaultKeys, record.id, 'update', nextStatus, nextMemo);
      await updateServerConsultationOptional(record.id, nextStatus, nextMemo);
      if (isVerifiedAdminUser(auth.currentUser)) {
        await updateConsultationRecord(record.id, nextStatus, nextMemo).catch(() => {});
      }
      setRecords((prev) =>
        prev.map((item) =>
          item.id === record.id
            ? { ...item, status: nextStatus, memo: nextMemo, updatedAt: new Date() }
            : item
        )
      );
      setSavedToastId(record.id);
      setTimeout(() => {
        setSavedToastId((curr) => (curr === record.id ? null : curr));
      }, 2000);
    } catch (error) {
      const msg = error instanceof Error ? error.message : '저장 중 오류가 발생했습니다.';
      setErrorMsg(msg);
    } finally {
      setSavingId(null);
    }
  };

  const handleDeleteRow = async (docId: string) => {
    if (!vaultKeys) return;
    setSavingId(docId);
    setErrorMsg(null);
    try {
      await writeVaultConsultationEvent(vaultKeys, docId, 'delete');
      await deleteServerConsultationOptional(docId);
      if (isVerifiedAdminUser(auth.currentUser)) {
        await deleteConsultationRecord(docId).catch(() => {});
      }
      setRecords((prev) => prev.filter((item) => item.id !== docId));
      setConfirmDeleteId(null);
    } catch (error) {
      const msg = error instanceof Error ? error.message : '삭제 중 오류가 발생했습니다.';
      setErrorMsg(msg);
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div
      aria-modal="true"
      role="dialog"
      className="fixed inset-0 z-[110] flex items-center justify-center p-3 sm:p-6"
    >
      <div className="absolute inset-0 bg-[#07111F]/75 backdrop-blur-sm" onClick={onClose} />

      <div className="relative z-10 w-full max-w-6xl max-h-[90vh] bg-[#F7F9FC] rounded-3xl border border-[#FFD166]/35 shadow-2xl flex flex-col overflow-hidden">
        {/* Modal Header */}
        <div className="bg-[#0B192C] text-white px-4 sm:px-6 py-3.5 sm:py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/10 shrink-0">
          <div className="flex items-center justify-between gap-3 min-w-0">
            <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-[#13294B] border border-[#FFD166]/30 flex items-center justify-center text-[#FFD166] shrink-0">
                <ShieldCheck className="w-4 h-4 sm:w-5 sm:h-5" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h2 className="text-sm sm:text-lg font-extrabold tracking-tight truncate">
                    단기납 자산케어 · 상담 관리 DB
                  </h2>
                  <span className="hidden xs:inline-block px-2 py-0.5 rounded-full bg-[#FFD166]/20 border border-[#FFD166]/40 text-[#FFD166] text-[10px] font-bold whitespace-nowrap">
                    ADMIN
                  </span>
                </div>
                <p className="text-[11px] sm:text-xs text-[#BDD4F2] truncate">
                  대표님 전용 보안 비밀번호 인증 · 5회 오류 시 자동 잠금
                </p>
              </div>
            </div>

            <button
              type="button"
              aria-label="닫기"
              onClick={onClose}
              className="sm:hidden w-8 h-8 rounded-full bg-[#13294B] hover:bg-[#1D3B6B] text-white/80 hover:text-white flex items-center justify-center transition-colors cursor-pointer shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2 shrink-0">
            {isAuthenticated && (
              <>
                <button
                  type="button"
                  onClick={() => void loadRecords()}
                  disabled={loadingRecords}
                  className="inline-flex items-center gap-1 px-3 py-2 rounded-full bg-[#13294B] hover:bg-[#1D3B6B] text-white/90 text-xs font-bold border border-white/15 transition-colors cursor-pointer whitespace-nowrap disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loadingRecords ? 'animate-spin' : ''}`} />
                  <span className="hidden sm:inline">새로고침</span>
                </button>
                <button
                  type="button"
                  onClick={() => void handleSyncLegacyFromFirestore()}
                  disabled={syncingCloud}
                  title="이전 버전에서 저장된 과거 내역을 추가로 불러올 때 사용합니다"
                  className="inline-flex items-center gap-1 px-3 py-2 rounded-full bg-[#13294B] hover:bg-[#1D3B6B] text-[#BDD4F2] text-xs font-bold border border-white/15 transition-colors cursor-pointer whitespace-nowrap disabled:opacity-50"
                >
                  <span>{syncingCloud ? '불러오는 중...' : '과거 내역 동기화'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => exportConsultationsToCsv(filteredRecords)}
                  disabled={filteredRecords.length === 0}
                  className="inline-flex items-center gap-1.5 px-3 sm:px-3.5 py-2 rounded-full bg-[#F4B441] hover:bg-[#D99B26] disabled:opacity-40 text-[#0B192C] text-xs font-bold transition-colors cursor-pointer whitespace-nowrap"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>엑셀(CSV)</span>
                </button>
                <button
                  type="button"
                  onClick={() => void handleLogout()}
                  disabled={authBusy}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-full bg-[#13294B] hover:bg-[#1D3B6B] text-white/90 text-xs font-bold border border-white/15 transition-colors cursor-pointer whitespace-nowrap"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>잠금(로그아웃)</span>
                </button>
              </>
            )}
            <button
              type="button"
              aria-label="닫기"
              onClick={onClose}
              className="hidden sm:flex w-9 h-9 rounded-full bg-[#13294B] hover:bg-[#1D3B6B] text-white/80 hover:text-white items-center justify-center transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 sm:space-y-5">
          {errorMsg && (
            <div className="bg-[#FEE2E2] border border-[#DC2626]/30 text-[#991B1B] px-4 py-3 rounded-xl text-xs font-semibold flex items-center justify-between gap-3">
              <span>{errorMsg}</span>
              <button
                type="button"
                onClick={() => setErrorMsg(null)}
                className="text-[#991B1B] hover:underline shrink-0 cursor-pointer"
              >
                닫기
              </button>
            </div>
          )}

          {infoMsg && (
            <div className="bg-[#DCFCE7] border border-[#86EFAC] text-[#166534] px-4 py-3 rounded-xl text-xs font-semibold flex items-center justify-between gap-3">
              <span>{infoMsg}</span>
              <button
                type="button"
                onClick={() => setInfoMsg(null)}
                className="text-[#166534] hover:underline shrink-0 cursor-pointer"
              >
                닫기
              </button>
            </div>
          )}

          {!authReady ? (
            <div className="py-16 text-center text-sm text-[#475569]">보안 인증 상태를 확인 중입니다...</div>
          ) : !isAuthenticated ? (
            <div className="max-w-md mx-auto my-6 sm:my-10 bg-white rounded-2xl p-6 sm:p-8 border border-[#CBD5E1]/60 shadow-lg space-y-5">
              <div className="text-center space-y-3">
                <div
                  className={`w-14 h-14 rounded-2xl flex items-center justify-center mx-auto shadow-md ${
                    lockStatus.locked
                      ? 'bg-[#FEE2E2] text-[#DC2626]'
                      : 'bg-[#0B192C] text-[#FFD166]'
                  }`}
                >
                  {lockStatus.locked ? (
                    <ShieldAlert className="w-7 h-7" />
                  ) : (
                    <Lock className="w-7 h-7" />
                  )}
                </div>
                <div className="space-y-1">
                  <h3 className="text-lg font-extrabold text-[#0F172A]">
                    {lockStatus.locked ? '보안 일시 잠금 상태입니다' : '관리자 비밀번호 인증'}
                  </h3>
                  <p className="text-xs text-[#475569] leading-relaxed">
                    {lockStatus.locked
                      ? '비밀번호 5회 이상 연속 오류로 인해 개인정보 보호를 위해 접속이 일시 차단되었습니다.'
                      : 'Google 계정 로그인 없이 설정하신 관리자 전용 비밀번호만으로 상담 신청 내역을 열람할 수 있습니다.'}
                  </p>
                </div>
              </div>

              {lockStatus.locked ? (
                <div className="bg-[#FEF2F2] border border-[#FECACA] rounded-2xl p-4 text-center space-y-2">
                  <div className="inline-flex items-center gap-1.5 text-xs font-bold text-[#991B1B]">
                    <Clock className="w-4 h-4" />
                    <span>잠금 해제까지 남은 시간</span>
                  </div>
                  <div className="text-3xl font-extrabold font-mono text-[#DC2626] tabular-nums">
                    {formatCountdown(lockStatus.remainingSeconds)}
                  </div>
                  <p className="text-[11px] text-[#7F1D1D]">
                    남은 시간이 지나면 자동으로 잠금이 해제되어 다시 입력할 수 있습니다.
                  </p>
                </div>
              ) : (
                <form onSubmit={handlePasswordSubmit} className="space-y-4">
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label htmlFor="admin-pw-input" className="text-xs font-bold text-[#0F172A]">
                        관리자 비밀번호
                      </label>
                      {lockStatus.failedAttempts > 0 && (
                        <span className="text-[11px] font-bold text-[#DC2626] tabular-nums">
                          오류 {lockStatus.failedAttempts}/{lockStatus.maxAttempts}회 (남은 시도{' '}
                          {lockStatus.remainingAttempts}회)
                        </span>
                      )}
                    </div>
                    <div className="relative">
                      <input
                        id="admin-pw-input"
                        type={showPassword ? 'text' : 'password'}
                        required
                        autoFocus
                        autoComplete="current-password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="관리자 비밀번호를 입력하세요"
                        className="w-full pl-4 pr-11 py-3.5 rounded-xl border border-[#CBD5E1] focus:border-[#0B192C] focus:outline-none text-sm bg-[#F7F9FC] focus:bg-white font-mono"
                      />
                      <button
                        type="button"
                        aria-label={showPassword ? '비밀번호 숨기기' : '비밀번호 보기'}
                        onClick={() => setShowPassword((v) => !v)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-[#64748B] hover:text-[#0B192C] p-1 cursor-pointer"
                      >
                        {showPassword ? (
                          <EyeOff className="w-4 h-4" />
                        ) : (
                          <Eye className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={authBusy || !password}
                    className="w-full py-3.5 px-5 rounded-full bg-[#0B192C] hover:bg-[#13294B] text-white text-sm font-bold flex items-center justify-center gap-2 shadow-md transition-colors cursor-pointer disabled:opacity-50"
                  >
                    <LogIn className="w-4 h-4 text-[#FFD166]" />
                    <span>{authBusy ? '비밀번호 확인 중...' : '관리자 로그인'}</span>
                  </button>

                  <p className="text-center text-[11px] text-[#64748B]">
                    보안을 위해 5회 연속 비밀번호 오류 시 5분간 일시 잠금이 적용됩니다.
                  </p>
                </form>
              )}
            </div>
          ) : (
            <>
              {/* KPI Strip */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-white rounded-2xl p-4 border border-[#CBD5E1]/50 shadow-xs">
                  <span className="text-[11px] font-bold text-[#475569] block">전체 상담 신청</span>
                  <span className="text-2xl font-extrabold text-[#0B192C] tabular-nums mt-1 block">
                    {counts.total}건
                  </span>
                </div>
                <div className="bg-white rounded-2xl p-4 border border-[#F4B441]/40 shadow-xs">
                  <span className="text-[11px] font-bold text-[#925800] block">접수대기</span>
                  <span className="text-2xl font-extrabold text-[#925800] tabular-nums mt-1 block">
                    {counts.waiting}건
                  </span>
                </div>
                <div className="bg-white rounded-2xl p-4 border border-[#BDD4F2] shadow-xs">
                  <span className="text-[11px] font-bold text-[#13294B] block">상담배정</span>
                  <span className="text-2xl font-extrabold text-[#13294B] tabular-nums mt-1 block">
                    {counts.assigned}건
                  </span>
                </div>
                <div className="bg-white rounded-2xl p-4 border border-[#86EFAC] shadow-xs">
                  <span className="text-[11px] font-bold text-[#166534] block">상담완료</span>
                  <span className="text-2xl font-extrabold text-[#166534] tabular-nums mt-1 block">
                    {counts.completed}건
                  </span>
                </div>
              </div>

              {/* Filter & Search Bar */}
              <div className="bg-white rounded-2xl p-3.5 border border-[#CBD5E1]/50 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-1.5">
                  {(['전체', ...STATUS_OPTIONS] as const).map((st) => (
                    <button
                      key={st}
                      type="button"
                      onClick={() => setStatusFilter(st)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer whitespace-nowrap ${
                        statusFilter === st
                          ? 'bg-[#0B192C] text-white'
                          : 'bg-[#EEF3FA] text-[#475569] hover:text-[#0B192C]'
                      }`}
                    >
                      {st}
                    </button>
                  ))}
                </div>

                <div className="relative w-full md:w-auto md:min-w-[240px]">
                  <Search className="w-4 h-4 text-[#64748B] absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="성함, 연락처, 접수번호, 지역 검색"
                    className="w-full pl-9 pr-3 py-2 rounded-xl border border-[#CBD5E1] text-xs bg-[#F7F9FC] focus:bg-white focus:border-[#0B192C] focus:outline-none"
                  />
                </div>
              </div>

              {/* Records List (Mobile Cards + Desktop Table) */}
              <div className="bg-white rounded-2xl border border-[#CBD5E1]/60 shadow-sm overflow-hidden">
                {filteredRecords.length === 0 ? (
                  <div className="py-14 text-center space-y-1 px-4">
                    <p className="text-sm font-bold text-[#0F172A]">조건에 맞는 상담 신청 내역이 없습니다.</p>
                    <p className="text-xs text-[#64748B]">
                      상담 신청 폼을 통해 접수된 신규 내역이 실시간으로 이곳에 기록됩니다.
                    </p>
                  </div>
                ) : (
                  <>
                    {/* Mobile Card View */}
                    <div className="md:hidden divide-y divide-[#CBD5E1]/50">
                      {filteredRecords.map((rec) => {
                        const currentStatus = draftStatus[rec.id] ?? rec.status;
                        const currentMemo = draftMemo[rec.id] ?? rec.memo ?? '';
                        const isSaving = savingId === rec.id;
                        const isSaved = savedToastId === rec.id;
                        const isConfirmingDelete = confirmDeleteId === rec.id;

                        return (
                          <div key={rec.id} className="p-4 space-y-3 text-xs">
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <div className="font-bold text-[#0F172A] text-sm">
                                  {rec.name}{' '}
                                  <span className="text-[11px] font-normal text-[#475569]">
                                    ({rec.gender === 'male' ? '남' : '여'} · {rec.birthDate})
                                  </span>
                                </div>
                                <div className="text-[11px] text-[#475569] mt-0.5">
                                  {rec.region} · {formatKoreanDateTime(rec.createdAt)}
                                </div>
                                <div className="text-[10px] font-mono text-[#64748B] mt-0.5">
                                  {rec.regCode}
                                </div>
                              </div>

                              <select
                                aria-label={`${rec.name} 진행상태`}
                                value={currentStatus}
                                onChange={(e) =>
                                  setDraftStatus((prev) => ({
                                    ...prev,
                                    [rec.id]: e.target.value as ConsultationStatus,
                                  }))
                                }
                                className={`px-2.5 py-1 rounded-lg border text-[11px] font-bold focus:outline-none cursor-pointer shrink-0 ${statusBadgeClass(
                                  currentStatus
                                )}`}
                              >
                                {STATUS_OPTIONS.map((opt) => (
                                  <option key={opt} value={opt}>
                                    {opt}
                                  </option>
                                ))}
                              </select>
                            </div>

                            <div className="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-[#F7F9FC] border border-[#CBD5E1]/50 tabular-nums">
                              <a
                                href={`tel:${rec.phone.replace(/[^0-9]/g, '')}`}
                                className="font-mono font-bold text-[#0B192C] hover:underline"
                              >
                                {rec.phone}
                              </a>
                              <div className="text-right">
                                <span className="font-bold text-[#0F172A]">
                                  {rec.period}년납 · 월 {rec.monthlyAmount}만원
                                </span>
                                <span className="block text-[11px] font-semibold text-[#925800]">
                                  10년 {formatKoreanMoney(rec.tenYearValue)}
                                </span>
                              </div>
                            </div>

                            <div className="flex items-center gap-1.5">
                              <input
                                type="text"
                                maxLength={300}
                                value={currentMemo}
                                onChange={(e) =>
                                  setDraftMemo((prev) => ({
                                    ...prev,
                                    [rec.id]: e.target.value,
                                  }))
                                }
                                placeholder="상담 메모 입력 (최대 300자)"
                                className="flex-1 min-w-0 px-2.5 py-2 rounded-lg border border-[#CBD5E1] text-xs bg-white focus:border-[#0B192C] focus:outline-none"
                              />
                              <button
                                type="button"
                                disabled={isSaving}
                                onClick={() => void handleSaveRow(rec)}
                                className="px-3 py-2 rounded-lg bg-[#0B192C] hover:bg-[#13294B] text-white font-bold whitespace-nowrap cursor-pointer disabled:opacity-50"
                              >
                                {isSaving ? '저장 중' : '저장'}
                              </button>
                              {!isConfirmingDelete ? (
                                <button
                                  type="button"
                                  aria-label="삭제"
                                  onClick={() => setConfirmDeleteId(rec.id)}
                                  className="p-2 rounded-lg border border-[#CBD5E1] text-[#64748B] hover:text-[#DC2626] cursor-pointer"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              ) : (
                                <div className="flex items-center gap-1">
                                  <button
                                    type="button"
                                    disabled={isSaving}
                                    onClick={() => void handleDeleteRow(rec.id)}
                                    className="px-2 py-2 rounded-lg bg-[#DC2626] text-white font-bold whitespace-nowrap cursor-pointer"
                                  >
                                    확인
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setConfirmDeleteId(null)}
                                    className="px-2 py-2 rounded-lg bg-[#E2E8F0] text-[#475569] font-bold whitespace-nowrap cursor-pointer"
                                  >
                                    취소
                                  </button>
                                </div>
                              )}
                            </div>

                            {isSaved && (
                              <span className="inline-flex items-center gap-1 text-[11px] text-[#166534] font-semibold">
                                <CheckCircle2 className="w-3 h-3" />
                                <span>저장되었습니다</span>
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {/* Desktop Table View */}
                    <div className="hidden md:block overflow-x-auto">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="bg-[#0B192C] text-white font-bold">
                            <th className="py-3 px-4 whitespace-nowrap">접수일시 / 번호</th>
                            <th className="py-3 px-4 whitespace-nowrap">고객 정보</th>
                            <th className="py-3 px-4 whitespace-nowrap">연락처</th>
                            <th className="py-3 px-4 whitespace-nowrap">신청 플랜 / 10년 환급</th>
                            <th className="py-3 px-4 whitespace-nowrap">진행 상태</th>
                            <th className="py-3 px-4 whitespace-nowrap">상담 메모 &amp; 관리</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#CBD5E1]/40">
                          {filteredRecords.map((rec) => {
                            const currentStatus = draftStatus[rec.id] ?? rec.status;
                            const currentMemo = draftMemo[rec.id] ?? rec.memo ?? '';
                            const isSaving = savingId === rec.id;
                            const isSaved = savedToastId === rec.id;
                            const isConfirmingDelete = confirmDeleteId === rec.id;

                            return (
                              <tr key={rec.id} className="hover:bg-[#F7F9FC] align-top">
                                <td className="py-3.5 px-4 whitespace-nowrap">
                                  <div className="font-semibold text-[#0F172A] tabular-nums">
                                    {formatKoreanDateTime(rec.createdAt)}
                                  </div>
                                  <div className="text-[11px] font-mono text-[#64748B] mt-0.5">
                                    {rec.regCode}
                                  </div>
                                </td>

                                <td className="py-3.5 px-4 whitespace-nowrap">
                                  <div className="font-bold text-[#0F172A] text-sm">
                                    {rec.name}{' '}
                                    <span className="text-[11px] font-normal text-[#475569]">
                                      ({rec.gender === 'male' ? '남' : '여'} · {rec.birthDate})
                                    </span>
                                  </div>
                                  <div className="text-[11px] text-[#475569] mt-0.5">{rec.region}</div>
                                </td>

                                <td className="py-3.5 px-4 whitespace-nowrap">
                                  <a
                                    href={`tel:${rec.phone.replace(/[^0-9]/g, '')}`}
                                    className="font-mono font-bold text-[#0B192C] hover:underline"
                                  >
                                    {rec.phone}
                                  </a>
                                </td>

                                <td className="py-3.5 px-4 whitespace-nowrap tabular-nums">
                                  <div className="font-bold text-[#0F172A]">
                                    {rec.period}년납 · 월 {rec.monthlyAmount}만원
                                  </div>
                                  <div className="text-[11px] font-semibold text-[#925800] mt-0.5">
                                    10년 예상 {formatKoreanMoney(rec.tenYearValue)}
                                  </div>
                                </td>

                                <td className="py-3.5 px-4 whitespace-nowrap">
                                  <select
                                    aria-label={`${rec.name} 진행상태`}
                                    value={currentStatus}
                                    onChange={(e) =>
                                      setDraftStatus((prev) => ({
                                        ...prev,
                                        [rec.id]: e.target.value as ConsultationStatus,
                                      }))
                                    }
                                    className={`px-2.5 py-1.5 rounded-lg border text-xs font-bold focus:outline-none cursor-pointer ${statusBadgeClass(
                                      currentStatus
                                    )}`}
                                  >
                                    {STATUS_OPTIONS.map((opt) => (
                                      <option key={opt} value={opt}>
                                        {opt}
                                      </option>
                                    ))}
                                  </select>
                                </td>

                                <td className="py-3.5 px-4 min-w-[260px]">
                                  <div className="flex items-center gap-1.5">
                                    <input
                                      type="text"
                                      maxLength={300}
                                      value={currentMemo}
                                      onChange={(e) =>
                                        setDraftMemo((prev) => ({
                                          ...prev,
                                          [rec.id]: e.target.value,
                                        }))
                                      }
                                      placeholder="상담 메모 입력 (최대 300자)"
                                      className="flex-1 px-2.5 py-1.5 rounded-lg border border-[#CBD5E1] text-xs bg-white focus:border-[#0B192C] focus:outline-none"
                                    />
                                    <button
                                      type="button"
                                      disabled={isSaving}
                                      onClick={() => void handleSaveRow(rec)}
                                      className="px-3 py-1.5 rounded-lg bg-[#0B192C] hover:bg-[#13294B] text-white font-bold whitespace-nowrap cursor-pointer disabled:opacity-50"
                                    >
                                      {isSaving ? '저장 중' : '저장'}
                                    </button>

                                    {!isConfirmingDelete ? (
                                      <button
                                        type="button"
                                        aria-label="삭제"
                                        onClick={() => setConfirmDeleteId(rec.id)}
                                        className="p-1.5 rounded-lg border border-[#CBD5E1] text-[#64748B] hover:text-[#DC2626] hover:border-[#DC2626]/40 cursor-pointer"
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </button>
                                    ) : (
                                      <div className="flex items-center gap-1">
                                        <button
                                          type="button"
                                          disabled={isSaving}
                                          onClick={() => void handleDeleteRow(rec.id)}
                                          className="px-2 py-1.5 rounded-lg bg-[#DC2626] text-white font-bold whitespace-nowrap cursor-pointer"
                                        >
                                          삭제확인
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => setConfirmDeleteId(null)}
                                          className="px-2 py-1.5 rounded-lg bg-[#E2E8F0] text-[#475569] font-bold whitespace-nowrap cursor-pointer"
                                        >
                                          취소
                                        </button>
                                      </div>
                                    )}
                                  </div>
                                  {isSaved && (
                                    <span className="inline-flex items-center gap-1 text-[11px] text-[#166534] font-semibold mt-1">
                                      <CheckCircle2 className="w-3 h-3" />
                                      <span>저장되었습니다</span>
                                    </span>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
