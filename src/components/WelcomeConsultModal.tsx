import React, { useMemo, useState } from 'react';
import { Lock, MessageCircle, Send, Sparkles, X } from 'lucide-react';
import {
  MATRIX_AMOUNTS,
  PlanPeriod,
  calculatePlanProjection,
  formatKoreanMoney,
} from '../data/wealthData';
import { submitConsultationLead } from '../lib/firebase';

export interface SubmittedModalInfo {
  name: string;
  phone: string;
  periodText: string;
  amountText: string;
  regCode: string;
}

interface WelcomeConsultModalProps {
  open: boolean;
  initialPeriod: number;
  initialAmount: number;
  onClose: () => void;
  onHideToday: () => void;
  onSuccess: (info: SubmittedModalInfo) => void;
}

export function WelcomeConsultModal({
  open,
  initialPeriod,
  initialAmount,
  onClose,
  onHideToday,
  onSuccess,
}: WelcomeConsultModalProps) {
  const [gender, setGender] = useState<'male' | 'female'>('male');
  const [clientName, setClientName] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [region, setRegion] = useState('서울특별시');
  const [period, setPeriod] = useState<number>(initialPeriod);
  const [monthlyAmount, setMonthlyAmount] = useState<number>(initialAmount);
  const [agreed, setAgreed] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const previewProj = useMemo(() => {
    const calcPeriod: PlanPeriod = period === 7 ? 7 : 5;
    return calculatePlanProjection(calcPeriod, monthlyAmount, 0.154);
  }, [period, monthlyAmount]);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = clientName.trim();
    const trimmedPhone = clientPhone.trim();
    if (!trimmedName || !trimmedPhone || !agreed || isSubmitting) return;

    setFormError(null);
    setIsSubmitting(true);

    try {
      const result = await submitConsultationLead({
        name: trimmedName,
        phone: trimmedPhone,
        birthDate,
        gender,
        region,
        period,
        monthlyAmount,
        tenYearValue: previewProj.tenYearValue,
      });

      onClose();
      onSuccess({
        name: trimmedName,
        phone: trimmedPhone,
        periodText: `${period}년 납입`,
        amountText: `월 ${monthlyAmount}만원`,
        regCode: result.regCode,
      });

      setClientName('');
      setClientPhone('');
      setBirthDate('');
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : '상담 신청 저장 중 일시적인 오류가 발생했습니다. 입력 내용을 확인 후 다시 시도해 주세요.';
      if (message.startsWith('{')) {
        setFormError('상담 신청 저장 중 권한 또는 네트워크 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.');
      } else {
        setFormError(message);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      aria-modal="true"
      role="dialog"
      aria-label="빠른 무료 상담 신청 카드"
      className="fixed inset-0 z-[95] flex items-center justify-center p-3 sm:p-5"
    >
      <div
        className="absolute inset-0 bg-[#07111F]/70 backdrop-blur-sm"
        onClick={onClose}
      />

      <div className="relative z-10 w-full max-w-lg max-h-[92vh] overflow-y-auto bg-white rounded-3xl shadow-2xl border border-[#FFD166]/40">
        {/* Card Top Navy Header */}
        <div className="bg-[#0B192C] text-white px-4 sm:px-6 pt-4 sm:pt-5 pb-4 sm:pb-5 relative border-b border-white/10">
          <button
            type="button"
            aria-label="닫기"
            onClick={onClose}
            className="absolute top-3.5 right-3.5 sm:top-4 sm:right-4 w-8 h-8 rounded-full bg-[#13294B] hover:bg-[#1D3B6B] text-white/80 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>

          <div className="flex items-center gap-2 sm:gap-2.5 mb-2.5 sm:mb-3 pr-10">
            <img
              src="/assets/aistudio/logo_bohumplus_navy.png"
              alt="보험플러스+"
              className="h-6 sm:h-7 w-auto object-contain"
            />
            <span className="inline-flex items-center gap-1 px-2 sm:px-2.5 py-0.5 rounded-full bg-[#FFD166]/20 border border-[#FFD166]/40 text-[#FFD166] text-[10px] font-bold whitespace-nowrap">
              <Sparkles className="w-3 h-3" />
              <span>1분 무료 비교</span>
            </span>
          </div>

          <h2 className="text-base sm:text-xl font-extrabold tracking-tight leading-snug">
            내 맞춤 <span className="text-[#FFD166]">10년 확정 환급금</span> 바로 확인하기
          </h2>

          <div className="mt-3 bg-[#13294B] border border-[#FFD166]/30 rounded-xl px-3 sm:px-4 py-2 sm:py-2.5 flex flex-wrap items-center justify-between gap-1.5 sm:gap-2 text-[11px] sm:text-xs">
            <span className="text-[#BDD4F2] font-semibold">
              {period}년납 · 월 {monthlyAmount}만원 선택 시
            </span>
            <span className="text-[#FFD166] font-extrabold text-xs sm:text-sm tabular-nums whitespace-nowrap">
              10년 {formatKoreanMoney(previewProj.tenYearValue)} 확정
            </span>
          </div>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-4">
          {/* Gender */}
          <div>
            <label className="block text-[11px] font-bold text-[#0F172A] mb-1.5">성별</label>
            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => setGender('male')}
                className={`py-2.5 rounded-xl text-xs font-bold border transition-colors cursor-pointer ${
                  gender === 'male'
                    ? 'border-2 border-[#0B192C] bg-[#0B192C] text-white'
                    : 'border-[#CBD5E1]/70 bg-white text-[#0F172A] hover:border-[#0B192C]'
                }`}
              >
                남성
              </button>
              <button
                type="button"
                onClick={() => setGender('female')}
                className={`py-2.5 rounded-xl text-xs font-bold border transition-colors cursor-pointer ${
                  gender === 'female'
                    ? 'border-2 border-[#0B192C] bg-[#0B192C] text-white'
                    : 'border-[#CBD5E1]/70 bg-white text-[#0F172A] hover:border-[#0B192C]'
                }`}
              >
                여성
              </button>
            </div>
          </div>

          {/* Name & Phone */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-[#0F172A] mb-1.5">성함</label>
              <input
                type="text"
                required
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                placeholder="홍길동"
                className="w-full px-3.5 py-2.5 rounded-xl border border-[#CBD5E1]/70 focus:border-[#0B192C] focus:outline-none text-sm bg-white"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-[#0F172A] mb-1.5">연락처</label>
              <input
                type="tel"
                required
                value={clientPhone}
                onChange={(e) => setClientPhone(e.target.value)}
                placeholder="010-1234-5678"
                className="w-full px-3.5 py-2.5 rounded-xl border border-[#CBD5E1]/70 focus:border-[#0B192C] focus:outline-none text-sm bg-white"
              />
            </div>
          </div>

          {/* BirthDate & Region */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-[#0F172A] mb-1.5">
                생년월일 (6자리)
              </label>
              <input
                type="text"
                maxLength={6}
                required
                value={birthDate}
                onChange={(e) => setBirthDate(e.target.value)}
                placeholder="예: 850315"
                className="w-full px-3.5 py-2.5 rounded-xl border border-[#CBD5E1]/70 focus:border-[#0B192C] focus:outline-none text-sm bg-white"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-[#0F172A] mb-1.5">거주 지역</label>
              <select
                value={region}
                onChange={(e) => setRegion(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-[#CBD5E1]/70 focus:border-[#0B192C] focus:outline-none text-sm bg-white"
              >
                <option>서울특별시</option>
                <option>경기도 / 인천</option>
                <option>부산 / 울산 / 경남</option>
                <option>대구 / 경북</option>
                <option>대전 / 세종 / 충청</option>
                <option>광주 / 전라</option>
                <option>강원 / 제주</option>
              </select>
            </div>
          </div>

          {/* Period & Amount */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-[#0F172A] mb-1.5">
                희망 납입기간
              </label>
              <select
                value={period}
                onChange={(e) => setPeriod(Number(e.target.value))}
                className="w-full px-3.5 py-2.5 rounded-xl border border-[#CBD5E1]/70 focus:border-[#0B192C] focus:outline-none text-sm bg-white"
              >
                <option value={5}>5년 납입 (추천)</option>
                <option value={7}>7년 납입</option>
                <option value={10}>10년 납입</option>
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-bold text-[#0F172A] mb-1.5">
                희망 월 납입금액
              </label>
              <select
                value={monthlyAmount}
                onChange={(e) => setMonthlyAmount(Number(e.target.value))}
                className="w-full px-3.5 py-2.5 rounded-xl border border-[#CBD5E1]/70 focus:border-[#0B192C] focus:outline-none text-sm bg-white"
              >
                {MATRIX_AMOUNTS.map((amt) => (
                  <option key={amt} value={amt}>
                    월 {amt}만원{amt === 50 ? ' (추천)' : amt === 200 ? ' 이상' : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Consent */}
          <label className="flex items-start gap-2 cursor-pointer pt-0.5">
            <input
              type="checkbox"
              required
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
              className="mt-0.5 rounded accent-[#0B192C]"
            />
            <span className="text-[11px] text-[#475569] leading-snug">
              [필수] 개인정보 수집 및 무료 환급금 비교 상담 연락에 동의합니다.
            </span>
          </label>

          {formError && (
            <div className="p-3 rounded-xl bg-[#FEE2E2] border border-[#DC2626]/30 text-[#991B1B] text-xs font-semibold">
              {formError}
            </div>
          )}

          {/* Submit CTA */}
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-3.5 rounded-full bg-[#F4B441] hover:bg-[#D99B26] disabled:opacity-60 text-[#0B192C] text-sm font-bold shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <span>{isSubmitting ? '안전하게 접수 저장 중...' : '무료 맞춤 환급금 비교서 받아보기'}</span>
            <Send className="w-4 h-4" />
          </button>

          {/* Secondary Quick Actions */}
          <div className="flex flex-wrap items-center justify-between gap-2.5 pt-1">
            <a
              href="https://open.kakao.com/o/sPDkSWVi"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-full bg-[#FEE500] hover:bg-[#F5DC00] text-[#191919] text-xs font-bold transition-colors whitespace-nowrap"
            >
              <MessageCircle className="w-3.5 h-3.5 fill-[#191919]" />
              <span>카카오톡 1:1 상담</span>
            </a>

            <div className="flex items-center gap-3 text-[11px] text-[#64748B]">
              <button
                type="button"
                onClick={onHideToday}
                className="hover:text-[#0B192C] hover:underline cursor-pointer whitespace-nowrap"
              >
                오늘 하루 그만 보기
              </button>
              <button
                type="button"
                onClick={onClose}
                className="font-bold text-[#0F172A] hover:underline cursor-pointer whitespace-nowrap"
              >
                닫기
              </button>
            </div>
          </div>

          <p className="text-center text-[11px] text-[#64748B] flex items-center justify-center gap-1 pt-0.5">
            <Lock className="w-3 h-3" />
            <span>입력 정보는 암호화되어 안전하게 관리됩니다.</span>
          </p>
        </form>
      </div>
    </div>
  );
}
