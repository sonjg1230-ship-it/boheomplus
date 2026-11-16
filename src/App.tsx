import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  BarChart3,
  Calculator,
  Check,
  CheckCircle2,
  Clock,
  History,
  Info,
  Landmark,
  Lock,
  Menu,
  MessageCircle,
  Receipt,
  RefreshCw,
  Send,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Star,
  TrendingUp,
  UserCheck,
  X,
  XCircle,
} from 'lucide-react';
import heroWealthImg from './assets/images/hero_wealth_advisory_1794729940673.jpg';
import {
  ClientRecord,
  INITIAL_CLIENT_RECORDS,
  MATRIX_AMOUNTS,
  PlanPeriod,
  TaxRateOption,
  buildYearlyCurve,
  calculatePlanProjection,
  formatKoreanMoney,
} from './data/wealthData';
import { SurrenderCurveChart } from './components/SurrenderCurveChart';
import { RetirementReadinessSection } from './components/RetirementReadinessSection';
import { AdminConsultationsModal } from './components/AdminConsultationsModal';
import {
  SubmittedModalInfo,
  WelcomeConsultModal,
} from './components/WelcomeConsultModal';
import {
  PublicFeedRecord,
  formatRelativeTime,
  submitConsultationLead,
  subscribePublicFeed,
} from './lib/firebase';

const MONTHLY_OPTIONS = [
  { amount: 10, subtitle: '청년/사회초년생' },
  { amount: 30, subtitle: '실속 목돈마련' },
  { amount: 50, subtitle: '가장 많은 선택', isBest: true },
  { amount: 100, subtitle: '전문직/사업자' },
  { amount: 150, subtitle: '자산 증식 집중' },
  { amount: 200, subtitle: '프레스티지 플랜' },
] as const;

