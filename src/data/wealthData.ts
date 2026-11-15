export type PlanPeriod = 5 | 7;
export type TaxRateOption = 0.154 | 0.264 | 0.495;

export interface MatrixRow {
  amount: number; // 만원 단위
  label: string;
  months: number;
  principal: number;
  payoffValue: number;
  tenYearValue: number;
  fifteenYearValue: number;
  profit10Y: number;
  taxSaved154: number;
  isBest?: boolean;
}

export interface YearlyPoint {
  year: number;
  plan5Rate: number;
  plan7Rate: number;
  legacy20Rate: number;
  plan5Value: number;
  plan7Value: number;
  legacy20Value: number;
  paidPrincipal5: number;
  paidPrincipal7: number;
  paidPrincipal20: number;
}

export interface ClientRecord {
  id: string;
  sourceType: 'verified_review' | 'live_lead';
  name: string;
  age: number;
  region: string;
  occupation: string;
  planPeriod: PlanPeriod;
  monthlyAmount: number; // 만원
  tenYearValue: number; // 만원
  statusLabel: string;
  timeLabel: string;
  quote?: string;
  rating?: number;
}

export interface DesignToken {
  name: string;
  hex: string;
  role: string;
  category: 'emerald' | 'gold' | 'neutral' | 'semantic';
}

export interface SourceSectionAudit {
  order: string;
  sectionId: string;
  title: string;
  role: string;
  keyMetric: string;
  auditNote: string;
}

// code_2880f903.html의 시뮬레이터 및 매트릭스 공식 수치 기반 프리셋
const PRESET_FIVE_YEAR: Record<number, { payoff: number; tenYear: number; tax154: number }> = {
  10: { payoff: 597, tenYear: 722, tax154: 18.8 },
  30: { payoff: 1791, tenYear: 2167, tax154: 56.5 },
  50: { payoff: 2985, tenYear: 3612, tax154: 94.2 },
  100: { payoff: 5970, tenYear: 7224, tax154: 188.5 },
  150: { payoff: 8955, tenYear: 10836, tax154: 282.7 },
  200: { payoff: 11940, tenYear: 14448, tax154: 377.0 },
};

const PRESET_SEVEN_YEAR: Record<number, { payoff: number; tenYear: number; tax154: number }> = {
  10: { payoff: 840, tenYear: 1029, tax154: 29.1 },
  30: { payoff: 2520, tenYear: 3087, tax154: 87.3 },
  50: { payoff: 4200, tenYear: 5145, tax154: 145.5 },
  100: { payoff: 8400, tenYear: 10290, tax154: 291.1 },
  150: { payoff: 12600, tenYear: 15435, tax154: 436.6 },
  200: { payoff: 16800, tenYear: 20580, tax154: 582.1 },
};

export function formatKoreanMoney(amountInTenThousands: number, compact = false): string {
  const rounded = Math.round(amountInTenThousands * 10) / 10;
  if (rounded >= 10000) {
    const eok = Math.floor(rounded / 10000);
    const remainder = Math.round((rounded % 10000) * 10) / 10;
    if (remainder === 0) {
      return `${eok}억원`;
    }
    return compact
      ? `${eok}억 ${Math.round(remainder).toLocaleString()}만`
      : `${eok}억 ${remainder.toLocaleString()}만원`;
  }
  return compact ? `${rounded.toLocaleString()}만` : `${rounded.toLocaleString()}만원`;
}

