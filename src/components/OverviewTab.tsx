import React from 'react';
import {
  CORE_PRIVILEGES,
  PlanPeriod,
  TaxRateOption,
  buildYearlyCurve,
  calculatePlanProjection,
  formatKoreanMoney,
} from '../data/wealthData';
import { SurrenderCurveChart } from './SurrenderCurveChart';
import { ArrowUpRight, CheckCircle2, ShieldCheck, XCircle } from 'lucide-react';

interface OverviewTabProps {
  selectedPeriod: PlanPeriod;
  monthlyAmount: number;
  taxRate: TaxRateOption;
  onSelectPeriod: (period: PlanPeriod) => void;
  onNavigateTab: (tab: 'overview' | 'simulator' | 'clients' | 'source') => void;
}

export const OverviewTab: React.FC<OverviewTabProps> = ({
  selectedPeriod,
  monthlyAmount,
  taxRate,
  onSelectPeriod,
  onNavigateTab,
}) => {
  const proj5 = calculatePlanProjection(5, monthlyAmount, taxRate);
  const proj7 = calculatePlanProjection(7, monthlyAmount, taxRate);
  const activeProj = selectedPeriod === 5 ? proj5 : proj7;
  const curveData = buildYearlyCurve(monthlyAmount);

  return (
    <div className="space-y-8">
      {/* Top 4 KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
        <div className="bg-white rounded-2xl border border-[#06281B]/10 p-5">
          <span className="text-xs font-semibold text-[#58655E]">10년 시점 확정 환급률</span>
          <div className="mt-2 flex items-baseline justify-between gap-2">
            <span className="text-3xl font-extrabold text-[#06281B] font-mono tabular-nums tracking-tight">
              {activeProj.tenYearRatePct.toFixed(1)}%
            </span>
            <span className="text-xs font-bold text-[#835500] tabular-nums">
              {selectedPeriod}년납 기준
            </span>
          </div>
          <p className="mt-3 text-xs text-[#58655E]">
            월 {monthlyAmount}만원 납입 시 {formatKoreanMoney(activeProj.tenYearValue)} 수령
          </p>
        </div>

        <div className="bg-white rounded-2xl border border-[#06281B]/10 p-5">
          <span className="text-xs font-semibold text-[#58655E]">완납 시점 원금 회복률</span>
          <div className="mt-2 flex items-baseline justify-between gap-2">
            <span className="text-3xl font-extrabold text-[#0B4635] font-mono tabular-nums tracking-tight">
              {activeProj.payoffRatePct.toFixed(1)}%
            </span>
            <span className="text-xs font-semibold text-[#58655E] tabular-nums">
              기존 20년납 52.28% 유지
            </span>
          </div>
          <p className="mt-3 text-xs text-[#58655E]">
            {selectedPeriod}년({activeProj.months}회) 완납 즉시 손실 구간 해소
          </p>
        </div>

        <div className="bg-white rounded-2xl border border-[#06281B]/10 p-5">
          <span className="text-xs font-semibold text-[#58655E]">비과세 절세 효과 (세율 {(taxRate * 100).toFixed(1)}%)</span>
          <div className="mt-2 flex items-baseline justify-between gap-2">
            <span className="text-3xl font-extrabold text-[#835500] font-mono tabular-nums tracking-tight">
              +{formatKoreanMoney(activeProj.taxSaved)}
            </span>
            <span className="text-xs font-bold text-[#0B4635] tabular-nums">세금 0원</span>
          </div>
          <p className="mt-3 text-xs text-[#58655E]">
            과세 예금 환산 시 연평균 세전 {activeProj.requiredPreTaxBankEquivalentPct}% 수준
          </p>
        </div>

        <div className="bg-[#06281B] text-white rounded-2xl border border-[#06281B] p-5">
          <span className="text-xs font-medium text-[#BBEED6]">고객 만족도 · 일일 접수</span>
          <div className="mt-2 flex items-baseline justify-between gap-2">
            <span className="text-3xl font-extrabold text-[#FFC93C] font-mono tabular-nums tracking-tight">
              4.9 / 5.0
            </span>
            <span className="text-xs font-bold text-white tabular-nums">일 142명 접수</span>
          </div>
          <p className="mt-3 text-xs text-[#BBEED6]/80">
            가입자 2,840명 응답 기준 · 0세~70세 가입
          </p>
        </div>
      </div>

      {/* Main Chart + Side Benchmark Split */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        <div className="lg:col-span-8">
          <SurrenderCurveChart data={curveData} monthlyAmount={monthlyAmount} />
        </div>

        <div className="lg:col-span-4 bg-white rounded-2xl border border-[#06281B]/10 p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between gap-2 mb-4">
              <h3 className="text-lg font-extrabold text-[#111814] tracking-tight">
                플랜별 수익·절세 비교
              </h3>
              <div className="inline-flex p-1 rounded-lg bg-[#F4EFE6]">
                <button
                  type="button"
                  onClick={() => onSelectPeriod(5)}
                  className={`px-2.5 py-1 text-xs font-bold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    selectedPeriod === 5
                      ? 'bg-[#06281B] text-white'
                      : 'text-[#58655E] hover:text-[#111814]'
                  }`}
                >
                  5년납
                </button>
                <button
                  type="button"
                  onClick={() => onSelectPeriod(7)}
                  className={`px-2.5 py-1 text-xs font-bold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    selectedPeriod === 7
                      ? 'bg-[#06281B] text-white'
                      : 'text-[#58655E] hover:text-[#111814]'
                  }`}
                >
                  7년납
                </button>
              </div>
            </div>

            <p className="text-xs text-[#58655E] mb-5">
              월 {monthlyAmount.toLocaleString()}만원 기준, 5년·7년 집중납입의 10년차 확정 자산가치 대조
            </p>

            <div className="divide-y divide-[#DCE5DD]">
              <div className="py-3 flex items-center justify-between">
                <span className="text-xs font-medium text-[#58655E]">총 납입 원금</span>
                <div className="text-right font-mono tabular-nums text-xs">
                  <span className="font-bold text-[#111814]">{formatKoreanMoney(proj5.totalPrincipal)}</span>
                  <span className="text-[#58655E] mx-1.5">/</span>
                  <span className="font-bold text-[#0B4635]">{formatKoreanMoney(proj7.totalPrincipal)}</span>
                </div>
              </div>
              <div className="py-3 flex items-center justify-between">
                <span className="text-xs font-medium text-[#58655E]">완납 시점 환급금</span>
                <div className="text-right font-mono tabular-nums text-xs">
                  <span className="font-bold text-[#111814]">{formatKoreanMoney(proj5.payoffValue)}</span>
                  <span className="text-[#58655E] mx-1.5">/</span>
                  <span className="font-bold text-[#0B4635]">{formatKoreanMoney(proj7.payoffValue)}</span>
                </div>
              </div>
              <div className="py-3 flex items-center justify-between">
                <span className="text-xs font-medium text-[#58655E]">10년 확정 환급금</span>
                <div className="text-right font-mono tabular-nums text-xs">
                  <span className="font-extrabold text-[#835500]">{formatKoreanMoney(proj5.tenYearValue)}</span>
                  <span className="text-[#58655E] mx-1.5">/</span>
                  <span className="font-extrabold text-[#06281B]">{formatKoreanMoney(proj7.tenYearValue)}</span>
                </div>
              </div>
              <div className="py-3 flex items-center justify-between">
                <span className="text-xs font-medium text-[#58655E]">순수 복리 차익</span>
                <div className="text-right font-mono tabular-nums text-xs">
                  <span className="font-bold text-[#835500]">+{formatKoreanMoney(proj5.netProfit10Y)}</span>
                  <span className="text-[#58655E] mx-1.5">/</span>
                  <span className="font-bold text-[#06281B]">+{formatKoreanMoney(proj7.netProfit10Y)}</span>
                </div>
              </div>
              <div className="py-3 flex items-center justify-between">
                <span className="text-xs font-medium text-[#58655E]">15.4% 비과세 절세</span>
                <div className="text-right font-mono tabular-nums text-xs">
                  <span className="font-bold text-[#0B4635]">+{formatKoreanMoney(proj5.taxSaved)}</span>
                  <span className="text-[#58655E] mx-1.5">/</span>
                  <span className="font-bold text-[#06281B]">+{formatKoreanMoney(proj7.taxSaved)}</span>
                </div>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => onNavigateTab('simulator')}
            className="mt-5 w-full py-3 px-4 rounded-full bg-[#FEAE2C] hover:bg-[#E09419] text-[#06281B] text-sm font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
          >
            <span>상세 시뮬레이터 및 매트릭스 열기</span>
            <ArrowUpRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Structural Comparison & 4 Core Privileges */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Legacy vs Short-pay Comparison Table */}
        <div className="lg:col-span-7 bg-white rounded-2xl border border-[#06281B]/10 p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-extrabold text-[#111814] tracking-tight">
                상품 구조 비교: 기존 20년 장기 종신 vs 단기납 자산케어
              </h3>
              <p className="text-xs text-[#58655E] mt-1">
                금융기획 보도 인용(유지율 52.28%) 및 단기납 약관 구조 대조 분석
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-[#DCE5DD] text-xs font-bold text-[#58655E]">
                  <th className="py-3 pr-4">비교 항목</th>
                  <th className="py-3 px-4 text-[#D9383A]">기존 20년 종신보험</th>
                  <th className="py-3 pl-4 text-[#06281B]">단기납 자산케어 (5·7년)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#DCE5DD]/70 text-xs sm:text-sm">
                <tr>
                  <td className="py-3.5 pr-4 font-semibold text-[#111814]">총 납입 기간</td>
                  <td className="py-3.5 px-4 text-[#58655E] tabular-nums">
                    <span className="inline-flex items-center gap-1.5">
                      <XCircle className="w-4 h-4 text-[#D9383A] shrink-0" />
                      <span>240개월 (20년 부담)</span>
                    </span>
                  </td>
                  <td className="py-3.5 pl-4 font-bold text-[#06281B] tabular-nums">
                    <span className="inline-flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 text-[#0B4635] shrink-0" />
                      <span>60개월(5년) / 84개월(7년)</span>
                    </span>
                  </td>
                </tr>
                <tr>
                  <td className="py-3.5 pr-4 font-semibold text-[#111814]">완납 유지율 · 안정성</td>
                  <td className="py-3.5 px-4 text-[#D9383A] font-semibold tabular-nums">
                    52.28% (중도해지 손실 50~70%)
                  </td>
                  <td className="py-3.5 pl-4 font-bold text-[#0B4635] tabular-nums">
                    단기 집중 완납으로 중도 이탈 최소화
                  </td>
                </tr>
                <tr>
                  <td className="py-3.5 pr-4 font-semibold text-[#111814]">원금 100% 도달 시점</td>
                  <td className="py-3.5 px-4 text-[#58655E] tabular-nums">통상 15년 ~ 18년 소요</td>
                  <td className="py-3.5 pl-4 font-bold text-[#06281B] tabular-nums">
                    5년 완납 99.5% · 7년 완납 100.0%
                  </td>
                </tr>
                <tr>
                  <td className="py-3.5 pr-4 font-semibold text-[#111814]">10년 시점 확정 환급률</td>
                  <td className="py-3.5 px-4 text-[#58655E] tabular-nums">약 80.8% (원금 미달)</td>
                  <td className="py-3.5 pl-4 font-extrabold text-[#835500] tabular-nums">
                    120.4% (5년납) / 122.5% (7년납)
                  </td>
                </tr>
                <tr>
                  <td className="py-3.5 pr-4 font-semibold text-[#111814]">세제 혜택 · 유동성</td>
                  <td className="py-3.5 px-4 text-[#58655E]">장기 자금 경직</td>
                  <td className="py-3.5 pl-4 font-semibold text-[#06281B]">
                    15.4% 비과세 면제 + 중도인출·추가납입
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* 4 Core Privileges */}
        <div className="lg:col-span-5 bg-white rounded-2xl border border-[#06281B]/10 p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-extrabold text-[#111814] tracking-tight">
                핵심 특권 4대 구조 요약
              </h3>
              <p className="text-xs text-[#58655E] mt-1">
                보장과 비과세 복리 자산을 결합한 설계 요인
              </p>
            </div>
            <ShieldCheck className="w-5 h-5 text-[#0B4635]" />
          </div>

          <div className="divide-y divide-[#DCE5DD]">
            {CORE_PRIVILEGES.map((priv) => (
              <div key={priv.index} className="py-3.5 first:pt-1 last:pb-0">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-bold text-[#111814]">
                    {priv.index}. {priv.title}
                  </span>
                  <span className="text-xs font-bold text-[#0B4635] whitespace-nowrap shrink-0">
                    {priv.metric}
                  </span>
                </div>
                <p className="text-xs text-[#58655E] mt-1 leading-relaxed">{priv.summary}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