export default function App() {
  // Simulator & Matrix Synchronized State
  const [selectedPeriod, setSelectedPeriod] = useState<PlanPeriod>(5);
  const [selectedAmount, setSelectedAmount] = useState<number>(50);
  const [taxRate, setTaxRate] = useState<TaxRateOption>(0.154);
  const [showCurvePanel, setShowCurvePanel] = useState<boolean>(true);
  const [reviewFilter, setReviewFilter] = useState<'all' | 5 | 7>('all');

  // Form State
  const [gender, setGender] = useState<'male' | 'female'>('male');
  const [clientName, setClientName] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [region, setRegion] = useState('서울특별시');
  const [formPeriod, setFormPeriod] = useState<number>(5);
  const [formAmount, setFormAmount] = useState<number>(50);
  const [agreed, setAgreed] = useState(true);
  const [formHighlight, setFormHighlight] = useState(false);

  // Live Ticker & Reviews
  const [clientRecords] = useState(INITIAL_CLIENT_RECORDS);
  const [firestoreFeed, setFirestoreFeed] = useState<PublicFeedRecord[]>([]);

  // Form submission & Modals state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [adminModalOpen, setAdminModalOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [welcomeCardOpen, setWelcomeCardOpen] = useState<boolean>(() => {
    try {
      const hiddenDate = localStorage.getItem('bohumplus_welcome_hide_date');
      const today = new Date().toISOString().slice(0, 10);
      return hiddenDate !== today;
    } catch {
      return true;
    }
  });

  // Success Modal State
  const [modalInfo, setModalInfo] = useState<SubmittedModalInfo | null>(null);

  useEffect(() => {
    const unsub = subscribePublicFeed(
      (items) => {
        setFirestoreFeed(items);
      },
      () => {
        // Fallback silently to initial seed ticker if feed listener encounters transient network error
      }
    );
    return unsub;
  }, []);

  const dailyCount = 142 + firestoreFeed.length;

  // Projections
  const projection = useMemo(
    () => calculatePlanProjection(selectedPeriod, selectedAmount, taxRate),
    [selectedPeriod, selectedAmount, taxRate]
  );

  const curveData = useMemo(() => buildYearlyCurve(selectedAmount), [selectedAmount]);

  const verifiedReviews = useMemo(() => {
    const base = clientRecords.filter((r) => r.sourceType === 'verified_review');
    if (reviewFilter === 'all') return base;
    return base.filter((r) => r.planPeriod === reviewFilter);
  }, [clientRecords, reviewFilter]);

  const liveLeads = useMemo<ClientRecord[]>(() => {
    const mappedDbLeads: ClientRecord[] = firestoreFeed.map((item) => ({
      id: `DB-${item.id}`,
      sourceType: 'live_lead',
      name: item.maskedName,
      age: 40,
      region: item.regionLabel,
      occupation: `${item.regionLabel} 신청`,
      planPeriod: item.period === 7 ? 7 : 5,
      monthlyAmount: item.monthlyAmount,
      tenYearValue: item.tenYearValue,
      statusLabel: '방금 접수 완료',
      timeLabel: formatRelativeTime(item.createdAt),
    }));
    const seedLeads = clientRecords.filter((r) => r.sourceType === 'live_lead');
    return [...mappedDbLeads, ...seedLeads];
  }, [clientRecords, firestoreFeed]);

  const syncPeriod = (period: PlanPeriod, skipForm = false) => {
    setSelectedPeriod(period);
    if (!skipForm) {
      setFormPeriod(period);
    }
  };

  const syncAmount = (amount: number, skipForm = false) => {
    setSelectedAmount(amount);
    if (!skipForm) {
      setFormAmount(amount);
    }
  };

  const handleSimulatorToConsult = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    setFormPeriod(selectedPeriod);
    setFormAmount(selectedAmount);
    const el = document.getElementById('contact');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    setFormHighlight(true);
    setTimeout(() => setFormHighlight(false), 1600);
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = clientName.trim();
    const trimmedPhone = clientPhone.trim();
    if (!trimmedName || !trimmedPhone || !agreed || isSubmitting) return;

    setFormError(null);
    setIsSubmitting(true);

    const calcPeriod: PlanPeriod = formPeriod === 7 ? 7 : 5;
    const proj = calculatePlanProjection(calcPeriod, formAmount, 0.154);

    try {
      const result = await submitConsultationLead({
        name: trimmedName,
        phone: trimmedPhone,
        birthDate,
        gender,
        region,
        period: formPeriod,
        monthlyAmount: formAmount,
        tenYearValue: proj.tenYearValue,
      });

      setModalInfo({
        name: trimmedName,
        phone: trimmedPhone,
        periodText: `${formPeriod}년 납입`,
        amountText: `월 ${formAmount}만원`,
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
    <div className="bg-[#F7F9FC] text-[#0F172A] antialiased overflow-x-clip pt-16 sm:pt-20 selection:bg-[#FFD166] selection:text-[#0B192C]">
      {/* 1. TopNavBar */}
      <header className="bg-[#0B192C]/95 backdrop-blur-md fixed top-0 left-0 right-0 z-50 shadow-md border-b border-white/10">
        <div className="w-full max-w-7xl mx-auto px-3.5 sm:px-6 lg:px-8 h-16 sm:h-20 flex items-center justify-between gap-2 sm:gap-4">
          {/* Brand Logo */}
          <a
            href="#"
            className="inline-flex items-center shrink-0 hover:opacity-90 transition-opacity"
          >
            <img
              src="/assets/aistudio/logo_bohumplus_navy.png"
              alt="보험플러스+ 당신의 행복을 지키는 보험"
              className="h-8 sm:h-11 lg:h-12 w-auto object-contain"
            />
          </a>

          {/* Navigation Links (Desktop) */}
          <nav className="hidden md:flex items-center gap-4 lg:gap-6 text-[13px] font-bold">
            <a
              href="#solution"
              className="text-[#FFD166] border-b-2 border-[#FFD166] pb-1 transition duration-200 whitespace-nowrap shrink-0"
            >
              솔루션 안내
            </a>
            <a
              href="#simulator"
              className="text-white/80 hover:text-[#FFD166] hover:opacity-100 pb-1 transition-colors whitespace-nowrap shrink-0"
            >
              환급률 시뮬레이터
            </a>
            <a
              href="#retirement"
              className="text-white/80 hover:text-[#FFD166] hover:opacity-100 pb-1 transition-colors whitespace-nowrap shrink-0"
            >
              은퇴 준비도
            </a>
            <a
              href="#comparison"
              className="text-white/80 hover:text-[#FFD166] hover:opacity-100 pb-1 transition-colors whitespace-nowrap shrink-0"
            >
              상품 비교
            </a>
            <a
              href="#reviews"
              className="text-white/80 hover:text-[#FFD166] hover:opacity-100 pb-1 transition-colors whitespace-nowrap shrink-0"
            >
              고객 후기
            </a>
          </nav>

          {/* Trailing Primary Actions & Mobile Drawer Toggle */}
          <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
            <a
              href="#contact"
              className="inline-flex items-center justify-center px-2.5 sm:px-4 lg:px-5 py-2 sm:py-2.5 lg:py-3 rounded-full bg-[#F4B441] hover:bg-[#D99B26] text-[#0B192C] text-[11px] sm:text-sm font-bold transition duration-200 active:scale-95 shadow-md whitespace-nowrap shrink-0"
            >
              <span className="sm:hidden">상담신청</span>
              <span className="hidden sm:inline">무료 상담신청</span>
              <ArrowRight className="ml-1 sm:ml-1.5 w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </a>
            <a
              href="https://open.kakao.com/o/sPDkSWVi"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center px-2.5 sm:px-4 lg:px-5 py-2 sm:py-2.5 lg:py-3 rounded-full bg-[#FEE500] hover:bg-[#F5DC00] text-[#191919] text-[11px] sm:text-sm font-bold transition duration-200 active:scale-95 shadow-md whitespace-nowrap shrink-0 cursor-pointer"
            >
              <MessageCircle className="mr-1 sm:mr-1.5 w-3.5 h-3.5 sm:w-4 sm:h-4 fill-[#191919]" />
              <span className="sm:hidden">카톡상담</span>
              <span className="hidden sm:inline">카카오톡 1:1 상담</span>
            </a>
            <button
              type="button"
              aria-label="모바일 메뉴 열기"
              aria-expanded={mobileMenuOpen}
              onClick={() => setMobileMenuOpen((v) => !v)}
              className="md:hidden w-8 h-8 rounded-lg bg-[#13294B] border border-white/15 text-white flex items-center justify-center cursor-pointer"
            >
              {mobileMenuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Mobile Dropdown Navigation Drawer */}
        {mobileMenuOpen && (
          <nav className="md:hidden bg-[#07111F] border-t border-white/10 px-4 py-3 grid grid-cols-3 gap-2 text-xs font-bold">
            {[
              { href: '#solution', label: '솔루션 안내' },
              { href: '#simulator', label: '시뮬레이터' },
              { href: '#retirement', label: '은퇴 준비도' },
              { href: '#comparison', label: '상품 비교' },
              { href: '#reviews', label: '고객 후기' },
              { href: '#contact', label: '무료 상담' },
            ].map((item) => (
              <a
                key={item.href}
                href={item.href}
                onClick={() => setMobileMenuOpen(false)}
                className="py-2 px-2.5 rounded-lg bg-[#13294B]/70 text-white/90 hover:text-[#FFD166] text-center whitespace-nowrap"
              >
                {item.label}
              </a>
            ))}
          </nav>
        )}
      </header>

      {/* 2. Hero Section (Wide 2-Column High Authority) */}
      <section className="relative bg-[#0B192C] text-white overflow-hidden pt-8 pb-14 sm:pt-12 sm:pb-20 lg:pb-24 border-b border-white/10">
        <div className="absolute -top-32 -left-32 w-96 h-96 bg-[#13294B] rounded-full blur-3xl opacity-50 pointer-events-none" />
        <div className="absolute top-1/2 right-0 w-[500px] h-[500px] bg-[#F4B441]/10 rounded-full blur-3xl pointer-events-none" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 sm:gap-10 lg:gap-12 items-center">
            {/* Left Content Column (7 cols) */}
            <div className="lg:col-span-7 space-y-5 sm:space-y-6">
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 sm:px-4 sm:py-2 rounded-full bg-[#0F233F] border border-[#FFD166]/30 text-[#FFD166] text-[11px] font-bold shadow-sm">
                <Sparkles className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
                <span>요즘 단기납 종신 및 자산케어 특별 솔루션</span>
              </div>

              <h1 className="text-2xl sm:text-[38px] lg:text-[44px] font-extrabold tracking-tight text-white leading-[1.28] sm:leading-[1.22]">
                5년·7년 집중납입으로 평생 보장 &amp; <br className="hidden sm:block" />
                <span className="text-[#FFD166] underline decoration-[#FFD166]/40 underline-offset-4 sm:underline-offset-8">
                  최대 120.4% 비과세 자산 증식!
                </span>
              </h1>

              <p className="text-sm sm:text-base font-medium text-[#F7F9FC]/80 max-w-2xl leading-relaxed">
                20년 긴 납입 부담은 이제 그만. 5년·7년 완납 후 원금 100% 안심 회복, 10년 시점
                최대 120.4% 확정 비과세 복리 환급과 든든한 평생 안전망을 구축하세요.
              </p>

              {/* Key Metrics Badges Grid */}
              <div className="grid grid-cols-3 gap-2 sm:gap-3 pt-1 sm:pt-2 max-w-xl">
                <div className="bg-[#13294B]/80 border border-white/10 rounded-xl p-2.5 sm:p-3.5 text-center">
                  <span className="block text-[10px] sm:text-[11px] text-[#BDD4F2] font-bold">납입 기간</span>
                  <span className="block text-xs sm:text-base lg:text-lg font-extrabold text-white mt-0.5">
                    5·7년 집중
                  </span>
                </div>
                <div className="bg-[#13294B]/80 border border-white/10 rounded-xl p-2.5 sm:p-3.5 text-center">
                  <span className="block text-[10px] sm:text-[11px] text-[#BDD4F2] font-bold">가입 연령</span>
                  <span className="block text-xs sm:text-base lg:text-lg font-extrabold text-white mt-0.5">
                    0~70세 누구나
                  </span>
                </div>
                <div className="bg-[#13294B]/80 border border-white/10 rounded-xl p-2.5 sm:p-3.5 text-center">
                  <span className="block text-[10px] sm:text-[11px] text-[#BDD4F2] font-bold">환급 완료</span>
                  <span className="block text-xs sm:text-base lg:text-lg font-extrabold text-[#FFD166] mt-0.5 tabular-nums">
                    최대 120.4%
                  </span>
                </div>
              </div>

              {/* Hero CTA Action Group */}
              <div className="pt-2 sm:pt-4 flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-3 sm:gap-4">
                <a
                  href="#simulator"
                  className="w-full sm:w-auto inline-flex items-center justify-center px-6 sm:px-8 py-3.5 sm:py-4 rounded-full bg-[#F4B441] hover:bg-[#D99B26] text-[#0B192C] text-sm sm:text-base font-bold shadow-lg hover:shadow-xl transition-all duration-200 hover:-translate-y-0.5 whitespace-nowrap"
                >
                  <span>지금 바로 내 환급금 시뮬레이션</span>
                  <Calculator className="ml-2 w-4 h-4 sm:w-5 sm:h-5" />
                </a>
                <div className="flex items-center justify-center sm:justify-start gap-2 text-xs font-bold text-[#BDD4F2]/90 pl-1">
                  <UserCheck className="w-4 h-4 text-[#FFD166] shrink-0" />
                  <span>금융소비자보호법 심의 완료 상품 연계</span>
                </div>
              </div>
            </div>

            {/* Right Visual Showcase Column (5 cols) */}
            <div className="lg:col-span-5 relative">
              <div className="relative rounded-2xl overflow-hidden shadow-2xl border border-white/15 bg-[#13294B] min-h-[370px] sm:min-h-0 aspect-[4/5] sm:aspect-[4/4.5] group">
                <img
                  src={heroWealthImg}
                  alt="프라이빗 자산관리 라운지에서 진행되는 단기납 자산케어 VIP 상담"
                  className="w-full h-full object-cover brightness-95 group-hover:scale-105 transition-transform duration-700"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#0B192C] via-[#0B192C]/35 to-transparent" />

                {/* Floating Prestige Card 1 */}
                <div className="absolute top-3 left-3 right-3 sm:top-5 sm:left-5 sm:right-5 bg-[#0B192C]/90 backdrop-blur-md border border-white/20 p-3 sm:p-4 rounded-xl shadow-xl flex items-center justify-between gap-2 sm:gap-3">
                  <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
                    <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg bg-[#13294B] flex items-center justify-center text-[#BDD4F2] shrink-0">
                      <RefreshCw className="w-4 h-4 sm:w-5 sm:h-5" />
                    </div>
                    <div className="min-w-0">
                      <span className="text-[10px] sm:text-[11px] font-bold text-[#CBD5E1] block">
                        5년·7년 완납 즉시
                      </span>
                      <span className="text-xs sm:text-base font-extrabold text-white block truncate">
                        원금 회복률 최대 100% 도달
                      </span>
                    </div>
                  </div>
                  <span className="px-2 py-1 bg-[#0F233F] text-[#BDD4F2] text-[10px] sm:text-[11px] rounded-md font-bold whitespace-nowrap shrink-0">
                    안심 회복
                  </span>
                </div>

                {/* Floating Prestige Card 2 */}
                <div className="absolute bottom-3 left-3 right-3 sm:bottom-5 sm:left-5 sm:right-5 bg-white text-[#0F172A] p-3.5 sm:p-5 rounded-2xl shadow-2xl border border-[#FFD166]/40">
                  <div className="flex items-center justify-between gap-2 mb-1.5 sm:mb-2">
                    <span className="inline-flex items-center gap-1 px-2 sm:px-2.5 py-0.5 bg-[#F4B441]/20 text-[#925800] text-[10px] sm:text-[11px] font-bold rounded-full">
                      <Star className="w-3 h-3 sm:w-3.5 sm:h-3.5 fill-[#925800] text-[#925800]" />
                      <span>10년 거치 비과세 복리 보장</span>
                    </span>
                    <span className="text-[10px] sm:text-[11px] font-bold text-[#DC2626] whitespace-nowrap">이자소득세 0원</span>
                  </div>
                  <div className="flex items-baseline justify-between gap-2">
                    <div>
                      <span className="text-[11px] sm:text-xs text-[#475569] block">확정 환급률</span>
                      <span className="text-2xl sm:text-4xl font-extrabold text-[#0B192C] tracking-tight tabular-nums">
                        120.4%
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-[11px] sm:text-xs text-[#475569] block">금융소득세 절세</span>
                      <span className="text-sm sm:text-lg font-bold text-[#925800] whitespace-nowrap">
                        15.4% 전액 면제
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* News Ticker & Market Realities */}
      <div className="bg-[#07111F] text-white py-3 sm:py-3.5 border-b border-white/5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-2 sm:gap-3 text-xs">
          <div className="flex items-start sm:items-center gap-2.5 sm:gap-3">
            <span className="px-2 sm:px-2.5 py-0.5 rounded bg-[#DC2626] text-white font-bold uppercase tracking-wider shrink-0 mt-0.5 sm:mt-0">
              ISSUE
            </span>
            <span className="text-[#F7F9FC]/90 font-medium leading-relaxed">
              &quot;기존 20년 납입 유지율 52% 불과... 이제는 5년·7년 집중 완납 후 120%대 환급 추구하는 스마트 재테크 대세&quot;
            </span>
          </div>
          <div className="text-[#FFD166] font-bold flex items-center gap-1 whitespace-normal sm:whitespace-nowrap shrink-0 pl-14 sm:pl-0">
            <span>한국경제 · 매일경제 금융기획 분석 보도 인용</span>
          </div>
        </div>
      </div>

      {/* 3. Comparison Section (기존 20년 종신 vs 단기납 자산케어) */}
      <section className="py-16 sm:py-20 lg:py-24 bg-[#F7F9FC]" id="comparison">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-10 sm:mb-14 space-y-3">
            <span className="text-[#925800] text-xs sm:text-sm font-bold uppercase tracking-wider block">
              PARADIGM SHIFT
            </span>
            <h2 className="text-2xl sm:text-[36px] lg:text-[40px] font-extrabold text-[#0F172A] tracking-tight leading-tight">
              왜 똑똑한 자산가들은 <br />
              <span className="text-[#0B192C] underline decoration-[#13294B]/30">
                20년 대신 단기 집중납입
              </span>
              을 선택할까요?
            </h2>
            <p className="text-sm sm:text-base text-[#475569]">
              과거의 기나긴 납입 고통과 중도해지 원금 손실 위험을 탈피하고, 단기 확정 환급과 비과세 혜택을 동시에 누립니다.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 sm:gap-8 items-stretch">
            {/* Legacy 20-Year Option */}
            <div className="bg-white rounded-2xl p-5 sm:p-8 border border-[#CBD5E1]/50 shadow-sm relative overflow-hidden flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between gap-2 pb-5 sm:pb-6 border-b border-[#CBD5E1]/30">
                  <div>
                    <span className="text-[11px] font-bold text-[#475569] uppercase">
                      기존 가입 패턴
                    </span>
                    <h3 className="text-lg sm:text-xl font-bold text-[#0F172A] mt-1">
                      기존 20년 장기 종신보험
                    </h3>
                  </div>
                  <span className="px-2.5 sm:px-3 py-1 rounded-full bg-[#FEE2E2] text-[#DC2626] text-[11px] sm:text-xs font-bold whitespace-nowrap shrink-0">
                    납입 부담 과중
                  </span>
                </div>

                <ul className="py-5 sm:py-6 space-y-4 text-xs sm:text-sm text-[#475569]">
                  <li className="flex items-start gap-3">
                    <XCircle className="w-5 h-5 text-[#DC2626] shrink-0 mt-0.5" />
                    <div>
                      <strong className="text-[#0F172A] block text-sm sm:text-base">240개월의 긴 납입 피로감</strong>
                      <span>경제적 위기나 소득 변화 시 20년간 연체 없이 납부하기 극히 어려움</span>
                    </div>
                  </li>
                  <li className="flex items-start gap-3">
                    <XCircle className="w-5 h-5 text-[#DC2626] shrink-0 mt-0.5" />
                    <div>
                      <strong className="text-[#0F172A] block text-sm sm:text-base">중도해지 시 극심한 원금 손실</strong>
                      <span>완납 유지율 52.28% 불과. 중도 해지 시 납입금의 50~70% 손실 발생</span>
                    </div>
                  </li>
                  <li className="flex items-start gap-3">
                    <XCircle className="w-5 h-5 text-[#DC2626] shrink-0 mt-0.5" />
                    <div>
                      <strong className="text-[#0F172A] block text-sm sm:text-base">더딘 원금 회복 및 자금 묶임</strong>
                      <span>원금 100% 도달까지 통상 15년~18년 소요되어 유동성 확보 불가</span>
                    </div>
                  </li>
                </ul>
              </div>

              <div className="p-4 rounded-xl bg-[#EEF3FA] border border-[#CBD5E1]/40 text-center">
                <span className="text-xs text-[#475569]">평균 완납 성공률</span>
                <div className="text-lg sm:text-xl font-extrabold text-[#DC2626] mt-0.5 tabular-nums">
                  52.28% (절반 이상 해지)
                </div>
              </div>
            </div>

            {/* Innovative Short-Pay Solution */}
            <div className="bg-[#0B192C] text-white rounded-2xl p-5 sm:p-8 border-2 border-[#FFD166]/40 shadow-2xl relative overflow-hidden flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between gap-2 pb-5 sm:pb-6 border-b border-white/15">
                  <div>
                    <span className="text-[11px] font-bold text-[#FFD166] uppercase tracking-wider">
                      프레스티지 플랜
                    </span>
                    <h3 className="text-lg sm:text-xl font-bold text-white mt-1">
                      혁신 단기납 자산케어 (5년/7년)
                    </h3>
                  </div>
                  <span className="px-3 py-1 rounded-full bg-[#F4B441] text-[#0B192C] text-[11px] sm:text-xs font-bold shadow-sm whitespace-nowrap shrink-0">
                    강력 추천
                  </span>
                </div>

                <ul className="py-5 sm:py-6 space-y-4 text-xs sm:text-sm text-[#F7F9FC]/90">
                  <li className="flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-[#FFD166] shrink-0 mt-0.5" />
                    <div>
                      <strong className="text-white block text-sm sm:text-base">
                        딱 60개월(5년) / 84개월(7년) 완납의 자유
                      </strong>
                      <span>소득 활동이 가장 왕성할 때 단기 집중 완납하고 조기 납입 완료</span>
                    </div>
                  </li>
                  <li className="flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-[#FFD166] shrink-0 mt-0.5" />
                    <div>
                      <strong className="text-white block text-sm sm:text-base">
                        완납 즉시 99.5% ~ 100% 원금 회복
                      </strong>
                      <span>완납 시점에 원금 손실 리스크를 완전 해소하고 안전자산화 달성</span>
                    </div>
                  </li>
                  <li className="flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-[#FFD166] shrink-0 mt-0.5" />
                    <div>
                      <strong className="text-[#FFD166] block text-sm sm:text-base">
                        10년 시점 최대 120.4% 확정 비과세 복리
                      </strong>
                      <span>이자소득세(15.4%) 전액 비과세 면제 및 종신 비과세 통장 평생 보유</span>
                    </div>
                  </li>
                </ul>
              </div>

              <div className="p-4 rounded-xl bg-[#13294B] border border-[#FFD166]/30 text-center">
                <span className="text-xs text-[#F7F9FC]/75">10년 확정 비과세 환급률</span>
                <div className="text-lg sm:text-xl font-extrabold text-[#FFD166] mt-0.5 tabular-nums">
                  최대 120.4% + 평생 종신보장
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 4. Interactive Simulator & Surrender Curve Analysis Section */}
      <section className="py-16 sm:py-20 lg:py-24 bg-[#EEF3FA] border-y border-[#CBD5E1]/40" id="simulator">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-10 sm:mb-12 space-y-3">
            <span className="text-[#925800] text-xs sm:text-sm font-bold uppercase tracking-wider block">
              REAL-TIME SIMULATION
            </span>
            <h2 className="text-2xl sm:text-[36px] lg:text-[40px] font-extrabold text-[#0F172A] tracking-tight">
              내 예상 환급금 및 비과세 절세액 계산기
            </h2>
            <p className="text-sm sm:text-base text-[#475569]">
              희망하시는 납입 기간(5년/7년)과 월 납입금액을 선택하면 실시간 확정 시뮬레이션 데이터를 제공합니다.
            </p>
          </div>

          <div className="bg-white rounded-3xl p-4 sm:p-8 lg:p-12 shadow-xl border border-[#CBD5E1]/40 max-w-5xl mx-auto">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-7 sm:gap-8 lg:gap-10 items-center">
              {/* Controls Column (6 cols) */}
              <div className="lg:col-span-6 space-y-6 sm:space-y-7">
                <div>
                  <label className="block text-xs font-bold text-[#0F172A] mb-3">
                    1. 납입 기간 선택
                  </label>
                  <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
                    <button
                      type="button"
                      onClick={() => syncPeriod(5)}
                      className={`py-3 sm:py-3.5 px-3 sm:px-4 rounded-xl text-xs sm:text-sm font-bold border-2 flex items-center justify-center gap-1.5 sm:gap-2 transition-all cursor-pointer whitespace-nowrap ${
                        selectedPeriod === 5
                          ? 'border-[#0B192C] bg-[#0B192C] text-white shadow-sm'
                          : 'border-[#CBD5E1]/60 bg-white text-[#475569] hover:border-[#0B192C]'
                      }`}
                    >
                      {selectedPeriod === 5 && <CheckCircle2 className="w-4 h-4 text-[#FFD166] shrink-0" />}
                      <span>5년 납입 (추천)</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => syncPeriod(7)}
                      className={`py-3 sm:py-3.5 px-3 sm:px-4 rounded-xl text-xs sm:text-sm font-bold border-2 flex items-center justify-center gap-1.5 sm:gap-2 transition-all cursor-pointer whitespace-nowrap ${
                        selectedPeriod === 7
                          ? 'border-[#0B192C] bg-[#0B192C] text-white shadow-sm'
                          : 'border-[#CBD5E1]/60 bg-white text-[#475569] hover:border-[#0B192C]'
                      }`}
                    >
                      {selectedPeriod === 7 && <CheckCircle2 className="w-4 h-4 text-[#FFD166] shrink-0" />}
                      <span>7년 납입 플랜</span>
                    </button>
                  </div>
                </div>

                {/* Monthly Amount Selector Grid */}
                <div>
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
                    <label className="block text-xs font-bold text-[#0F172A]">
                      2. 희망 월 납입금액 선택
                    </label>
                    <select
                      aria-label="비교 과세율 선택"
                      value={taxRate}
                      onChange={(e) => setTaxRate(Number(e.target.value) as TaxRateOption)}
                      className="text-xs font-bold text-[#0B192C] bg-[#F7F9FC] border border-[#CBD5E1] rounded-lg px-2.5 py-1.5 focus:outline-none w-full sm:w-auto"
                    >
                      <option value={0.154}>일반 이자소득세 15.4% 기준</option>
                      <option value={0.264}>종합과세 26.4% 기준</option>
                      <option value={0.495}>고액자산가 49.5% 기준</option>
                    </select>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                    {MONTHLY_OPTIONS.map((opt) => {
                      const active = selectedAmount === opt.amount;
                      return (
                        <button
                          key={opt.amount}
                          type="button"
                          onClick={() => syncAmount(opt.amount)}
                          className={`py-3 px-2 rounded-xl text-center transition-all relative cursor-pointer ${
                            active
                              ? 'border-2 border-[#925800] bg-[#925800]/5'
                              : 'border border-[#CBD5E1]/60 bg-white hover:border-[#0B192C]'
                          }`}
                        >
                          {'isBest' in opt && opt.isBest && (
                            <span className="absolute -top-2 right-2 px-1.5 py-0.5 bg-[#925800] text-white text-[10px] font-bold rounded-full">
                              BEST
                            </span>
                          )}
                          <span
                            className={`block text-sm font-bold tabular-nums ${
                              active ? 'text-[#925800]' : 'text-[#0F172A]'
                            }`}
                          >
                            {opt.amount}만원
                          </span>
                          <span className="text-[11px] text-[#475569] block mt-0.5">
                            {opt.subtitle}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="flex items-center gap-2 text-xs text-[#475569] bg-[#E5ECF6] p-3.5 rounded-xl">
                  <Info className="w-4 h-4 text-[#13294B] shrink-0" />
                  <span>
                    {selectedPeriod === 5
                      ? '5년 완납 시 99.5% 즉시 회복, 10년 시점 120.4% 확정 비과세 복리 기준 수치입니다.'
                      : '7년 완납 시 100.0% 전액 회복, 10년 시점 122.5% 확정 비과세 복리 기준 수치입니다.'}
                  </span>
                </div>
              </div>

              {/* Result Display Showcase (6 cols) */}
              <div className="lg:col-span-6 bg-[#0B192C] text-white rounded-2xl p-5 sm:p-7 border border-[#FFD166]/30 shadow-2xl">
                <div className="flex flex-wrap items-center justify-between gap-2 pb-4 border-b border-white/10">
                  <span className="text-xs font-bold text-[#FFD166] flex items-center gap-1.5">
                    <BarChart3 className="w-4 h-4" />
                    <span>실시간 시뮬레이션 결과</span>
                  </span>
                  <span className="text-xs text-[#BDD4F2] tabular-nums">
                    {selectedPeriod}년 납입 · 월 {selectedAmount}만원 기준
                  </span>
                </div>

                <div className="py-5 sm:py-6 space-y-4 sm:space-y-5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs sm:text-sm text-[#F7F9FC]/80">
                      총 납입 원금 ({projection.months}회)
                    </span>
                    <span className="text-base sm:text-lg font-bold text-white tabular-nums">
                      {formatKoreanMoney(projection.totalPrincipal)}
                    </span>
                  </div>

                  <div className="flex items-center justify-between gap-2 bg-[#13294B]/80 p-3.5 rounded-xl border border-white/10">
                    <div>
                      <span className="block text-[11px] font-bold text-[#BDD4F2]">
                        {selectedPeriod}년 완납 시점 환급금 ({projection.payoffRatePct.toFixed(1)}%)
                      </span>
                      <span className="text-xs text-[#F7F9FC]/60">
                        {selectedPeriod === 5 ? '원금 즉시 회복 달성' : '원금 전액 100% 회복 달성'}
                      </span>
                    </div>
                    <span className="text-base sm:text-lg font-bold text-white tabular-nums whitespace-nowrap">
                      {formatKoreanMoney(projection.payoffValue)}
                    </span>
                  </div>

                  <div className="bg-[#0F233F] p-4 rounded-xl border-2 border-[#FFD166]/60">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div>
                        <span className="inline-flex items-center gap-1 text-[11px] text-[#FFD166] font-bold">
                          <Star className="w-3.5 h-3.5 fill-[#FFD166]" />
                          <span>
                            10년 {selectedPeriod === 5 ? '거치' : ''} 시 환급금 (
                            {projection.tenYearRatePct.toFixed(1)}%)
                          </span>
                        </span>
                        <span className="block text-xs text-[#F7F9FC]/70 mt-0.5">
                          확정 복리 수익 + 평생 보장
                        </span>
                      </div>
                      <span className="text-2xl sm:text-3xl font-extrabold text-[#FFD166] tracking-tight tabular-nums whitespace-nowrap">
                        {formatKoreanMoney(projection.tenYearValue)}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-2 px-1 pt-1">
                    <span className="text-xs text-[#BDD4F2]">
                      비과세 절세 혜택 ({(taxRate * 100).toFixed(1)}% 감면)
                    </span>
                    <span className="text-sm sm:text-lg font-bold text-[#FFD166] tabular-nums whitespace-nowrap">
                      +{projection.taxSaved.toFixed(1)} 만원 절세
                    </span>
                  </div>
                </div>

                <a
                  href="#contact"
                  onClick={handleSimulatorToConsult}
                  className="w-full inline-flex items-center justify-center py-3.5 sm:py-4 px-4 rounded-full bg-[#F4B441] hover:bg-[#D99B26] text-[#0B192C] text-sm sm:text-base font-bold transition-all shadow-lg"
                >
                  <span>이 설계 조건으로 무료 상담받기</span>
                  <ArrowRight className="ml-2 w-4 h-4 sm:w-5 sm:h-5" />
                </a>
              </div>
            </div>

            {/* Interactive Analytical Curve Toggle Bar */}
            <div className="mt-8 pt-6 border-t border-[#CBD5E1]">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                <div>
                  <span className="text-sm font-extrabold text-[#0B192C] block">
                    연차별 해약환급률 비교 분석 그래프 (1년 ~ 15년)
                  </span>
                  <span className="text-xs text-[#475569]">
                    선택하신 월 {selectedAmount}만원 기준으로 5년납·7년납·기존 20년납의 원금 회복 속도를 연도별로 비교합니다.
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowCurvePanel(!showCurvePanel)}
                  className="px-4 py-2 rounded-full border border-[#0B192C]/20 text-xs font-bold text-[#0B192C] hover:bg-[#EBF2FA] transition-colors cursor-pointer whitespace-nowrap self-start sm:self-auto"
                >
                  {showCurvePanel ? '분석 그래프 접기' : '분석 그래프 펼치기'}
                </button>
              </div>
              {showCurvePanel && (
                <SurrenderCurveChart data={curveData} monthlyAmount={selectedAmount} />
              )}
            </div>
          </div>
        </div>
      </section>

      {/* 5. Retirement Readiness Section */}
      <RetirementReadinessSection
        selectedPeriod={selectedPeriod}
        monthlyAmount={selectedAmount}
        taxRate={taxRate}
        onSelectPeriod={(p) => syncPeriod(p)}
        onChangeMonthlyAmount={(amt) => syncAmount(amt)}
      />

      {/* 6. 4 Key Privileges & Recommended Targets */}
      <section className="py-16 sm:py-20 lg:py-24 bg-[#0B192C] text-white" id="solution">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-10 sm:mb-14 space-y-3">
            <span className="text-[#FFD166] text-xs sm:text-sm font-bold uppercase tracking-wider block">
              EXCLUSIVE PRIVILEGES
            </span>
            <h2 className="text-2xl sm:text-[36px] lg:text-[40px] font-extrabold text-white tracking-tight">
              단기납 자산케어 4대 핵심 특권
            </h2>
            <p className="text-sm sm:text-base text-[#F7F9FC]/80">
              단순한 보장을 넘어 금융 자산의 안전한 증식과 세무 전략까지 한 번에 완성합니다.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-12 sm:mb-16">
            <div className="bg-[#13294B]/90 border border-white/15 rounded-2xl p-5 sm:p-6 hover:border-[#FFD166]/50 transition-all">
              <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl bg-[#0F233F] flex items-center justify-center text-[#FFD166] mb-4 sm:mb-5 border border-[#FFD166]/30">
                <Clock className="w-5 h-5 sm:w-6 sm:h-6" />
              </div>
              <span className="text-[11px] font-bold text-[#BDD4F2] uppercase tracking-wider block">
                특권 01
              </span>
              <h3 className="text-base sm:text-lg font-bold text-white mt-1 mb-2">
                5·7년 완납의 압도적 자유
              </h3>
              <p className="text-xs text-[#F7F9FC]/75 leading-relaxed">
                20년 동안 얽매이지 않고 소득 전성기 5년 또는 7년 내에 집중 완납하여 납입 리스크를 종결합니다.
              </p>
            </div>

            <div className="bg-[#13294B]/90 border border-white/15 rounded-2xl p-5 sm:p-6 hover:border-[#FFD166]/50 transition-all">
              <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl bg-[#0F233F] flex items-center justify-center text-[#FFD166] mb-4 sm:mb-5 border border-[#FFD166]/30">
                <Landmark className="w-5 h-5 sm:w-6 sm:h-6" />
              </div>
              <span className="text-[11px] font-bold text-[#BDD4F2] uppercase tracking-wider block">
                특권 02
              </span>
              <h3 className="text-base sm:text-lg font-bold text-white mt-1 mb-2">
                15.4% 비과세 전액 면제
              </h3>
              <p className="text-xs text-[#F7F9FC]/75 leading-relaxed">
                관련 세법 충족 시 이자소득세 비과세 및 금융소득종합과세 대상에서 제외되는 절세 혜택을 제공합니다.
              </p>
            </div>

            <div className="bg-[#13294B]/90 border border-white/15 rounded-2xl p-5 sm:p-6 hover:border-[#FFD166]/50 transition-all">
              <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl bg-[#0F233F] flex items-center justify-center text-[#FFD166] mb-4 sm:mb-5 border border-[#FFD166]/30">
                <RefreshCw className="w-5 h-5 sm:w-6 sm:h-6" />
              </div>
              <span className="text-[11px] font-bold text-[#BDD4F2] uppercase tracking-wider block">
                특권 03
              </span>
              <h3 className="text-base sm:text-lg font-bold text-white mt-1 mb-2">
                유연한 중도인출 &amp; 추가납입
              </h3>
              <p className="text-xs text-[#F7F9FC]/75 leading-relaxed">
                목돈이 필요할 땐 해약 없이 중도인출을, 여유 자금이 생기면 추가납입으로 복리 수익을 극대화합니다.
              </p>
            </div>

            <div className="bg-[#13294B]/90 border border-white/15 rounded-2xl p-5 sm:p-6 hover:border-[#FFD166]/50 transition-all">
              <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl bg-[#0F233F] flex items-center justify-center text-[#FFD166] mb-4 sm:mb-5 border border-[#FFD166]/30">
                <ShieldCheck className="w-5 h-5 sm:w-6 sm:h-6" />
              </div>
              <span className="text-[11px] font-bold text-[#BDD4F2] uppercase tracking-wider block">
                특권 04
              </span>
              <h3 className="text-base sm:text-lg font-bold text-white mt-1 mb-2">평생 종신보장 결합</h3>
              <p className="text-xs text-[#F7F9FC]/75 leading-relaxed">
                목돈 자산 형성은 물론, 예기치 못한 유고 시 가족을 위한 든든한 상속 보장 자산으로 기능합니다.
              </p>
            </div>
          </div>

          <div className="pt-8 border-t border-white/10">
            <h3 className="text-lg sm:text-xl font-bold text-center text-white mb-6 sm:mb-10">
              이런 분들께 가장 강력히 추천합니다
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
              <div className="bg-[#07111F] p-5 sm:p-6 rounded-2xl border border-white/10 flex items-start gap-3.5 sm:gap-4">
                <div className="p-2.5 sm:p-3 rounded-xl bg-[#F4B441]/20 text-[#FDE68A] shrink-0">
                  <TrendingUp className="w-5 h-5 sm:w-6 sm:h-6" />
                </div>
                <div>
                  <h4 className="text-sm sm:text-base font-bold text-white">단기 안정 목돈 운용자</h4>
                  <p className="text-xs text-[#F7F9FC]/70 mt-1.5 leading-relaxed">
                    5·7년 후 안정적으로 목돈을 수령하거나 10년 비과세 복리 혜택을 챙기려는 실속파
                  </p>
                </div>
              </div>

              <div className="bg-[#07111F] p-5 sm:p-6 rounded-2xl border border-white/10 flex items-start gap-3.5 sm:gap-4">
                <div className="p-2.5 sm:p-3 rounded-xl bg-[#F4B441]/20 text-[#FDE68A] shrink-0">
                  <History className="w-5 h-5 sm:w-6 sm:h-6" />
                </div>
                <div>
                  <h4 className="text-sm sm:text-base font-bold text-white">20년 장기 납입이 두려운 분</h4>
                  <p className="text-xs text-[#F7F9FC]/70 mt-1.5 leading-relaxed">
                    과거 20년 납입 중도 해지로 손실을 겪어 짧고 굵게 집중 완납을 원하는 자산가
                  </p>
                </div>
              </div>

              <div className="bg-[#07111F] p-5 sm:p-6 rounded-2xl border border-white/10 flex items-start gap-3.5 sm:gap-4">
                <div className="p-2.5 sm:p-3 rounded-xl bg-[#F4B441]/20 text-[#FDE68A] shrink-0">
                  <Receipt className="w-5 h-5 sm:w-6 sm:h-6" />
                </div>
                <div>
                  <h4 className="text-sm sm:text-base font-bold text-white">금융소득 절세가 절실한 고소득자</h4>
                  <p className="text-xs text-[#F7F9FC]/70 mt-1.5 leading-relaxed">
                    이자소득세 15.4% 비과세와 금융소득종합과세 방어가 필요한 사업자 및 전문직
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 7. Customer Reviews Section */}
      <section className="py-16 sm:py-20 lg:py-24 bg-[#F7F9FC]" id="reviews">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-8 sm:mb-10 space-y-3">
            <span className="text-[#925800] text-xs sm:text-sm font-bold uppercase tracking-wider block">
              CLIENT TESTIMONIALS
            </span>
            <h2 className="text-2xl sm:text-[36px] lg:text-[40px] font-extrabold text-[#0F172A] tracking-tight">
              실제 가입 고객 만족 후기
            </h2>
            <div className="flex flex-wrap items-center justify-center gap-1 text-[#925800]">
              {[0, 1, 2, 3, 4].map((idx) => (
                <Star key={idx} className="w-4 h-4 sm:w-5 sm:h-5 fill-[#F4B441] text-[#F4B441]" />
              ))}
              <span className="ml-1.5 font-bold text-[#0F172A] text-xs sm:text-base">
                평점 4.9점 / 5.0점 (가입자 2,840명 응답)
              </span>
            </div>

            {/* Interactive Review Plan Filter */}
            <div className="pt-2 inline-flex p-1 rounded-xl bg-[#EDF2F7] border border-[#CBD5E1]/50">
              {(
                [
                  { key: 'all', label: '전체 후기' },
                  { key: 5, label: '5년납 가입자' },
                  { key: 7, label: '7년납 가입자' },
                ] as const
              ).map((item) => (
                <button
                  key={String(item.key)}
                  type="button"
                  onClick={() => setReviewFilter(item.key)}
                  className={`px-3 sm:px-3.5 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer whitespace-nowrap ${
                    reviewFilter === item.key
                      ? 'bg-[#0B192C] text-white'
                      : 'text-[#475569] hover:text-[#0F172A]'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          <div className="relative overflow-hidden w-full reviews-marquee-container">
            <div className="absolute top-0 bottom-0 left-0 w-8 sm:w-16 bg-gradient-to-r from-[#F7F9FC] to-transparent z-10 pointer-events-none" />
            <div className="absolute top-0 bottom-0 right-0 w-8 sm:w-16 bg-gradient-to-l from-[#F7F9FC] to-transparent z-10 pointer-events-none" />

            <div className="reviews-marquee-track gap-4 sm:gap-6 py-2">
              {[...verifiedReviews, ...verifiedReviews].map((rev, idx) => (
                <div
                  key={`${rev.id}-${idx}`}
                  className="w-[280px] sm:w-96 shrink-0 bg-white rounded-2xl p-5 sm:p-7 border border-[#CBD5E1]/40 shadow-md hover:shadow-xl transition-shadow flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-[#13294B] text-[#BDD4F2] flex items-center justify-center font-bold text-xs sm:text-sm shrink-0">
                          {rev.name}
                        </div>
                        <div>
                          <span className="block font-bold text-xs sm:text-sm text-[#0F172A]">
                            {rev.occupation} ({rev.age}세)
                          </span>
                          <span className="text-[11px] sm:text-xs text-[#475569]">
                            월 {rev.monthlyAmount}만원 · {rev.planPeriod}년납 가입
                          </span>
                        </div>
                      </div>
                      <span className="text-[#925800] font-bold text-xs">★★★★★</span>
                    </div>
                    <p className="text-xs sm:text-sm text-[#0F172A]/90 leading-relaxed italic">
                      &quot;{rev.quote}&quot;
                    </p>
                  </div>
                  <div className="mt-5 sm:mt-6 pt-3.5 sm:pt-4 border-t border-[#CBD5E1]/30 flex items-center justify-between text-[11px] sm:text-xs text-[#475569]">
                    <span>인증 가입 고객</span>
                    <span className="text-[#0B192C] font-semibold tabular-nums">
                      10년 시점 {formatKoreanMoney(rev.tenYearValue)} 확정
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* 8. Consultation Request Form & Live Application Ticker Section */}
      <section className="py-16 sm:py-20 lg:py-24 bg-[#EEF3FA] border-t border-[#CBD5E1]/40" id="contact">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 sm:gap-10 lg:gap-12 items-start">
            {/* Left Column: Live Ticker (5 cols) */}
            <div className="lg:col-span-5 space-y-6 sm:space-y-8">
              <div>
                <span className="text-[#925800] text-xs sm:text-sm font-bold uppercase tracking-wider block">
                  FAST CONSULTATION
                </span>
                <h2 className="text-2xl sm:text-[36px] lg:text-[38px] font-extrabold text-[#0F172A] tracking-tight mt-2 leading-tight">
                  간단한 정보 입력으로 <br />
                  <span className="text-[#0B192C]">내 맞춤 환급금</span>을 확인하세요
                </h2>
                <p className="text-sm sm:text-base text-[#475569] mt-3">
                  전화 한 통으로 각 생보사별 환급률과 가입 심사 조건을 비교 분석해 드립니다. 상담비용은 전액 무료입니다.
                </p>
              </div>

              {/* Live Consultation Registration Ticker */}
              <div className="bg-white rounded-3xl p-4 sm:p-7 border border-[#CBD5E1]/40 shadow-xl overflow-hidden relative">
                <div className="flex items-center justify-between gap-2 pb-4 border-b border-[#CBD5E1]/30 mb-4">
                  <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
                    <span className="relative flex h-3 w-3 shrink-0">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#DC2626] opacity-75" />
                      <span className="relative inline-flex rounded-full h-3 w-3 bg-[#DC2626]" />
                    </span>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 sm:gap-2">
                        <span className="text-xs font-bold text-[#0F172A] truncate">
                          실시간 상담 접수 현황
                        </span>
                        <span className="px-2 py-0.5 rounded-full bg-[#DC2626]/10 text-[#DC2626] text-[10px] font-bold tracking-wider shrink-0">
                          LIVE
                        </span>
                      </div>
                      <span className="text-[11px] text-[#475569] block mt-0.5 truncate">
                        1:1 수석 전문상담사 즉시 배정 진행 중
                      </span>
                    </div>
                  </div>
                  <div className="flex flex-col items-end shrink-0">
                    <span className="text-[11px] text-[#475569]">오늘 누적 신청</span>
                    <div className="inline-flex items-center gap-1 text-[#0B192C] font-extrabold text-sm sm:text-base tabular-nums">
                      <span>{dailyCount}</span>
                      <span className="text-xs font-normal text-[#475569]">명</span>
                    </div>
                  </div>
                </div>

                {/* Infinite Vertical Scrolling Frame */}
                <div className="relative h-[360px] sm:h-[440px] overflow-hidden marquee-container-up">
                  <div className="absolute top-0 left-0 right-0 h-8 bg-gradient-to-b from-white to-transparent z-10 pointer-events-none" />
                  <div className="absolute bottom-0 left-0 right-0 h-10 bg-gradient-to-t from-white to-transparent z-10 pointer-events-none" />

                  <div className="marquee-track-up space-y-2.5 sm:space-y-3">
                    {[...liveLeads, ...liveLeads].map((lead, idx) => (
                      <div
                        key={`${lead.id}-${idx}`}
                        className="p-3 sm:p-3.5 rounded-2xl bg-[#EEF3FA] border border-[#CBD5E1]/30 hover:border-[#0B192C]/40 transition-colors flex items-center justify-between gap-2.5 sm:gap-3 shadow-xs"
                      >
                        <div className="space-y-0.5 min-w-0">
                          <div className="flex items-center gap-1.5 sm:gap-2">
                            <span className="font-bold text-[#0F172A] text-xs sm:text-sm truncate">
                              {lead.occupation} {lead.name} 고객님
                            </span>
                            <span className="text-[10px] sm:text-[11px] px-1.5 py-0.5 rounded bg-[#E5ECF6] text-[#475569] shrink-0">
                              {lead.age}세
                            </span>
                          </div>
                          <span className="text-[11px] sm:text-xs text-[#475569] block">
                            {lead.planPeriod}년 집중납입 · 월 {lead.monthlyAmount}만원
                          </span>
                        </div>
                        <div className="text-right shrink-0">
                          <span
                            className={`px-2 py-0.5 rounded-md font-bold text-[11px] sm:text-xs block tabular-nums ${
                              lead.planPeriod === 5
                                ? 'bg-[#F4B441]/20 text-[#925800]'
                                : 'bg-[#EBF2FA] text-[#13294B]'
                            }`}
                          >
                            10년 {formatKoreanMoney(lead.tenYearValue, true)} 확정
                          </span>
                          <span className="text-[10px] text-[#475569] mt-0.5 block">
                            {lead.timeLabel}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="pt-4 mt-2 border-t border-[#CBD5E1]/30 flex items-center justify-between text-xs text-[#475569]">
                  <span className="flex items-center gap-1.5 text-[#13294B] font-semibold">
                    <ShieldCheck className="w-4 h-4 shrink-0" />
                    <span>실명 인증 완료 실시간 데이터</span>
                  </span>
                  <span className="hidden sm:inline text-[11px] text-[#64748B]">마우스 호버 시 일시정지</span>
                </div>
              </div>
            </div>

            {/* Right Column: Form Container (7 cols) */}
            <div
              className={`lg:col-span-7 bg-white rounded-3xl p-5 sm:p-8 lg:p-10 border border-[#CBD5E1]/40 shadow-xl transition-all ${
                formHighlight ? 'ring-2 ring-[#925800]' : ''
              }`}
            >
              <form onSubmit={handleFormSubmit} className="space-y-6">
                {/* Gender Selector */}
                <div>
                  <label className="block text-xs font-bold text-[#0F172A] mb-2">성별</label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setGender('male')}
                      className={`p-3 rounded-xl text-xs font-bold border transition-colors cursor-pointer ${
                        gender === 'male'
                          ? 'border-2 border-[#0B192C] bg-[#0B192C] text-white'
                          : 'border-[#CBD5E1]/60 bg-white text-[#0F172A] hover:border-[#0B192C]'
                      }`}
                    >
                      남성
                    </button>
                    <button
                      type="button"
                      onClick={() => setGender('female')}
                      className={`p-3 rounded-xl text-xs font-bold border transition-colors cursor-pointer ${
                        gender === 'female'
                          ? 'border-2 border-[#0B192C] bg-[#0B192C] text-white'
                          : 'border-[#CBD5E1]/60 bg-white text-[#0F172A] hover:border-[#0B192C]'
                      }`}
                    >
                      여성
                    </button>
                  </div>
                </div>

                {/* Name & Contact Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-[#0F172A] mb-2">성함</label>
                    <input
                      type="text"
                      required
                      value={clientName}
                      onChange={(e) => setClientName(e.target.value)}
                      placeholder="홍길동"
                      className="w-full px-4 py-3.5 rounded-xl border border-[#CBD5E1]/60 focus:border-[#0B192C] focus:outline-none text-sm bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-[#0F172A] mb-2">연락처</label>
                    <input
                      type="tel"
                      required
                      value={clientPhone}
                      onChange={(e) => setClientPhone(e.target.value)}
                      placeholder="010-1234-5678"
                      className="w-full px-4 py-3.5 rounded-xl border border-[#CBD5E1]/60 focus:border-[#0B192C] focus:outline-none text-sm bg-white"
                    />
                  </div>
                </div>

                {/* Birth Date & Region Dropdown */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-[#0F172A] mb-2">
                      생년월일 (6자리)
                    </label>
                    <input
                      type="text"
                      maxLength={6}
                      required
                      value={birthDate}
                      onChange={(e) => setBirthDate(e.target.value)}
                      placeholder="예: 850315"
                      className="w-full px-4 py-3.5 rounded-xl border border-[#CBD5E1]/60 focus:border-[#0B192C] focus:outline-none text-sm bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-[#0F172A] mb-2">거주 지역</label>
                    <select
                      value={region}
                      onChange={(e) => setRegion(e.target.value)}
                      className="w-full px-4 py-3.5 rounded-xl border border-[#CBD5E1]/60 focus:border-[#0B192C] focus:outline-none text-sm bg-white"
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

                {/* Term & Budget Preferences */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-[#0F172A] mb-2">
                      희망 납입기간
                    </label>
                    <select
                      value={formPeriod}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        setFormPeriod(val);
                        if (val === 5 || val === 7) {
                          syncPeriod(val, true);
                        }
                      }}
                      className="w-full px-4 py-3.5 rounded-xl border border-[#CBD5E1]/60 focus:border-[#0B192C] focus:outline-none text-sm bg-white"
                    >
                      <option value={5}>5년 납입 (가장 인기)</option>
                      <option value={7}>7년 납입</option>
                      <option value={10}>10년 납입</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-[#0F172A] mb-2">
                      희망 월 납입금액
                    </label>
                    <select
                      value={formAmount}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        setFormAmount(val);
                        syncAmount(val, true);
                      }}
                      className="w-full px-4 py-3.5 rounded-xl border border-[#CBD5E1]/60 focus:border-[#0B192C] focus:outline-none text-sm bg-white"
                    >
                      {MATRIX_AMOUNTS.map((amt) => (
                        <option key={amt} value={amt}>
                          월 {amt}만원{amt === 50 ? ' (추천 플랜)' : amt === 200 ? ' 이상' : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Agreement Checkbox */}
                <div className="pt-2">
                  <label className="flex items-start gap-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      required
                      checked={agreed}
                      onChange={(e) => setAgreed(e.target.checked)}
                      className="mt-1 rounded accent-[#0B192C]"
                    />
                    <span className="text-xs text-[#475569]">
                      [필수] 개인정보 수집 및 환급금 비교 상담 안내를 위한 연락에 동의합니다. (수집 항목: 성함, 연락처, 생년월일, 거주지)
                    </span>
                  </label>
                </div>

                {formError && (
                  <div className="p-3.5 rounded-xl bg-[#FEE2E2] border border-[#DC2626]/30 text-[#991B1B] text-xs font-semibold">
                    {formError}
                  </div>
                )}

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-4 sm:py-5 rounded-full bg-[#F4B441] hover:bg-[#D99B26] disabled:opacity-60 text-[#0B192C] text-sm sm:text-base font-bold shadow-lg hover:shadow-xl transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer"
                >
                  <span>{isSubmitting ? '안전하게 접수 저장 중...' : '무료 맞춤 환급금 비교서 받아보기'}</span>
                  <Send className="w-4 h-4 sm:w-5 sm:h-5" />
                </button>

                <p className="text-center text-[11px] sm:text-xs text-[#475569] flex items-center justify-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 shrink-0" />
                  <span>입력하신 모든 정보는 암호화 처리되며 금융소비자보호법에 의거 안전하게 관리됩니다.</span>
                </p>
              </form>
            </div>
          </div>
        </div>
      </section>

      {/* 9. Footer */}
      <footer className="bg-[#07111F] text-white">
        <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-12 flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="space-y-3 text-center md:text-left max-w-3xl">
            <div className="flex flex-wrap items-center justify-center md:justify-start gap-3">
              <img
                src="/assets/aistudio/logo_bohumplus_navy.png"
                alt="보험플러스+ 당신의 행복을 지키는 보험"
                className="h-10 sm:h-12 w-auto object-contain"
              />
              <button
                type="button"
                onClick={() => setAdminModalOpen(true)}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#0F233F] border border-white/10 text-[11px] text-white/55 hover:text-[#FFD166] hover:border-[#FFD166]/40 transition-colors cursor-pointer whitespace-nowrap"
              >
                <Lock className="w-3 h-3" />
                <span>관리자</span>
              </button>
            </div>
            <p className="text-xs text-white/60 leading-relaxed">
              © 2025 단기납 자산케어 금융 프리미엄 센터. All rights reserved. 본 웹사이트는 금융소비자보호법 제19조 제1항에 따른 중요 고지사항을 준수합니다.
            </p>
            <p className="text-[11px] text-[#F7F9FC]/40 leading-normal">
              보험계약 체결 전 반드시 상품설명서 및 약관을 확인하시기 바랍니다. 보험계약자가 기존 보험계약을 해지하고 새로운 보험계약을 체결하는 과정에서 가입이 거절되거나 보험료가 인상될 수 있습니다. 비과세 요건은 관련 세법령(소득세법 시행령 제25조 등) 요건을 충족하는 경우에 한합니다.
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-3 text-xs whitespace-nowrap">
            <a href="#comparison" className="text-white/60 hover:text-[#FFD166] hover:underline">
              이용약관
            </a>
            <a href="#contact" className="text-[#FFD166] font-bold hover:underline">
              개인정보처리방침
            </a>
            <a href="#solution" className="text-white/60 hover:text-[#FFD166] hover:underline">
              금융소비자보호기준
            </a>
            <a href="#simulator" className="text-white/60 hover:text-[#FFD166] hover:underline">
              공시실
            </a>
          </div>
        </div>
      </footer>

      {/* 10. Prestige Application Success Modal */}
      {modalInfo && (
        <div
          aria-modal="true"
          role="dialog"
          className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-6"
        >
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-md"
            onClick={() => setModalInfo(null)}
          />
          <div className="relative w-full max-w-xl max-h-[92vh] overflow-y-auto bg-white rounded-3xl shadow-2xl border border-[#FFD166]/30 p-5 sm:p-8 z-10">
            <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-[#13294B] via-[#FFD166] to-[#0B192C]" />

            <button
              type="button"
              aria-label="닫기"
              onClick={() => setModalInfo(null)}
              className="absolute top-4 right-4 sm:top-5 sm:right-5 w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-[#E5ECF6] flex items-center justify-center text-[#475569] hover:text-[#0B192C] cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="text-center pt-2 pb-4 sm:pb-5 space-y-2.5 sm:space-y-3">
              <div className="inline-flex items-center justify-center w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-[#EBF2FA] border-2 border-[#FFD166]/50 text-[#0B192C] shadow-md mx-auto">
                <Check className="w-7 h-7 sm:w-8 sm:h-8 text-[#13294B]" />
              </div>
              <div className="space-y-1">
                <span className="inline-block px-3 py-0.5 rounded-full bg-[#F4B441]/20 text-[#925800] text-[10px] sm:text-[11px] font-bold">
                  PRESTIGE CONSULTATION
                </span>
                <h3 className="text-lg sm:text-xl font-extrabold text-[#0F172A]">
                  상담 신청이 정상적으로 완료되었습니다!
                </h3>
                <p className="text-xs sm:text-sm text-[#475569]">
                  <strong className="text-[#0B192C] font-bold">{modalInfo.name}</strong> 고객님의 1:1 전담 수석 자산관리사가 배정되었습니다.
                </p>
              </div>
            </div>

            <div className="bg-[#EEF3FA] rounded-2xl p-4 sm:p-5 border border-[#CBD5E1]/40 space-y-3 mb-4 sm:mb-5">
              <div className="flex items-center justify-between gap-2 pb-2.5 sm:pb-3 border-b border-[#CBD5E1]/30">
                <span className="text-xs font-bold text-[#475569]">신청 접수 번호</span>
                <span className="text-xs font-bold text-[#0B192C] font-mono">
                  {modalInfo.regCode}
                </span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-[#475569] flex items-center gap-1.5 shrink-0">
                  <Landmark className="w-4 h-4 text-[#925800]" />
                  <span>선택 플랜</span>
                </span>
                <span className="text-xs sm:text-sm font-bold text-[#0F172A] text-right">
                  {modalInfo.periodText} / {modalInfo.amountText}
                </span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-[#475569] flex items-center gap-1.5 shrink-0">
                  <Smartphone className="w-4 h-4 text-[#925800]" />
                  <span>신청 연락처</span>
                </span>
                <span className="text-xs sm:text-sm font-bold text-[#0F172A] font-mono">
                  {modalInfo.phone}
                </span>
              </div>
              <div className="flex items-start justify-between gap-3 pt-1">
                <span className="text-xs text-[#475569] flex items-center gap-1.5 shrink-0 mt-0.5">
                  <Star className="w-4 h-4 text-[#FFD166] fill-[#FFD166]" />
                  <span>제공 예정 혜택</span>
                </span>
                <span className="text-[11px] sm:text-xs text-right font-semibold text-[#0B192C]">
                  전 금융사 5·7년 환급률 비교 리포트 + 비과세 세무 분석 무료 제공
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2.5 bg-[#EBF2FA] text-[#0B192C] p-3 sm:p-3.5 rounded-xl border border-[#BDD4F2] mb-5 sm:mb-6 text-[11px] sm:text-xs">
              <MessageCircle className="w-4 h-4 text-[#13294B] shrink-0" />
              <span>
                기재해주신 연락처로 <strong>10분 이내</strong>에 카카오톡 알림톡 및 맞춤 리포트가 발송될 예정입니다.
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
              <button
                type="button"
                onClick={() => {
                  setModalInfo(null);
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                className="w-full py-3 sm:py-3.5 px-3 sm:px-4 rounded-full border border-[#CBD5E1]/60 hover:bg-[#E5ECF6] text-xs font-bold text-[#0F172A] transition-colors cursor-pointer"
              >
                홈으로 이동
              </button>
              <button
                type="button"
                onClick={() => setModalInfo(null)}
                className="w-full py-3 sm:py-3.5 px-3 sm:px-4 rounded-full bg-[#F4B441] hover:bg-[#D99B26] text-[#0B192C] text-xs font-bold shadow-md transition-colors cursor-pointer"
              >
                확인
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 11. Admin Consultation DB Management Modal */}
      <AdminConsultationsModal
        open={adminModalOpen}
        onClose={() => setAdminModalOpen(false)}
      />

      {/* 12. Immediate Entry Lead-Capture Card Modal */}
      <WelcomeConsultModal
        open={welcomeCardOpen}
        initialPeriod={selectedPeriod}
        initialAmount={selectedAmount}
        onClose={() => setWelcomeCardOpen(false)}
        onHideToday={() => {
          try {
            localStorage.setItem(
              'bohumplus_welcome_hide_date',
              new Date().toISOString().slice(0, 10)
            );
          } catch {
            // ignore storage errors
          }
          setWelcomeCardOpen(false);
        }}
        onSuccess={(info) => setModalInfo(info)}
      />

      {/* Floating Reopen Lead Card Trigger (visible when welcome card is closed) */}
      {!welcomeCardOpen && !modalInfo && !adminModalOpen && (
        <button
          type="button"
          onClick={() => setWelcomeCardOpen(true)}
          className="fixed bottom-4 right-4 sm:bottom-5 sm:right-5 z-40 inline-flex items-center gap-1.5 sm:gap-2 px-3.5 sm:px-4 py-2.5 sm:py-3 rounded-full bg-[#0B192C] hover:bg-[#13294B] text-white border border-[#FFD166]/60 shadow-2xl text-[11px] sm:text-xs font-bold transition-transform hover:scale-105 cursor-pointer whitespace-nowrap"
        >
          <Sparkles className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#FFD166]" />
          <span>1분 빠른 환급금 신청</span>
        </button>
      )}
    </div>
  );
}