export function calculatePlanProjection(
  period: PlanPeriod,
  monthlyAmount: number,
  taxRate: TaxRateOption = 0.154
) {
  const months = period * 12;
  const totalPrincipal = monthlyAmount * months;
  const payoffRate = period === 5 ? 0.995 : 1.0;
  const tenYearRate = period === 5 ? 1.204 : 1.225;
  const fifteenYearRate = period === 5 ? 1.318 : 1.352;

  const preset = period === 5 ? PRESET_FIVE_YEAR[monthlyAmount] : PRESET_SEVEN_YEAR[monthlyAmount];

  const payoffValue = preset ? preset.payoff : Math.round(totalPrincipal * payoffRate);
  const tenYearValue = preset ? preset.tenYear : Math.round(totalPrincipal * tenYearRate);
  const fifteenYearValue = Math.round(totalPrincipal * fifteenYearRate);
  const netProfit10Y = Math.round((tenYearValue - totalPrincipal) * 10) / 10;

  const taxSaved =
    preset && taxRate === 0.154
      ? preset.tax154
      : Math.round(netProfit10Y * taxRate * 10) / 10;

  // 일반 과세 예금으로 동일 세후 수익을 얻기 위해 필요한 세전 이자율 역산
  const effectiveAfterTaxReturnPct = ((tenYearValue - totalPrincipal) / totalPrincipal) * 100;
  const requiredPreTaxBankEquivalentPct =
    Math.round((effectiveAfterTaxReturnPct / (1 - taxRate)) * 10) / 10;

  // 연평균 단리/복리 환산 수익률 (10년 기준)
  const annualizedAfterTaxCagr =
    Math.round((Math.pow(tenYearValue / totalPrincipal, 1 / 10) - 1) * 1000) / 10;

  return {
    period,
    months,
    monthlyAmount,
    totalPrincipal,
    payoffRatePct: period === 5 ? 99.5 : 100.0,
    tenYearRatePct: period === 5 ? 120.4 : 122.5,
    fifteenYearRatePct: period === 5 ? 131.8 : 135.2,
    payoffValue,
    tenYearValue,
    fifteenYearValue,
    netProfit10Y,
    taxSaved,
    requiredPreTaxBankEquivalentPct,
    annualizedAfterTaxCagr,
  };
}

export interface RetirementPoint {
  age: number;
  yearsElapsed: number;
  taxFreeValue: number;
  taxableValue: number;
  paidPrincipal: number;
}

export interface RetirementProjection {
  currentAge: number;
  retirementAge: number;
  yearsToRetirement: number;
  targetFundGoal: number;
  projectedRetirementFund: number;
  projectedTaxableFund: number;
  cumulativeTaxAdvantageAtRetirement: number;
  readinessPct: number;
  fundingGap: number; // positive = shortfall, negative/0 = surplus
  monthlyDrawdown20Y: number;
  tenYearContributionPct: number;
  timeline: RetirementPoint[];
}

