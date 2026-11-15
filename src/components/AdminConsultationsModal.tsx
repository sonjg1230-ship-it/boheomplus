import React, { useEffect, useMemo, useState } from 'react';
import { User } from 'firebase/auth';
import {
  CheckCircle2,
  Download,
  Lock,
  LogIn,
  LogOut,
  Search,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  X,
} from 'lucide-react';
import {
  ADMIN_EMAIL,
  ConsultationRecord,
  ConsultationStatus,
  deleteConsultationRecord,
  exportConsultationsToCsv,
  formatKoreanDateTime,
  isVerifiedAdminUser,
  signInAdminWithGoogle,
  signOutAdmin,
  subscribeAuthUser,
  subscribeConsultations,
  updateConsultationRecord,
} from '../lib/firebase';
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

export function AdminConsultationsModal({ open, onClose }: AdminConsultationsModalProps) {
  const [authUser, setAuthUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [authBusy, setAuthBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [records, setRecords] = useState<ConsultationRecord[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'전체' | ConsultationStatus>('전체');

  // Row edit drafts
  const [draftStatus, setDraftStatus] = useState<Record<string, ConsultationStatus>>({});
  const [draftMemo, setDraftMemo] = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [savedToastId, setSavedToastId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  useEffect(() => {
    const unsub = subscribeAuthUser((user) => {
      setAuthUser(user);
      setAuthReady(true);
    });
    return unsub;
  }, []);

  const isAdmin = isVerifiedAdminUser(authUser);

  useEffect(() => {
    if (!open || !authReady || !isAdmin) {
      setRecords([]);
      return;
    }

    setErrorMsg(null);
    const unsub = subscribeConsultations(
      (items) => {
        setRecords(items);
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
      },
      (err) => {
        setErrorMsg(`상담 데이터를 불러오는 중 오류가 발생했습니다: ${err.message}`);
      }
    );

    return unsub;
  }, [open, authReady, isAdmin]);

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

  const handleGoogleLogin = async () => {
    setAuthBusy(true);
    setErrorMsg(null);
    try {
      await signInAdminWithGoogle();
    } catch (error) {
      const msg = error instanceof Error ? error.message : '로그인 중 오류가 발생했습니다.';
      setErrorMsg(msg);
    } finally {
      setAuthBusy(false);
    }
  };

  const handleLogout = async () => {
    setAuthBusy(true);
    setErrorMsg(null);
    try {
      await signOutAdmin();
    } catch (error) {
      const msg = error instanceof Error ? error.message : '로그아웃 중 오류가 발생했습니다.';
      setErrorMsg(msg);
    } finally {
      setAuthBusy(false);
    }
  };

  const handleSaveRow = async (record: ConsultationRecord) => {
    const nextStatus = draftStatus[record.id] ?? record.status;
    const nextMemo = draftMemo[record.id] ?? record.memo ?? '';
    setSavingId(record.id);
    setErrorMsg(null);
    try {
      await updateConsultationRecord(record.id, nextStatus, nextMemo);
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
    setSavingId(docId);
    setErrorMsg(null);
    try {
      await deleteConsultationRecord(docId);
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
                  Firebase Firestore 보안 저장소 실시간 연동
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

          <div className="flex items-center justify-end gap-2 shrink-0">
            {isAdmin && (
              <>
                <button
                  type="button"
                  onClick={() => exportConsultationsToCsv(filteredRecords)}
                  disabled={filteredRecords.length === 0}
                  className="inline-flex items-center gap-1.5 px-3 sm:px-3.5 py-2 rounded-full bg-[#F4B441] hover:bg-[#D99B26] disabled:opacity-40 text-[#0B192C] text-xs font-bold transition-colors cursor-pointer whitespace-nowrap"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>엑셀(CSV) 다운로드</span>
                </button>
                <button
                  type="button"
                  onClick={handleLogout}
                  disabled={authBusy}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-full bg-[#13294B] hover:bg-[#1D3B6B] text-white/90 text-xs font-bold border border-white/15 transition-colors cursor-pointer whitespace-nowrap"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>로그아웃</span>
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

          {!authReady ? (
            <div className="py-16 text-center text-sm text-[#475569]">인증 상태를 확인 중입니다...</div>
          ) : !authUser ? (
            <div className="max-w-md mx-auto my-8 bg-white rounded-2xl p-7 border border-[#CBD5E1]/60 shadow-lg text-center space-y-5">
              <div className="w-14 h-14 rounded-2xl bg-[#0B192C] text-[#FFD166] flex items-center justify-center mx-auto shadow-md">
                <Lock className="w-7 h-7" />
              </div>
              <div className="space-y-1.5">
                <h3 className="text-lg font-extrabold text-[#0F172A]">관리자 본인 인증이 필요합니다</h3>
                <p className="text-xs text-[#475569] leading-relaxed">
                  고객 연락처 및 생년월일 등 개인정보는 보안 규칙에 의해 승인된 관리자 계정(
                  <span className="font-mono font-bold text-[#0B192C]">{ADMIN_EMAIL}</span>)만 열람할 수 있습니다.
                </p>
              </div>
              <button
                type="button"
                onClick={handleGoogleLogin}
                disabled={authBusy}
                className="w-full py-3.5 px-5 rounded-full bg-[#0B192C] hover:bg-[#13294B] text-white text-sm font-bold flex items-center justify-center gap-2 shadow-md transition-colors cursor-pointer disabled:opacity-60"
              >
                <LogIn className="w-4 h-4 text-[#FFD166]" />
                <span>{authBusy ? '로그인 확인 중...' : 'Google 관리자 계정으로 로그인'}</span>
              </button>
            </div>
          ) : !isAdmin ? (
            <div className="max-w-md mx-auto my-8 bg-white rounded-2xl p-7 border border-[#DC2626]/30 shadow-lg text-center space-y-4">
              <div className="w-14 h-14 rounded-2xl bg-[#FEE2E2] text-[#DC2626] flex items-center justify-center mx-auto">
                <ShieldAlert className="w-7 h-7" />
              </div>
              <div className="space-y-1.5">
                <h3 className="text-lg font-extrabold text-[#0F172A]">접근 권한이 없는 계정입니다</h3>
                <p className="text-xs text-[#475569] leading-relaxed">
                  현재 로그인된 계정(<span className="font-mono font-semibold">{authUser.email}</span>)은 관리자 권한이 없습니다.{' '}
                  <span className="font-mono font-bold text-[#0B192C]">{ADMIN_EMAIL}</span> 계정으로 다시 로그인해 주세요.
                </p>
              </div>
              <div className="flex items-center justify-center gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={handleLogout}
                  disabled={authBusy}
                  className="px-4 py-2.5 rounded-full border border-[#CBD5E1] bg-white hover:bg-[#EEF3FA] text-xs font-bold text-[#0F172A] cursor-pointer"
                >
                  로그아웃
                </button>
                <button
                  type="button"
                  onClick={handleGoogleLogin}
                  disabled={authBusy}
                  className="px-5 py-2.5 rounded-full bg-[#0B192C] hover:bg-[#13294B] text-white text-xs font-bold cursor-pointer"
                >
                  관리자 계정 전환
                </button>
              </div>
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
                                onClick={() => handleSaveRow(rec)}
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
                                    onClick={() => handleDeleteRow(rec.id)}
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
                                    onClick={() => handleSaveRow(rec)}
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
                                        onClick={() => handleDeleteRow(rec.id)}
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
