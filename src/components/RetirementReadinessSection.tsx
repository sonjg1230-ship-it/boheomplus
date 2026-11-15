import React, { useMemo, useState } from 'react';
import {
  PlanPeriod,
  TaxRateOption,
  calculatePlanProjection,
  calculateRetirementProjection,
  formatKoreanMoney,
} from '../data/wealthData';
import { ArrowRight, CheckCircle2, Compass, ShieldCheck, TrendingUp } from 'lucide-react';

interface RetirementReadinessSectionProps {
  selectedPeriod: PlanPeriod;
  monthlyAmount: number;
  taxRate: TaxRateOption;
  onSelectPeriod: (period: PlanPeriod) => void;
  onChangeMonthlyAmount: (amount: number) => void;
}

const GOAL_PRESETS = [
  { label: '1억원', value: 10000 },
  { label: '3억원', value: 30000 },
  { label: '5억원', value: 50000 },
  { label: '10억원', value: 100000 },
] as const;

export const RetirementReadinessSection: React.FC<RetirementReadinessSectionProps> = ({
  selectedPeriod,
  monthlyAmount,
  taxRate,
  onSelectPeriod,
  onChangeMonthlyAmount,
}) => {
  const [currentAge, setCurrentAge] = useState<number>(40);
  const [retirementAge, setRetirementAge] = useState<number>(65);
  const [targetGoal, setTargetGoal] = useState<number>(30000);
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  const baseProj = useMemo(
    () => calculatePlanProjection(selectedPeriod, monthlyAmount, taxRate),
    [selectedPeriod, monthlyAmount, taxRate]
  );

  const retirementProj = useMemo(
    () =>
      calculateRetirementProjection(
        selectedPeriod,
        monthlyAmount,
        taxRate,
        currentAge,
        Math.max(currentAge + 5, retirementAge),
        targetGoal
      ),
    [selectedPeriod, monthlyAmount, taxRate, currentAge, retirementAge, targetGoal]
  );

  const suggestedMonthlyForGoal = useMemo(() => {
    if (retirementProj.projectedRetirementFund <= 0) return monthlyAmount;
    const rawNeeded =
      Math.ceil((monthlyAmount * (targetGoal / retirementProj.projectedRetirementFund)) / 10) *
      10;
    return Math.min(200, Math.max(10, rawNeeded));
  }, [monthlyAmount, targetGoal, retirementProj.projectedRetirementFund]);

  const timeline = retirementProj.timeline;
  const chartW = 700;
  const chartH = 270;
  const pad = { top: 22, right: 20, bottom: 34, left: 60 };
  const plotW = chartW - pad.left - pad.right;
  const plotH = chartH - pad.top - pad.bottom;

  const maxY = Math.max(
    targetGoal * 1.12,
    retirementProj.projectedRetirementFund * 1.12,
    1000
  );

  const xForIdx = (idx: number) =>
    timeline.length <= 1 ? pad.left : pad.left + (idx / (timeline.length - 1)) * plotW;
  const yForVal = (val: number) => pad.top + plotH - (val / maxY) * plotH;

  const taxFreePath = timeline
    .map((pt, idx) => `${idx === 0 ? 'M' : 'L'} ${xForIdx(idx).toFixed(1)} ${yForVal(pt.taxFreeValue).toFixed(1)}`)
    .join(' ');

  const taxFreeAreaPath = `${taxFreePath} L ${xForIdx(timeline.length - 1).toFixed(1)} ${(
    pad.top + plotH
  ).toFixed(1)} L ${xForIdx(0).toFixed(1)} ${(pad.top + plotH).toFixed(1)} Z`;

  const taxablePath = timeline
    .map((pt, idx) => `${idx === 0 ? 'M' : 'L'} ${xForIdx(idx).toFixed(1)} ${yForVal(pt.taxableValue).toFixed(1)}`)
    .join(' ');

  const goalY = yForVal(targetGoal);
  const clampedReadiness = Math.min(100, retirementProj.readinessPct);

  const activePoint =
    hoverIdx !== null && timeline[hoverIdx]
      ? timeline[hoverIdx]
      : timeline[timeline.length - 1];

  const handleCurrentAgeChange = (val: number) => {
    setCurrentAge(val);
    if (retirementAge < val + 10) {
      setRetirementAge(Math.min(75, val + 10));
    }
  };

  return (
    <section
      className="py-16 sm:py-20 lg:py-24 bg-[#EEF3FA] border-t border-[#CBD5E1]/60"
      id="retirement"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-10 sm:mb-12 space-y-3">
          <span className="text-[#925800] text-xs sm:text-sm font-bold uppercase tracking-wider block">
            RETIREMENT READINESS
          </span>
          <h2 className="text-2xl sm:text-[36px] lg:text-[40px] font-extrabold text-[#0F172A] tracking-tight leading-tight">
            단기 집중납입이 만드는 장기 은퇴 준비도
          </h2>
          <p className="text-sm sm:text-base text-[#475569]">
            현재 시뮬레이션 중인{' '}
            <strong className="text-[#0B192C]">
              {selectedPeriod}년납 · 월 {monthlyAmount}만원
            </strong>{' '}
            플랜이 은퇴 목표 자금 달성에 얼마나 기여하는지 연령별로 시뮬레이션합니다.
          </p>
        </div>

        <div className="bg-white rounded-3xl p-4 sm:p-8 lg:p-10 shadow-xl border border-[#CBD5E1]/50">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-8 items-start">
            {/* Left Controls & Summary (5 cols) */}
            <div className="lg:col-span-5 space-y-5 sm:space-y-6">
              <div className="p-3.5 sm:p-4 rounded-2xl bg-[#F7F9FC] border border-[#CBD5E1] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <span className="text-[11px] font-bold text-[#475569] block">
                    시뮬레이터 연동 기준
                  </span>
                  <span className="text-sm font-extrabold text-[#0B192C] tabular-nums">
                    {selectedPeriod}년 납입 · 월 {monthlyAmount.toLocaleString()}만원
                  </span>
                </div>
                <div className="flex p-1 rounded-lg bg-[#E5ECF6] self-start sm:self-auto">
                  <button
                    type="button"
                    onClick={() => onSelectPeriod(5)}
                    className={`px-2.5 py-1 rounded-md text-xs font-bold transition-colors cursor-pointer whitespace-nowrap ${
                      selectedPeriod === 5 ? 'bg-[#0B192C] text-white' : 'text-[#475569]'
                    }`}
                  >
                    5년납
                  </button>
                  <button
                    type="button"
                    onClick={() => onSelectPeriod(7)}
                    className={`px-2.5 py-1 rounded-md text-xs font-bold transition-colors cursor-pointer whitespace-nowrap ${
                      selectedPeriod === 7 ? 'bg-[#0B192C] text-white' : 'text-[#475569]'
                    }`}
                  >
                    7년납
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-4 rounded-2xl border border-[#CBD5E1] bg-white">
                  <div className="flex items-center justify-between mb-2">
                    <label htmlFor="retireCurrentAge" className="text-xs font-bold text-[#0F172A]">
                      현재 연령
                    </label>
                    <span className="text-sm font-extrabold text-[#0B192C] font-mono tabular-nums">
                      {currentAge}세
                    </span>
                  </div>
                  <input
                    id="retireCurrentAge"
                    type="range"
                    min={20}
                    max={60}
                    step={1}
                    value={currentAge}
                    onChange={(e) => handleCurrentAgeChange(Number(e.target.value))}
                    className="w-full accent-[#0B192C] cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] text-[#475569] font-mono mt-1">
                    <span>20세</span>
                    <span>40세</span>
                    <span>60세</span>
                  </div>
                </div>

                <div className="p-4 rounded-2xl border border-[#CBD5E1] bg-white">
                  <div className="flex items-center justify-between mb-2">
                    <label htmlFor="retireTargetAge" className="text-xs font-bold text-[#0F172A]">
                      목표 은퇴 연령
                    </label>
                    <span className="text-sm font-extrabold text-[#925800] font-mono tabular-nums">
                      {retirementProj.retirementAge}세
                    </span>
                  </div>
                  <input
                    id="retireTargetAge"
                    type="range"
                    min={Math.min(70, currentAge + 10)}
                    max={75}
                    step={1}
                    value={retirementProj.retirementAge}
                    onChange={(e) => setRetirementAge(Number(e.target.value))}
                    className="w-full accent-[#D99B26] cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] text-[#475569] font-mono mt-1">
                    <span>{Math.min(70, currentAge + 10)}세</span>
                    <span>65세</span>
                    <span>75세</span>
                  </div>
                </div>
              </div>

              <div className="p-4 rounded-2xl border border-[#CBD5E1] bg-white space-y-3">
                <div className="flex items-center justify-between">
                  <label htmlFor="retireGoalRange" className="text-xs font-bold text-[#0F172A]">
                    목표 은퇴 자금 (총 필요 자산)
                  </label>
                  <span className="text-base font-extrabold text-[#0B192C] font-mono tabular-nums">
                    {formatKoreanMoney(targetGoal)}
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {GOAL_PRESETS.map((preset) => {
                    const active = targetGoal === preset.value;
                    return (
                      <button
                        key={preset.value}
                        type="button"
                        onClick={() => setTargetGoal(preset.value)}
                        className={`py-2 px-2 rounded-lg text-xs font-bold border transition-colors cursor-pointer whitespace-nowrap ${
                          active
                            ? 'bg-[#0B192C] text-white border-[#0B192C]'
                            : 'bg-[#F7F9FC] text-[#0F172A] border-[#CBD5E1] hover:border-[#0B192C]/40'
                        }`}
                      >
                        {preset.label}
                      </button>
                    );
                  })}
                </div>

                <input
                  id="retireGoalRange"
                  type="range"
                  min={5000}
                  max={100000}
                  step={1000}
                  value={targetGoal}
                  onChange={(e) => setTargetGoal(Number(e.target.value))}
                  className="w-full accent-[#0B192C] cursor-pointer"
                />
              </div>

              {/* Readiness Score & Progress Card */}
              <div className="p-5 sm:p-6 rounded-2xl bg-[#0B192C] text-white space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2.5 sm:gap-3">
                  <div>
                    <span className="text-xs font-bold text-[#BDD4F2] flex items-center gap-1.5">
                      <Compass className="w-4 h-4 text-[#FFD166] shrink-0" />
                      <span>은퇴 목표 달성 기여도 ({retirementProj.yearsToRetirement}년 후)</span>
                    </span>
                    <div className="mt-1.5 flex flex-wrap items-baseline gap-2">
                      <span className="text-3xl sm:text-4xl font-extrabold text-[#FFD166] font-mono tabular-nums tracking-tight">
                        {retirementProj.readinessPct.toFixed(1)}%
                      </span>
                      <span className="text-xs text-white/75 tabular-nums">
                        ({formatKoreanMoney(retirementProj.projectedRetirementFund)} 확보)
                      </span>
                    </div>
                  </div>
                  <span className="px-2.5 py-1 rounded-md bg-[#13294B] text-[#FFD166] text-[11px] font-bold whitespace-nowrap shrink-0">
                    {retirementProj.readinessPct >= 100 ? '목표 초과 달성' : '기초 자산 구축'}
                  </span>
                </div>

                <div>
                  <div className="h-3 w-full rounded-full bg-[#07111F] overflow-hidden border border-white/10">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-[#F4B441] to-[#FFD166] transition-all duration-300"
                      style={{ width: `${clampedReadiness}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-[11px] text-white/70 mt-1.5 tabular-nums">
                    <span>10년 확정 기여 ({retirementProj.tenYearContributionPct.toFixed(1)}%)</span>
                    <span>목표 {formatKoreanMoney(targetGoal)}</span>
                  </div>
                </div>

                {retirementProj.fundingGap > 0 ? (
                  <div className="pt-3 border-t border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="text-xs text-white/80 leading-relaxed">
                      목표까지 <strong className="text-[#FFD166]">{formatKoreanMoney(retirementProj.fundingGap)}</strong> 추가 준비가 필요합니다.
                      {suggestedMonthlyForGoal > monthlyAmount && (
                        <span className="block text-[11px] text-[#BDD4F2]">
                          월 {suggestedMonthlyForGoal}만원 플랜으로 상향 시 달성률이 크게 높아집니다.
                        </span>
                      )}
                    </div>
                    {suggestedMonthlyForGoal > monthlyAmount && (
                      <button
                        type="button"
                        onClick={() => onChangeMonthlyAmount(suggestedMonthlyForGoal)}
                        className="px-3.5 py-2 rounded-full bg-[#F4B441] hover:bg-[#D99B26] text-[#0B192C] text-xs font-bold inline-flex items-center gap-1 transition-colors cursor-pointer whitespace-nowrap shrink-0"
                      >
                        <span>월 {suggestedMonthlyForGoal}만원 적용</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="pt-3 border-t border-white/10 flex items-center gap-2 text-xs text-[#BDD4F2]">
                    <CheckCircle2 className="w-4 h-4 text-[#FFD166] shrink-0" />
                    <span>
                      단기 집중납입 플랜만으로 {retirementProj.retirementAge}세 목표 은퇴 자금을 100% 이상 달성합니다.
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Right Trajectory Chart & Retirement Metrics (7 cols) */}
            <div className="lg:col-span-7 space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="p-4 rounded-2xl bg-[#F7F9FC] border border-[#CBD5E1]">
                  <span className="text-[11px] font-bold text-[#475569] block">
                    {retirementProj.retirementAge}세 예상 비과세 자금
                  </span>
                  <span className="text-xl font-extrabold text-[#0B192C] font-mono tabular-nums mt-1 block">
                    {formatKoreanMoney(retirementProj.projectedRetirementFund)}
                  </span>
                  <span className="text-[11px] text-[#1D4ED8] mt-1 block">
                    원금 {formatKoreanMoney(baseProj.totalPrincipal)} 납입 후 거치
                  </span>
                </div>

                <div className="p-4 rounded-2xl bg-[#F7F9FC] border border-[#CBD5E1]">
                  <span className="text-[11px] font-bold text-[#475569] block">
                    은퇴 후 월 예상 수령액 (20년)
                  </span>
                  <span className="text-xl font-extrabold text-[#925800] font-mono tabular-nums mt-1 block">
                    월 {retirementProj.monthlyDrawdown20Y.toLocaleString()}만원
                  </span>
                  <span className="text-[11px] text-[#475569] mt-1 block">
                    240개월 비과세 연금형 인출 가정
                  </span>
                </div>

                <div className="p-4 rounded-2xl bg-[#EBF2FA] border border-[#1D4ED8]/20">
                  <span className="text-[11px] font-bold text-[#13294B] block">
                    은퇴 시점 누적 절세 효과
                  </span>
                  <span className="text-xl font-extrabold text-[#0B192C] font-mono tabular-nums mt-1 block">
                    +{formatKoreanMoney(retirementProj.cumulativeTaxAdvantageAtRetirement)}
                  </span>
                  <span className="text-[11px] text-[#1D4ED8] mt-1 block">
                    과세 {(taxRate * 100).toFixed(1)}% 상품 대비 추가 보전
                  </span>
                </div>
              </div>

              <div className="p-5 sm:p-6 rounded-2xl border border-[#CBD5E1] bg-white">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
                  <div>
                    <h3 className="text-base font-extrabold text-[#0F172A] flex items-center gap-1.5">
                      <TrendingUp className="w-4 h-4 text-[#1D4ED8]" />
                      <span>연령별 은퇴 자산 성장 경로 ({currentAge}세 ~ {retirementProj.retirementAge}세)</span>
                    </h3>
                    <p className="text-xs text-[#475569] mt-0.5">
                      {selectedPeriod}년 완납 후 추가 납입 없이 비과세 복리로 거치되는 장기 자산 궤적
                    </p>
                  </div>
                  <div className="flex items-center gap-3 text-[11px] font-bold">
                    <span className="inline-flex items-center gap-1.5 text-[#0B192C]">
                      <span className="w-2.5 h-2.5 rounded-sm bg-[#1D4ED8]" />
                      <span>단기납 비과세</span>
                    </span>
                    <span className="inline-flex items-center gap-1.5 text-[#475569]">
                      <span className="w-2.5 h-2.5 rounded-sm bg-[#94A3B8]" />
                      <span>일반 과세({(taxRate * 100).toFixed(1)}%)</span>
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 sm:gap-3 p-3 rounded-xl bg-[#F7F9FC] border border-[#CBD5E1] mb-4 text-xs tabular-nums">
                  <div className="flex items-center justify-between sm:block">
                    <span className="text-[11px] text-[#475569] block">조회 연령</span>
                    <span className="font-extrabold text-[#0F172A]">
                      {activePoint.age}세 ({activePoint.yearsElapsed}년차)
                    </span>
                  </div>
                  <div className="flex items-center justify-between sm:block">
                    <span className="text-[11px] text-[#475569] block">단기납 비과세 자산</span>
                    <span className="font-extrabold text-[#0B192C] font-mono">
                      {formatKoreanMoney(activePoint.taxFreeValue)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between sm:block">
                    <span className="text-[11px] text-[#475569] block">과세 저축 대비 우위</span>
                    <span className="font-extrabold text-[#925800] font-mono">
                      +{formatKoreanMoney(activePoint.taxFreeValue - activePoint.taxableValue)}
                    </span>
                  </div>
                </div>

                <div className="w-full">
                  <svg
                    viewBox={`0 0 ${chartW} ${chartH}`}
                    className="w-full h-auto select-none touch-manipulation"
                    role="img"
                    aria-label="연령별 은퇴 자산 성장 경로 차트"
                  >
                    <defs>
                      <linearGradient id="retireGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#1D4ED8" stopOpacity="0.22" />
                        <stop offset="100%" stopColor="#1D4ED8" stopOpacity="0.02" />
                      </linearGradient>
                    </defs>

                    {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
                      const val = Math.round(maxY * ratio);
                      const y = yForVal(val);
                      return (
                        <g key={ratio}>
                          <line
                            x1={pad.left}
                            y1={y}
                            x2={chartW - pad.right}
                            y2={y}
                            stroke="#E2E8F0"
                            strokeWidth="1"
                          />
                          <text
                            x={pad.left - 8}
                            y={y + 4}
                            textAnchor="end"
                            className="fill-[#475569] text-[10px] font-mono"
                          >
                            {val >= 10000 ? `${(val / 10000).toFixed(1)}억` : `${val}만`}
                          </text>
                        </g>
                      );
                    })}

                    <line
                      x1={pad.left}
                      y1={goalY}
                      x2={chartW - pad.right}
                      y2={goalY}
                      stroke="#D99B26"
                      strokeWidth="1.5"
                      strokeDasharray="6 4"
                    />
                    <text
                      x={chartW - pad.right - 4}
                      y={goalY - 6}
                      textAnchor="end"
                      className="fill-[#925800] text-[10px] font-bold"
                    >
                      목표 은퇴 자금 {formatKoreanMoney(targetGoal, true)}
                    </text>

                    <path d={taxFreeAreaPath} fill="url(#retireGrad)" />
                    <path
                      d={taxablePath}
                      fill="none"
                      stroke="#94A3B8"
                      strokeWidth="2"
                      strokeDasharray="4 3"
                    />
                    <path
                      d={taxFreePath}
                      fill="none"
                      stroke="#1D4ED8"
                      strokeWidth="3"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />

                    {activePoint && (
                      <line
                        x1={xForIdx(activePoint.yearsElapsed)}
                        y1={pad.top}
                        x2={xForIdx(activePoint.yearsElapsed)}
                        y2={pad.top + plotH}
                        stroke="#0B192C"
                        strokeOpacity="0.25"
                        strokeWidth="1"
                      />
                    )}

                    {timeline.map((pt, idx) => {
                      const cx = xForIdx(idx);
                      const isKeyTick =
                        idx === 0 ||
                        idx === timeline.length - 1 ||
                        pt.yearsElapsed === selectedPeriod ||
                        pt.yearsElapsed === 10 ||
                        pt.yearsElapsed % 5 === 0;
                      const isActive = activePoint.yearsElapsed === pt.yearsElapsed;

                      return (
                        <g key={pt.age}>
                          {isKeyTick && (
                            <text
                              x={cx}
                              y={chartH - 10}
                              textAnchor="middle"
                              className={`text-[10px] font-mono ${
                                isActive ? 'fill-[#0B192C] font-bold' : 'fill-[#475569]'
                              }`}
                            >
                              {pt.age}세
                            </text>
                          )}

                          {isActive && (
                            <>
                              <circle
                                cx={cx}
                                cy={yForVal(pt.taxableValue)}
                                r="4"
                                fill="#94A3B8"
                                stroke="#FFFFFF"
                                strokeWidth="1.5"
                              />
                              <circle
                                cx={cx}
                                cy={yForVal(pt.taxFreeValue)}
                                r="5.5"
                                fill="#F4B441"
                                stroke="#0B192C"
                                strokeWidth="2"
                              />
                            </>
                          )}

                          <rect
                            x={cx - plotW / Math.max(1, timeline.length) / 2}
                            y={pad.top}
                            width={plotW / Math.max(1, timeline.length)}
                            height={plotH + 22}
                            fill="transparent"
                            className="cursor-pointer"
                            onMouseEnter={() => setHoverIdx(idx)}
                            onClick={() => setHoverIdx(idx)}
                          />
                        </g>
                      );
                    })}
                  </svg>
                </div>

                <div className="mt-4 pt-3 border-t border-[#CBD5E1] flex flex-wrap items-center justify-between gap-3 text-xs text-[#475569]">
                  <span className="inline-flex items-center gap-1.5 text-[#0B192C] font-semibold">
                    <ShieldCheck className="w-4 h-4 text-[#1D4ED8]" />
                    <span>
                      {currentAge + selectedPeriod}세 완납 종결 → {currentAge + 10}세 1차 목돈 완성({formatKoreanMoney(baseProj.tenYearValue)}) → {retirementProj.retirementAge}세 은퇴 자금 전환
                    </span>
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