export function calculateRetirementProjection(
  period: PlanPeriod,
  monthlyAmount: number,
  taxRate: TaxRateOption,
  currentAge: number,
  retirementAge: number,
  targetFundGoal: number
): RetirementProjection {
  const safeRetireAge = Math.max(currentAge + 5, retirementAge);
  const yearsToRetirement = safeRetireAge - currentAge;
  const baseProj = calculatePlanProjection(period, monthlyAmount, taxRate);

  // 10년 이후 거치 시 연평균 비과세 복리 성장률 (10Y -> 15Y 구간 표준율 기반: 5년납 ~1.83%/yr, 7년납 ~1.99%/yr, 장기 유지 보너스 반영 2.35% / 2.55%)
  const post10YAnnualRate = period === 5 ? 0.0235 : 0.0255;
  const rateCurve = period === 5 ? RATE_CURVE_5Y : RATE_CURVE_7Y;

  const timeline: RetirementPoint[] = [];

  for (let y = 0; y <= yearsToRetirement; y++) {
    const age = currentAge + y;
    const paidMonths = Math.min(y, period) * 12;
    const paidPrincipal = monthlyAmount * paidMonths;

    let taxFreeValue = 0;
    if (y === 0) {
      taxFreeValue = 0;
    } else if (y <= 15) {
      // 1~15년 구간은 표준 환급률 곡선과 정밀 10년/15년 프리셋 보간 사용
      if (y === 10) {
        taxFreeValue = baseProj.tenYearValue;
      } else if (y === period) {
        taxFreeValue = baseProj.payoffValue;
      } else {
        const rate = rateCurve[y - 1];
        taxFreeValue = Math.round((paidPrincipal * rate) / 100);
      }
    } else {
      const yearsPast15 = y - 15;
      taxFreeValue = Math.round(
        baseProj.fifteenYearValue * Math.pow(1 + post10YAnnualRate, yearsPast15)
      );
    }

    // 동일 세전 수익 구조의 일반 과세 상품 대비 세후 가치 계산
    const grossGain = Math.max(0, taxFreeValue - paidPrincipal);
    const taxableValue = Math.round(paidPrincipal + grossGain * (1 - taxRate));

    timeline.push({
      age,
      yearsElapsed: y,
      taxFreeValue,
      taxableValue,
      paidPrincipal,
    });
  }

  const finalPoint = timeline[timeline.length - 1];
  const projectedRetirementFund = finalPoint ? finalPoint.taxFreeValue : 0;
  const projectedTaxableFund = finalPoint ? finalPoint.taxableValue : 0;
  const cumulativeTaxAdvantageAtRetirement = Math.max(
    0,
    projectedRetirementFund - projectedTaxableFund
  );

  const readinessPct =
    targetFundGoal > 0 ? Math.round((projectedRetirementFund / targetFundGoal) * 1000) / 10 : 0;
  const fundingGap = Math.max(0, targetFundGoal - projectedRetirementFund);
  const monthlyDrawdown20Y = Math.round((projectedRetirementFund / 240) * 10) / 10;
  const tenYearContributionPct =
    targetFundGoal > 0 ? Math.round((baseProj.tenYearValue / targetFundGoal) * 1000) / 10 : 0;

  return {
    currentAge,
    retirementAge: safeRetireAge,
    yearsToRetirement,
    targetFundGoal,
    projectedRetirementFund,
    projectedTaxableFund,
    cumulativeTaxAdvantageAtRetirement,
    readinessPct,
    fundingGap,
    monthlyDrawdown20Y,
    tenYearContributionPct,
    timeline,
  };
}

export const MATRIX_AMOUNTS = [10, 30, 50, 100, 150, 200] as const;

export function getMatrixRows(period: PlanPeriod): MatrixRow[] {
  return MATRIX_AMOUNTS.map((amt) => {
    const p = calculatePlanProjection(period, amt, 0.154);
    return {
      amount: amt,
      label: `월 ${amt}만원`,
      months: p.months,
      principal: p.totalPrincipal,
      payoffValue: p.payoffValue,
      tenYearValue: p.tenYearValue,
      fifteenYearValue: p.fifteenYearValue,
      profit10Y: p.netProfit10Y,
      taxSaved154: p.taxSaved,
      isBest: amt === 50,
    };
  });
}

// 연차별(1~15년) 해약환급률 곡선 (단기납 5년, 단기납 7년 vs 기존 20년 장기 종신)
const RATE_CURVE_5Y = [46.2, 58.4, 71.0, 84.5, 99.5, 102.8, 106.5, 110.8, 115.4, 120.4, 122.6, 124.9, 127.2, 129.5, 131.8];
const RATE_CURVE_7Y = [42.0, 53.5, 65.2, 75.8, 85.4, 93.2, 100.0, 106.8, 114.2, 122.5, 125.0, 127.5, 130.1, 132.6, 135.2];
const RATE_CURVE_20Y = [24.0, 34.5, 42.8, 49.6, 56.2, 62.1, 67.4, 72.0, 76.5, 80.8, 84.6, 88.2, 91.5, 94.7, 97.6];

