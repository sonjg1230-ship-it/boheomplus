import React, { useMemo, useState } from 'react';
import {
  MATRIX_AMOUNTS,
  PlanPeriod,
  TaxRateOption,
  calculatePlanProjection,
  exportMatrixToCsv,
  formatKoreanMoney,
  getMatrixRows,
} from '../data/wealthData';
import { ArrowDownUp, Calculator, Download, RotateCcw } from 'lucide-react';

interface SimulatorTabProps {
  selectedPeriod: PlanPeriod;
  monthlyAmount: number;
  taxRate: TaxRateOption;
  onSelectPeriod: (period: PlanPeriod) => void;
  onChangeMonthlyAmount: (amount: number) => void;
  onChangeTaxRate: (rate: TaxRateOption) => void;
  onReset: () => void;
}

type SortKey = 'amount' | 'principal' | 'tenYearValue' | 'taxSaved154';

export const SimulatorTab: React.FC<SimulatorTabProps> = ({
  selectedPeriod,
  monthlyAmount,
  taxRate,
  onSelectPeriod,
  onChangeMonthlyAmount,
  onChangeTaxRate,
  onReset,
}) => {
  const [sortKey, setSortKey] = useState<SortKey>('amount');
  const [sortAsc, setSortAsc] = useState(true);
  const [horizon, setHorizon] = useState<'payoff' | '10y' | '15y'>('10y');

  const proj = useMemo(
    () => calculatePlanProjection(selectedPeriod, monthlyAmount, taxRate),
    [selectedPeriod, monthlyAmount, taxRate]
  );

  const matrixRows = useMemo(() => {
    const base = getMatrixRows(selectedPeriod);
    return [...base].sort((a, b) => {
      const diff = a[sortKey] - b[sortKey];
      return sortAsc ? diff : -diff;
    });
  }, [selectedPeriod, sortKey, sortAsc]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortAsc(!sortAsc);
    } else {
      setSortKey(key);
      setSortAsc(true);
    }
  };

  const horizonValue =
    horizon === 'payoff'
      ? proj.payoffValue
      : horizon === '10y'
      ? proj.tenYearValue
      : proj.fifteenYearValue;

  const horizonRatePct =
    horizon === 'payoff'
      ? proj.payoffRatePct
      : horizon === '10y'
      ? proj.tenYearRatePct
      : proj.fifteenYearRatePct;

  const horizonLabel =
    horizon === 'payoff'
      ? `${selectedPeriod}년 완납 시점`
      : horizon === '10y'
      ? '10년 거치 시점'
      : '15년 장기 거치 시점';

  // 일반 과세 예적금과 세후 수령액 비교 (같은 10년 복리 수익 기준)
  const taxableInterestFee = Math.round(proj.netProfit10Y * taxRate * 10) / 10;
  const taxableNetPayout = Math.round((proj.tenYearValue - taxableInterestFee) * 10) / 10;

  return (
    <div className="space-y-8">
      {/* Interactive Simulator Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* Controls Column */}
        <div className="lg:col-span-6 bg-white rounded-2xl border border-[#06281B]/10 p-6 space-y-6">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <Calculator className="w-5 h-5 text-[#0B4635]" />
              <h3 className="text-lg font-extrabold text-[#111814] tracking-tight">
                맞춤 환급금 · 절세 시뮬레이터
              </h3>
            </div>
            <button
              type="button"
              onClick={onReset}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#DCE5DD] text-xs font-semibold text-[#58655E] hover:text-[#111814] hover:border-[#06281B]/30 transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>기본값(5년·50만)</span>
            </button>
          </div>

          {/* 1. Payment Period */}
          <div>
            <label className="block text-xs font-bold text-[#111814] mb-2">
              1. 집중 납입 기간 선택
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => onSelectPeriod(5)}
                className={`py-3 px-4 rounded-xl text-sm font-bold border transition-colors cursor-pointer whitespace-nowrap ${
                  selectedPeriod === 5
                    ? 'bg-[#06281B] text-white border-[#06281B]'
                    : 'bg-white text-[#58655E] border-[#DCE5DD] hover:border-[#06281B]/40'
                }`}
              >
                5년 납입 (60회 · 120.4%)
              </button>
              <button
                type="button"
                onClick={() => onSelectPeriod(7)}
                className={`py-3 px-4 rounded-xl text-sm font-bold border transition-colors cursor-pointer whitespace-nowrap ${
                  selectedPeriod === 7
                    ? 'bg-[#06281B] text-white border-[#06281B]'
                    : 'bg-white text-[#58655E] border-[#DCE5DD] hover:border-[#06281B]/40'
                }`}
              >
                7년 납입 (84회 · 122.5%)
              </button>
            </div>
          </div>

          {/* 2. Monthly Amount Presets + Range Slider */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label htmlFor="monthlyRange" className="text-xs font-bold text-[#111814]">
                2. 희망 월 납입금액
              </label>
              <span className="text-sm font-extrabold text-[#835500] font-mono tabular-nums">
                월 {monthlyAmount.toLocaleString()}만원
              </span>
            </div>

            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 mb-3">
              {MATRIX_AMOUNTS.map((amt) => {
                const active = monthlyAmount === amt;
                return (
                  <button
                    key={amt}
                    type="button"
                    onClick={() => onChangeMonthlyAmount(amt)}
                    className={`py-2 px-2 rounded-lg text-xs font-bold border transition-colors cursor-pointer tabular-nums whitespace-nowrap ${
                      active
                        ? 'bg-[#FEAE2C]/20 border-[#835500] text-[#835500]'
                        : 'bg-[#FBF9F4] border-[#DCE5DD] text-[#111814] hover:border-[#06281B]/40'
                    }`}
                  >
                    {amt}만원
                  </button>
                );
              })}
            </div>

            <input
              id="monthlyRange"
              type="range"
              min={10}
              max={500}
              step={10}
              value={monthlyAmount}
              onChange={(e) => onChangeMonthlyAmount(Number(e.target.value))}
              className="w-full accent-[#06281B] cursor-pointer"
            />
            <div className="flex justify-between text-[11px] text-[#58655E] font-mono tabular-nums mt-1">
              <span>10만원</span>
              <span>100만원</span>
              <span>250만원</span>
              <span>500만원</span>
            </div>
          </div>

          {/* 3. Horizon & Tax Bracket */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
            <div>
              <label className="block text-xs font-bold text-[#111814] mb-2">
                3. 분석 평가 시점
              </label>
              <div className="flex p-1 rounded-lg bg-[#F4EFE6]">
                {(
                  [
                    { key: 'payoff', label: `${selectedPeriod}년 완납` },
                    { key: '10y', label: '10년 거치' },
                    { key: '15y', label: '15년 거치' },
                  ] as const
                ).map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => setHorizon(item.key)}
                    className={`flex-1 py-1.5 px-2 text-xs font-bold rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                      horizon === item.key
                        ? 'bg-white text-[#06281B] shadow-xs'
                        : 'text-[#58655E] hover:text-[#111814]'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label htmlFor="taxBracketSelect" className="block text-xs font-bold text-[#111814] mb-2">
                4. 비교 대상 과세율
              </label>
              <select
                id="taxBracketSelect"
                value={taxRate}
                onChange={(e) => onChangeTaxRate(Number(e.target.value) as TaxRateOption)}
                className="w-full px-3 py-2 rounded-lg border border-[#DCE5DD] bg-white text-xs font-bold text-[#111814] focus:outline-none focus:border-[#06281B]"
              >
                <option value={0.154}>일반 이자소득세 (15.4%)</option>
                <option value={0.264}>금융소득종합과세 중위 (26.4%)</option>
                <option value={0.495}>고액자산가 최고세율 (49.5%)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Live Result Output Column */}
        <div className="lg:col-span-6 bg-[#06281B] text-white rounded-2xl p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-4 border-b border-white/10">
              <span className="text-sm font-bold text-[#FFC93C]">실시간 확정 산출 결과</span>
              <span className="text-xs text-[#BBEED6] font-mono tabular-nums">
                {selectedPeriod}년납 ({proj.months}회) · 월 {monthlyAmount.toLocaleString()}만원
              </span>
            </div>

            <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-4 rounded-xl bg-[#0B4635]/80 border border-white/10">
                <span className="text-xs text-[#BBEED6] block">총 납입 원금</span>
                <span className="text-2xl font-extrabold text-white font-mono tabular-nums mt-1 block">
                  {formatKoreanMoney(proj.totalPrincipal)}
                </span>
              </div>

              <div className="p-4 rounded-xl bg-[#0B4635]/80 border border-white/10">
                <span className="text-xs text-[#BBEED6] block">
                  {selectedPeriod}년 완납 시점 ({proj.payoffRatePct.toFixed(1)}%)
                </span>
                <span className="text-2xl font-extrabold text-white font-mono tabular-nums mt-1 block">
                  {formatKoreanMoney(proj.payoffValue)}
                </span>
              </div>
            </div>

            {/* Highlighted Selected Horizon Card */}
            <div className="mt-4 p-5 rounded-xl bg-[#063B2B] border border-[#FFC93C]/50 flex items-center justify-between gap-4">
              <div>
                <span className="text-xs font-bold text-[#FFC93C] block">
                  {horizonLabel} 예상 환급금 ({horizonRatePct.toFixed(1)}%)
                </span>
                <span className="text-xs text-white/70 mt-1 block">
                  확정 복리 수익 + 평생 종신보장 결합
                </span>
              </div>
              <span className="text-3xl sm:text-4xl font-extrabold text-[#FFC93C] font-mono tabular-nums tracking-tight">
                {formatKoreanMoney(horizonValue)}
              </span>
            </div>

            {/* Tax Comparison Breakdown */}
            <div className="mt-5 space-y-2.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-white/75">10년 시점 순수 복리 수익</span>
                <span className="font-mono font-bold text-white tabular-nums">
                  +{formatKoreanMoney(proj.netProfit10Y)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-white/75">
                  동일 수익 과세 상품 시 세후 실수령 ({(taxRate * 100).toFixed(1)}% 차감)
                </span>
                <span className="font-mono font-semibold text-white/80 tabular-nums">
                  {formatKoreanMoney(taxableNetPayout)}
                </span>
              </div>
              <div className="flex items-center justify-between pt-2 border-t border-white/10">
                <span className="text-[#BBEED6] font-bold">비과세 적용에 따른 순수 절세액</span>
                <span className="text-base font-extrabold text-[#FFC93C] font-mono tabular-nums">
                  +{formatKoreanMoney(proj.taxSaved)} 절세
                </span>
              </div>
            </div>
          </div>

          <p className="mt-5 text-[11px] text-white/60 leading-relaxed">
            * 5년납 10년 120.4% · 7년납 10년 122.5% 표준 확정 환급률 기준이며, 비과세 혜택은 소득세법 시행령 제25조 요건 충족 시 적용됩니다.
          </p>
        </div>
      </div>

      {/* Interactive Cash Surrender Value Matrix */}
      <div className="bg-white rounded-2xl border border-[#06281B]/10 p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5">
          <div>
            <h3 className="text-lg font-extrabold text-[#111814] tracking-tight">
              금액 구간별 상세 환급 비교 매트릭스 ({selectedPeriod}년납 기준)
            </h3>
            <p className="text-xs text-[#58655E] mt-1">
              행을 클릭하면 해당 월 납입액이 상단 시뮬레이터와 차트에 즉시 반영됩니다.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex p-1 rounded-lg bg-[#F4EFE6]">
              <button
                type="button"
                onClick={() => onSelectPeriod(5)}
                className={`px-3 py-1.5 text-xs font-bold rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                  selectedPeriod === 5 ? 'bg-[#06281B] text-white' : 'text-[#58655E]'
                }`}
              >
                5년납 (120.4%)
              </button>
              <button
                type="button"
                onClick={() => onSelectPeriod(7)}
                className={`px-3 py-1.5 text-xs font-bold rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                  selectedPeriod === 7 ? 'bg-[#06281B] text-white' : 'text-[#58655E]'
                }`}
              >
                7년납 (122.5%)
              </button>
            </div>

            <button
              type="button"
              onClick={() => exportMatrixToCsv(selectedPeriod)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#06281B] hover:bg-[#0B4635] text-white text-xs font-bold transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              <Download className="w-3.5 h-3.5" />
              <span>CSV 다운로드</span>
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="border-b border-[#DCE5DD] bg-[#FBF9F4] text-xs font-bold text-[#58655E]">
                <th className="py-3 px-4">
                  <button
                    type="button"
                    onClick={() => handleSort('amount')}
                    className="inline-flex items-center gap-1 hover:text-[#111814] cursor-pointer"
                  >
                    <span>월 납입금액</span>
                    <ArrowDownUp className="w-3 h-3" />
                  </button>
                </th>
                <th className="py-3 px-4 text-right">
                  <button
                    type="button"
                    onClick={() => handleSort('principal')}
                    className="inline-flex items-center gap-1 hover:text-[#111814] cursor-pointer ml-auto"
                  >
                    <span>총 납입 원금 ({selectedPeriod * 12}회)</span>
                    <ArrowDownUp className="w-3 h-3" />
                  </button>
                </th>
                <th className="py-3 px-4 text-right">
                  {selectedPeriod}년 완납 ({selectedPeriod === 5 ? '99.5%' : '100.0%'})
                </th>
                <th className="py-3 px-4 text-right">
                  <button
                    type="button"
                    onClick={() => handleSort('tenYearValue')}
                    className="inline-flex items-center gap-1 text-[#06281B] hover:underline cursor-pointer ml-auto"
                  >
                    <span>10년 시점 ({selectedPeriod === 5 ? '120.4%' : '122.5%'})</span>
                    <ArrowDownUp className="w-3 h-3" />
                  </button>
                </th>
                <th className="py-3 px-4 text-right">15년 거치 예상</th>
                <th className="py-3 px-4 text-right">순수 복리 수익</th>
                <th className="py-3 px-4 text-right">
                  <button
                    type="button"
                    onClick={() => handleSort('taxSaved154')}
                    className="inline-flex items-center gap-1 hover:text-[#111814] cursor-pointer ml-auto"
                  >
                    <span>비과세 절세(15.4%)</span>
                    <ArrowDownUp className="w-3 h-3" />
                  </button>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#DCE5DD]/70 tabular-nums">
              {matrixRows.map((row) => {
                const isSelected = row.amount === monthlyAmount;
                return (
                  <tr
                    key={row.amount}
                    onClick={() => onChangeMonthlyAmount(row.amount)}
                    className={`cursor-pointer transition-colors ${
                      isSelected
                        ? 'bg-[#EAF6EF] font-semibold'
                        : 'hover:bg-[#FBF9F4]'
                    }`}
                  >
                    <td className="py-3.5 px-4 font-bold text-[#111814]">
                      <div className="flex items-center gap-2">
                        <span>{row.label}</span>
                        {row.isBest && (
                          <span className="text-[11px] font-bold text-[#835500]">· BEST</span>
                        )}
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono text-[#58655E]">
                      {formatKoreanMoney(row.principal)}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono text-[#111814]">
                      {formatKoreanMoney(row.payoffValue)}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono font-extrabold text-[#06281B]">
                      {formatKoreanMoney(row.tenYearValue)}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono text-[#58655E]">
                      {formatKoreanMoney(row.fifteenYearValue)}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono font-bold text-[#835500]">
                      +{formatKoreanMoney(row.profit10Y)}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono font-bold text-[#0B4635]">
                      +{formatKoreanMoney(row.taxSaved154)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
