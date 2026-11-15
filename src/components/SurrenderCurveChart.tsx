import React, { useState } from 'react';
import { YearlyPoint, formatKoreanMoney } from '../data/wealthData';

interface SurrenderCurveChartProps {
  data: YearlyPoint[];
  monthlyAmount: number;
}

export const SurrenderCurveChart: React.FC<SurrenderCurveChartProps> = ({ data, monthlyAmount }) => {
  const [hoverIndex, setHoverIndex] = useState<number | null>(9);
  const [visibleSeries, setVisibleSeries] = useState({
    plan5: true,
    plan7: true,
    legacy20: true,
  });

  const width = 760;
  const height = 310;
  const padding = { top: 24, right: 24, bottom: 38, left: 48 };
  const plotW = width - padding.left - padding.right;
  const plotH = height - padding.top - padding.bottom;

  const minRate = 20;
  const maxRate = 140;

  const xForIndex = (idx: number) => padding.left + (idx / (data.length - 1)) * plotW;
  const yForRate = (rate: number) =>
    padding.top + plotH - ((rate - minRate) / (maxRate - minRate)) * plotH;

  const buildPath = (getter: (d: YearlyPoint) => number) =>
    data
      .map((d, idx) => `${idx === 0 ? 'M' : 'L'} ${xForIndex(idx).toFixed(1)} ${yForRate(getter(d)).toFixed(1)}`)
      .join(' ');

  const buildAreaPath = (getter: (d: YearlyPoint) => number) => {
    const line = buildPath(getter);
    const lastX = xForIndex(data.length - 1).toFixed(1);
    const firstX = xForIndex(0).toFixed(1);
    const bottomY = (padding.top + plotH).toFixed(1);
    return `${line} L ${lastX} ${bottomY} L ${firstX} ${bottomY} Z`;
  };

  const yTicks = [20, 40, 60, 80, 100, 120, 140];
  const breakevenY = yForRate(100);
  const activePoint = hoverIndex !== null ? data[hoverIndex] : data[9];

  const toggleSeries = (key: 'plan5' | 'plan7' | 'legacy20') => {
    setVisibleSeries((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      if (!next.plan5 && !next.plan7 && !next.legacy20) return prev;
      return next;
    });
  };

  return (
    <div className="bg-white rounded-2xl border border-[#0B192C]/10 p-4 sm:p-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 mb-5">
        <div>
          <h3 className="text-base sm:text-lg font-extrabold text-[#0F172A] tracking-tight">
            연차별 해약환급률 및 원금 회복 추이 (1~15년)
          </h3>
          <p className="text-xs text-[#475569] mt-1">
            월 {monthlyAmount.toLocaleString()}만원 납입 가정 · 100% 기준선 돌파 시점 비교
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => toggleSeries('plan5')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              visibleSeries.plan5
                ? 'bg-[#0B192C] text-white border-[#0B192C]'
                : 'bg-white text-[#475569] border-[#CBD5E1] hover:border-[#0B192C]/40'
            }`}
          >
            <span className="w-2.5 h-2.5 rounded-sm bg-[#F4B441]" />
            <span>5년 단기납</span>
          </button>
          <button
            type="button"
            onClick={() => toggleSeries('plan7')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              visibleSeries.plan7
                ? 'bg-[#1D4ED8] text-white border-[#1D4ED8]'
                : 'bg-white text-[#475569] border-[#CBD5E1] hover:border-[#1D4ED8]/40'
            }`}
          >
            <span className="w-2.5 h-2.5 rounded-sm bg-[#93C5FD]" />
            <span>7년 단기납</span>
          </button>
          <button
            type="button"
            onClick={() => toggleSeries('legacy20')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              visibleSeries.legacy20
                ? 'bg-[#FEF2F2] text-[#DC2626] border-[#DC2626]/40'
                : 'bg-white text-[#475569] border-[#CBD5E1] hover:border-[#DC2626]/40'
            }`}
          >
            <span className="w-2.5 h-2.5 rounded-sm bg-[#DC2626]" />
            <span>기존 20년납</span>
          </button>
        </div>
      </div>

      {/* Selected Year Quick Inspection Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4 p-3.5 rounded-xl bg-[#F7F9FC] border border-[#CBD5E1]">
        <div>
          <span className="text-[11px] font-semibold text-[#475569] block">분석 시점</span>
          <span className="text-sm font-extrabold text-[#0F172A] tabular-nums">
            {activePoint.year}년 경과 ({activePoint.year * 12}회차)
          </span>
        </div>
        <div>
          <span className="text-[11px] font-semibold text-[#475569] block">5년 단기납 환급률</span>
          <span className="text-sm font-extrabold text-[#925800] font-mono tabular-nums">
            {activePoint.plan5Rate.toFixed(1)}% · {formatKoreanMoney(activePoint.plan5Value, true)}
          </span>
        </div>
        <div>
          <span className="text-[11px] font-semibold text-[#475569] block">7년 단기납 환급률</span>
          <span className="text-sm font-extrabold text-[#1D4ED8] font-mono tabular-nums">
            {activePoint.plan7Rate.toFixed(1)}% · {formatKoreanMoney(activePoint.plan7Value, true)}
          </span>
        </div>
        <div>
          <span className="text-[11px] font-semibold text-[#475569] block">기존 20년납 환급률</span>
          <span className="text-sm font-extrabold text-[#DC2626] font-mono tabular-nums">
            {activePoint.legacy20Rate.toFixed(1)}% · {formatKoreanMoney(activePoint.legacy20Value, true)}
          </span>
        </div>
      </div>

      {/* SVG Plot */}
      <div className="w-full">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-auto select-none touch-manipulation"
          role="img"
          aria-label="연차별 해약환급률 비교 차트"
        >
          <defs>
            <linearGradient id="grad5y" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#F4B441" stopOpacity="0.22" />
              <stop offset="100%" stopColor="#F4B441" stopOpacity="0.01" />
            </linearGradient>
            <linearGradient id="grad7y" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#1D4ED8" stopOpacity="0.18" />
              <stop offset="100%" stopColor="#1D4ED8" stopOpacity="0.01" />
            </linearGradient>
          </defs>

          {/* Horizontal Grid Lines */}
          {yTicks.map((tick) => {
            const y = yForRate(tick);
            const is100 = tick === 100;
            return (
              <g key={tick}>
                <line
                  x1={padding.left}
                  y1={y}
                  x2={width - padding.right}
                  y2={y}
                  stroke={is100 ? '#0B192C' : '#E2E8F0'}
                  strokeWidth={is100 ? 1.5 : 1}
                  strokeDasharray={is100 ? '5 4' : undefined}
                />
                <text
                  x={padding.left - 10}
                  y={y + 4}
                  textAnchor="end"
                  className="fill-[#475569] text-[11px] font-mono"
                >
                  {tick}%
                </text>
              </g>
            );
          })}

          {/* 100% Breakeven Annotation */}
          <text
            x={padding.left + 8}
            y={breakevenY - 6}
            className="fill-[#0B192C] text-[11px] font-bold"
          >
            원금 100% 회복 기준선
          </text>

          {/* Area Fills */}
          {visibleSeries.plan5 && (
            <path d={buildAreaPath((d) => d.plan5Rate)} fill="url(#grad5y)" />
          )}
          {visibleSeries.plan7 && (
            <path d={buildAreaPath((d) => d.plan7Rate)} fill="url(#grad7y)" />
          )}

          {/* Lines */}
          {visibleSeries.legacy20 && (
            <path
              d={buildPath((d) => d.legacy20Rate)}
              fill="none"
              stroke="#DC2626"
              strokeWidth="2.25"
              strokeDasharray="6 4"
            />
          )}
          {visibleSeries.plan7 && (
            <path
              d={buildPath((d) => d.plan7Rate)}
              fill="none"
              stroke="#1D4ED8"
              strokeWidth="2.75"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}
          {visibleSeries.plan5 && (
            <path
              d={buildPath((d) => d.plan5Rate)}
              fill="none"
              stroke="#D99B26"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}

          {/* Vertical Hover Guide */}
          <line
            x1={xForIndex(activePoint.year - 1)}
            y1={padding.top}
            x2={xForIndex(activePoint.year - 1)}
            y2={padding.top + plotH}
            stroke="#0B192C"
            strokeOpacity="0.22"
            strokeWidth="1"
          />

          {/* Data Points & Invisible Hit Areas */}
          {data.map((pt, idx) => {
            const cx = xForIndex(idx);
            const isHovered = activePoint.year === pt.year;
            return (
              <g key={pt.year}>
                <text
                  x={cx}
                  y={height - 12}
                  textAnchor="middle"
                  className={`text-[11px] font-mono ${
                    isHovered ? 'fill-[#0B192C] font-bold' : 'fill-[#475569]'
                  }`}
                >
                  {pt.year}년
                </text>

                {visibleSeries.legacy20 && (
                  <circle
                    cx={cx}
                    cy={yForRate(pt.legacy20Rate)}
                    r={isHovered ? 5 : 2.5}
                    fill="#DC2626"
                    stroke="#FFFFFF"
                    strokeWidth="1.5"
                  />
                )}
                {visibleSeries.plan7 && (
                  <circle
                    cx={cx}
                    cy={yForRate(pt.plan7Rate)}
                    r={isHovered ? 5.5 : 3}
                    fill="#1D4ED8"
                    stroke="#FFFFFF"
                    strokeWidth="1.5"
                  />
                )}
                {visibleSeries.plan5 && (
                  <circle
                    cx={cx}
                    cy={yForRate(pt.plan5Rate)}
                    r={isHovered ? 6 : 3.2}
                    fill="#D99B26"
                    stroke="#FFFFFF"
                    strokeWidth="1.5"
                  />
                )}

                <rect
                  x={cx - plotW / data.length / 2}
                  y={padding.top}
                  width={plotW / data.length}
                  height={plotH + 24}
                  fill="transparent"
                  className="cursor-pointer"
                  onMouseEnter={() => setHoverIndex(idx)}
                  onClick={() => setHoverIndex(idx)}
                />
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
};