export function buildYearlyCurve(monthlyAmount: number): YearlyPoint[] {
  return Array.from({ length: 15 }, (_, idx) => {
    const year = idx + 1;
    const paidMonths5 = Math.min(year, 5) * 12;
    const paidMonths7 = Math.min(year, 7) * 12;
    const paidMonths20 = year * 12;

    const paidPrincipal5 = monthlyAmount * paidMonths5;
    const paidPrincipal7 = monthlyAmount * paidMonths7;
    const paidPrincipal20 = monthlyAmount * paidMonths20;

    const plan5Rate = RATE_CURVE_5Y[idx];
    const plan7Rate = RATE_CURVE_7Y[idx];
    const legacy20Rate = RATE_CURVE_20Y[idx];

    return {
      year,
      plan5Rate,
      plan7Rate,
      legacy20Rate,
      plan5Value: Math.round((paidPrincipal5 * plan5Rate) / 100),
      plan7Value: Math.round((paidPrincipal7 * plan7Rate) / 100),
      legacy20Value: Math.round((paidPrincipal20 * legacy20Rate) / 100),
      paidPrincipal5,
      paidPrincipal7,
      paidPrincipal20,
    };
  });
}

// code_2880f903.html에서 추출한 실제 고객 후기 8건 + 실시간 상담 접수 8건 (총 16건 분석용 데이터셋)
export const INITIAL_CLIENT_RECORDS: ClientRecord[] = [
  {
    id: 'REV-01',
    sourceType: 'verified_review',
    name: '김*호',
    age: 38,
    region: '서울특별시',
    occupation: 'IT기업 개발팀장',
    planPeriod: 5,
    monthlyAmount: 50,
    tenYearValue: 3612,
    statusLabel: '가입 확정 (만족도 5.0)',
    timeLabel: '인증 가입 고객',
    rating: 5,
    quote: '과거 20년 종신 3년 만에 해지 손실 경험 후, 5년 완납 99.5% 회복 및 10년 120.4% 비과세 구조로 전환.',
  },
  {
    id: 'REV-02',
    sourceType: 'verified_review',
    name: '이*정',
    age: 45,
    region: '서울특별시',
    occupation: '개인사업자 대표',
    planPeriod: 7,
    monthlyAmount: 100,
    tenYearValue: 10290,
    statusLabel: '가입 확정 (만족도 5.0)',
    timeLabel: '인증 가입 고객',
    rating: 5,
    quote: '7년 완납 시점 8,400만원 100% 회복, 10년 1억 290만원 달성으로 비과세 절세 291만원 확보.',
  },
  {
    id: 'REV-03',
    sourceType: 'verified_review',
    name: '박*철',
    age: 52,
    region: '경기도 / 인천',
    occupation: '대기업 총괄부장',
    planPeriod: 5,
    monthlyAmount: 200,
    tenYearValue: 14448,
    statusLabel: '가입 확정 (만족도 5.0)',
    timeLabel: '인증 가입 고객',
    rating: 5,
    quote: '은퇴 전 남은 5년 소득 구간 집중 완납 후 환갑 시점 1억 4,448만원 노후 목돈 + 보장 동시 구축.',
  },
  {
    id: 'REV-04',
    sourceType: 'verified_review',
    name: '정*훈',
    age: 43,
    region: '서울특별시',
    occupation: '치과의원 원장',
    planPeriod: 7,
    monthlyAmount: 200,
    tenYearValue: 20580,
    statusLabel: '가입 확정 (만족도 5.0)',
    timeLabel: '인증 가입 고객',
    rating: 5,
    quote: '고소득 종합과세 방어를 위해 7년납 200만원 선택, 10년 시점 2억 580만원 비과세 파킹.',
  },
  {
    id: 'REV-05',
    sourceType: 'verified_review',
    name: '최*은',
    age: 33,
    region: '대전 / 세종 / 충청',
    occupation: '신혼부부 공무원',
    planPeriod: 5,
    monthlyAmount: 30,
    tenYearValue: 2167,
    statusLabel: '가입 확정 (만족도 5.0)',
    timeLabel: '인증 가입 고객',
    rating: 5,
    quote: '출산 전 5년 저축으로 원금 회복 후 10년 뒤 2,167만원 내 집 마련 디딤돌 종잣돈 마련.',
  },
  {
    id: 'REV-06',
    sourceType: 'verified_review',
    name: '강*석',
    age: 56,
    region: '부산 / 울산 / 경남',
    occupation: '대학교수',
    planPeriod: 5,
    monthlyAmount: 150,
    tenYearValue: 10836,
    statusLabel: '가입 확정 (만족도 5.0)',
    timeLabel: '인증 가입 고객',
    rating: 5,
    quote: '정년퇴직 5년 앞둔 시점에서 퇴직 시점 완납 및 10년 1억 836만원 확정 복리 구조 채택.',
  },
  {
    id: 'REV-07',
    sourceType: 'verified_review',
    name: '윤*진',
    age: 47,
    region: '대구 / 경북',
    occupation: '학원장',
    planPeriod: 5,
    monthlyAmount: 100,
    tenYearValue: 7224,
    statusLabel: '가입 확정 (만족도 5.0)',
    timeLabel: '인증 가입 고객',
    rating: 5,
    quote: '변동금리 예적금 대안으로 5년 완납 원금 보존 및 10년 7,224만원 확정 복리 자금 방어벽 구축.',
  },
  {
    id: 'REV-08',
    sourceType: 'verified_review',
    name: '송*우',
    age: 35,
    region: '서울특별시',
    occupation: '프리랜서 디자이너',
    planPeriod: 7,
    monthlyAmount: 50,
    tenYearValue: 5145,
    statusLabel: '가입 확정 (만족도 5.0)',
    timeLabel: '인증 가입 고객',
    rating: 5,
    quote: '불규칙한 수입 환경에서 7년 완납 100% 회복 및 중도인출 유연성 기반 비과세 통장 운용.',
  },
  {
    id: 'LEAD-01',
    sourceType: 'live_lead',
    name: '김*수',
    age: 42,
    region: '서울특별시',
    occupation: '서울 강남구 신청',
    planPeriod: 5,
    monthlyAmount: 50,
    tenYearValue: 3612,
    statusLabel: '상담사 배정 완료',
    timeLabel: '방금 접수',
  },
  {
    id: 'LEAD-02',
    sourceType: 'live_lead',
    name: '박*민',
    age: 36,
    region: '경기도 / 인천',
    occupation: '경기 성남시 신청',
    planPeriod: 7,
    monthlyAmount: 30,
    tenYearValue: 3087,
    statusLabel: '심사 리포트 발송',
    timeLabel: '2분 전',
  },
  {
    id: 'LEAD-03',
    sourceType: 'live_lead',
    name: '최*호',
    age: 49,
    region: '부산 / 울산 / 경남',
    occupation: '부산 해운대구 신청',
    planPeriod: 5,
    monthlyAmount: 100,
    tenYearValue: 7224,
    statusLabel: '상담사 배정 완료',
    timeLabel: '5분 전',
  },
  {
    id: 'LEAD-04',
    sourceType: 'live_lead',
    name: '정*영',
    age: 45,
    region: '대구 / 경북',
    occupation: '대구 수성구 신청',
    planPeriod: 7,
    monthlyAmount: 100,
    tenYearValue: 10290,
    statusLabel: '비과세 분석 대기',
    timeLabel: '8분 전',
  },
  {
    id: 'LEAD-05',
    sourceType: 'live_lead',
    name: '윤*진',
    age: 39,
    region: '경기도 / 인천',
    occupation: '인천 연수구 신청',
    planPeriod: 5,
    monthlyAmount: 50,
    tenYearValue: 3612,
    statusLabel: '상담사 배정 완료',
    timeLabel: '11분 전',
  },
  {
    id: 'LEAD-06',
    sourceType: 'live_lead',
    name: '한*우',
    age: 53,
    region: '대전 / 세종 / 충청',
    occupation: '대전 유성구 신청',
    planPeriod: 5,
    monthlyAmount: 200,
    tenYearValue: 14448,
    statusLabel: 'VIP 전담 배정',
    timeLabel: '14분 전',
  },
  {
    id: 'LEAD-07',
    sourceType: 'live_lead',
    name: '송*경',
    age: 47,
    region: '광주 / 전라',
    occupation: '광주 서구 신청',
    planPeriod: 7,
    monthlyAmount: 50,
    tenYearValue: 5145,
    statusLabel: '비교표 발송 완료',
    timeLabel: '17분 전',
  },
  {
    id: 'LEAD-08',
    sourceType: 'live_lead',
    name: '강*원',
    age: 34,
    region: '부산 / 울산 / 경남',
    occupation: '울산 남구 신청',
    planPeriod: 5,
    monthlyAmount: 30,
    tenYearValue: 2167,
    statusLabel: '접수 확인 중',
    timeLabel: '21분 전',
  },
];

export const CORE_PRIVILEGES = [
  {
    index: '01',
    title: '5·7년 완납의 압도적 자유',
    summary: '20년(240개월) 장기 납입 리스크를 60~84개월로 단축하여 소득 전성기 내 완납 종결',
    metric: '납입기간 65%~75% 단축',
  },
  {
    index: '02',
    title: '15.4% 이자소득세 전액 비과세',
    summary: '소득세법 시행령 제25조 요건 충족 시 이자소득세 면제 및 금융소득종합과세 제외',
    metric: '세금 0원 (15.4% 절세)',
  },
  {
    index: '03',
    title: '유연한 중도인출 & 추가납입',
    summary: '긴급 자금 필요 시 해약 없이 중도인출 가능, 여유 자금 추가납입으로 복리 수익 극대화',
    metric: '유동성 + 복리 병행',
  },
  {
    index: '04',
    title: '평생 종신보장 결합',
    summary: '단기 목적자금 증식과 동시에 유고 시 가족을 보호하는 평생 사망보장 안전망 제공',
    metric: '0세 ~ 70세 가입 가능',
  },
];

export const DESIGN_TOKENS: DesignToken[] = [
  { name: 'emerald-deep', hex: '#06281B', role: '주 권위 배경 · 사이드바 · 다크 카드 기반', category: 'emerald' },
  { name: 'emerald-container', hex: '#063B2B', role: '프라이머리 컨테이너 · 강조 섹션 배지', category: 'emerald' },
  { name: 'emerald-surface', hex: '#0B4635', role: '다크 내포 서피스 · 호버 보더 · 아이콘 하우징', category: 'emerald' },
  { name: 'emerald-mint-subtle', hex: '#EAF6EF', role: '긍정 수익 셀 · 비과세 강조 하이라이트', category: 'emerald' },
  { name: 'gold-bright', hex: '#FFC93C', role: '핵심 수익률(120.4%) · 다크 배경 주요 강조', category: 'gold' },
  { name: 'secondary-container', hex: '#FEAE2C', role: '주 전환 CTA 버튼 배경 · 핵심 액션', category: 'gold' },
  { name: 'gold-hover', hex: '#E09419', role: 'CTA 버튼 호버 상태 · 인터랙션 피드백', category: 'gold' },
  { name: 'secondary', hex: '#835500', role: '라이트 배경 내 골드 수치 및 섹션 라벨', category: 'gold' },
  { name: 'parchment-base', hex: '#FBF9F4', role: '메인 캔버스 바탕 · 따뜻한 자산문서 톤', category: 'neutral' },
  { name: 'surface-pure', hex: '#FFFFFF', role: '데이터 카드 · 테이블 · 입력 폼 컨테이너', category: 'neutral' },
  { name: 'text-on-light-primary', hex: '#111814', role: '기본 본문 및 지표 제목', category: 'neutral' },
  { name: 'text-on-light-secondary', hex: '#58655E', role: '보조 설명 · 테이블 보조 메타데이터', category: 'neutral' },
  { name: 'accent-red-alert', hex: '#D9383A', role: '절세 강조 · 기존 20년납 해지 손실 경고', category: 'semantic' },
];

export const SOURCE_SECTIONS_AUDIT: SourceSectionAudit[] = [
  {
    order: '01',
    sectionId: 'TopNavBar',
    title: '상단 내비게이션 바',
    role: '솔루션·시뮬레이터·매트릭스·비교·후기 앵커 이동 및 상담 CTA',
    keyMetric: '고정 높이 80px · 5개 앵커',
    auditNote: '브랜드 옆 PRESTIGE 배지는 대시보드 전환 시 단일 워드마크 계약으로 정제 권장',
  },
  {
    order: '02',
    sectionId: 'Hero',
    title: '2컬럼 프레스티지 히어로',
    role: '5·7년 집중납입 & 10년 최대 120.4% 비과세 핵심 가치 제안',
    keyMetric: '가입연령 0~70세 · 10년 120.4%',
    auditNote: '우측 이미지 위 플로팅 카드 2종(원금회복 100%, 120.4%)으로 시각적 신뢰 즉시 확보',
  },
  {
    order: '03',
    sectionId: 'Comparison',
    title: '기존 20년 vs 단기납 비교',
    role: '기존 20년납 유지율 52.28% 문제점과 단기납 해법 대조',
    keyMetric: '완납률 52.28% vs 단기 집중 완납',
    auditNote: '경제지 기획보도 티커와 인접 배치하여 손실 회피 심리 자극',
  },
  {
    order: '04',
    sectionId: 'Simulator',
    title: '실시간 환급률 시뮬레이터',
    role: '5년/7년 및 월 10~200만원 선택 시 예상 환급금·절세액 즉시 계산',
    keyMetric: '월 50만원(5년) → 3,612만원',
    auditNote: '하단 상담 폼 및 매트릭스 테이블과 양방향 동기화(Dual Synchronizer) 구현됨',
  },
  {
    order: '05',
    sectionId: 'Matrix',
    title: '구간별 상세 환급 매트릭스',
    role: '5년납(120.4%) / 7년납(122.5%) 탭 전환 기반 5개 금액 구간 비교표',
    keyMetric: '10만원 ~ 200만원 전체 공개',
    auditNote: '표 내 150만원 구간 행 추가 및 CSV 내보내기 기능 추가 시 분석 활용도 상승',
  },
  {
    order: '06',
    sectionId: 'Solution',
    title: '4대 핵심 특권 & 추천 고객군',
    role: '비과세(15.4%)·중도인출·종신보장 및 3대 타깃 페르소나 제시',
    keyMetric: '4대 특권 · 3대 페르소나',
    auditNote: '다크 에메랄드(#06281B) 배경 전환으로 시선 리듬과 권위감 강화',
  },
  {
    order: '07',
    sectionId: 'Reviews',
    title: '실제 가입 고객 만족 후기',
    role: '8명의 직종·연령·납입플랜별 구체적 수령액 후기 마퀴 슬라이더',
    keyMetric: '평점 4.9 / 5.0 (2,840명)',
    auditNote: '마퀴 애니메이션 외 세그먼트 필터링 가능한 표 형태로 대시보드화 완료',
  },
  {
    order: '08',
    sectionId: 'Contact & Ticker',
    title: '실시간 접수 현황 & 상담 신청 폼',
    role: '오늘 142명 실시간 접수 티커 + 7개 입력 필드 기반 리드 캡처',
    keyMetric: '일일 누적 142명 접수',
    auditNote: '성함/연락처/생년월일/지역/기간/금액을 시뮬레이터 상태와 자동 연동',
  },
];

export function exportMatrixToCsv(period: PlanPeriod) {
  const rows = getMatrixRows(period);
  const headers = [
    '납입플랜',
    '월 납입금액(만원)',
    '납입횟수(회)',
    '총 납입원금(만원)',
    '완납시점 환급금(만원)',
    '10년시점 환급금(만원)',
    '15년시점 환급금(만원)',
    '10년 순수복리수익(만원)',
    '비과세 절세액 15.4%(만원)',
  ];
  const csvLines = [
    headers.join(','),
    ...rows.map((r) =>
      [
        `${period}년납`,
        r.amount,
        r.months,
        r.principal,
        r.payoffValue,
        r.tenYearValue,
        r.fifteenYearValue,
        r.profit10Y,
        r.taxSaved154,
      ].join(',')
    ),
  ];

  const bom = '\uFEFF';
  const blob = new Blob([bom + csvLines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `단기납_자산케어_${period}년납_환급분석표.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
