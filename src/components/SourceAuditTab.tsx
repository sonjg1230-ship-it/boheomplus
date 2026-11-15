import React, { useState } from 'react';
import { DESIGN_TOKENS, SOURCE_SECTIONS_AUDIT } from '../data/wealthData';
import { Check, Copy, Maximize2, Palette, X } from 'lucide-react';

export const SourceAuditTab: React.FC = () => {
  const [copiedHex, setCopiedHex] = useState<string | null>(null);
  const [tokenFilter, setTokenFilter] = useState<'all' | 'emerald' | 'gold' | 'neutral' | 'semantic'>('all');
  const [imgError, setImgError] = useState(false);
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);

  const handleCopy = (hex: string) => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(hex).catch(() => {});
    }
    setCopiedHex(hex);
    setTimeout(() => setCopiedHex(null), 1500);
  };

  const filteredTokens =
    tokenFilter === 'all'
      ? DESIGN_TOKENS
      : DESIGN_TOKENS.filter((t) => t.category === tokenFilter);

  return (
    <div className="space-y-8">
      {/* Top 2-Column Overview of Uploaded Files */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left: Screenshot Reference Preview */}
        <div className="lg:col-span-5 bg-white rounded-2xl border border-[#06281B]/10 p-6">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="text-base font-extrabold text-[#111814]">
                원본 시안 스크린샷 분석 (screen_b7839ea5.png)
              </h3>
              <p className="text-xs text-[#58655E] mt-0.5">
                전달된 랜딩 페이지 풀스크린 캡처 · 클릭하여 확대 검수
              </p>
            </div>
            {!imgError && (
              <button
                type="button"
                onClick={() => setIsLightboxOpen(true)}
                className="p-2 rounded-lg border border-[#DCE5DD] text-[#58655E] hover:text-[#06281B] cursor-pointer"
                aria-label="스크린샷 확대"
              >
                <Maximize2 className="w-4 h-4" />
              </button>
            )}
          </div>

          <div className="rounded-xl border border-[#DCE5DD] bg-[#FBF9F4] overflow-hidden max-h-[420px] overflow-y-auto">
            {!imgError ? (
              <img
                src="/assets/aistudio/screen_b7839ea5.png"
                alt="단기납 자산케어 원본 랜딩 페이지 스크린샷"
                referrerPolicy="no-referrer"
                onError={() => setImgError(true)}
                onClick={() => setIsLightboxOpen(true)}
                className="w-full h-auto block cursor-zoom-in"
              />
            ) : (
              <div className="p-10 text-center text-xs text-[#58655E]">
                스크린샷 이미지(/assets/aistudio/screen_b7839ea5.png)를 표시할 수 없습니다.
              </div>
            )}
          </div>
        </div>

        {/* Right: 8-Section Structural Funnel Audit from code_2880f903.html */}
        <div className="lg:col-span-7 bg-white rounded-2xl border border-[#06281B]/10 p-6">
          <div className="mb-4">
            <h3 className="text-base font-extrabold text-[#111814]">
              HTML 구조 및 전환 퍼널 진단 (code_2880f903.html)
            </h3>
            <p className="text-xs text-[#58655E] mt-1">
              업로드된 HTML의 8개 핵심 섹션별 전환 역할 및 대시보드 개선 반영 내역
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-[#DCE5DD] bg-[#FBF9F4] font-bold text-[#58655E]">
                  <th className="py-2.5 px-3">순서</th>
                  <th className="py-2.5 px-3">섹션명</th>
                  <th className="py-2.5 px-3">핵심 지표 / 데이터</th>
                  <th className="py-2.5 px-3">UX · 분석 인사이트</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#DCE5DD]/70">
                {SOURCE_SECTIONS_AUDIT.map((sec) => (
                  <tr key={sec.order} className="hover:bg-[#FBF9F4]">
                    <td className="py-3 px-3 font-mono font-bold text-[#0B4635]">{sec.order}</td>
                    <td className="py-3 px-3">
                      <span className="font-bold text-[#111814] block">{sec.title}</span>
                      <span className="text-[11px] text-[#58655E]">{sec.role}</span>
                    </td>
                    <td className="py-3 px-3 font-semibold text-[#835500] whitespace-nowrap">
                      {sec.keyMetric}
                    </td>
                    <td className="py-3 px-3 text-[#58655E] leading-relaxed">{sec.auditNote}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Design System Tokens Inspector (DESIGN_3c47cca1.md) */}
      <div className="bg-white rounded-2xl border border-[#06281B]/10 p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5">
          <div className="flex items-center gap-2">
            <Palette className="w-5 h-5 text-[#0B4635]" />
            <div>
              <h3 className="text-base font-extrabold text-[#111814]">
                디자인 시스템 토큰 분석 (DESIGN_3c47cca1.md · Prestige Wealth Assurance)
              </h3>
              <p className="text-xs text-[#58655E] mt-0.5">
                Plus Jakarta Sans + Noto Sans KR 타이포그래피 및 에메랄드·골드·파치먼트 컬러 체계 (클릭 시 HEX 복사)
              </p>
            </div>
          </div>

          <div className="flex p-1 rounded-lg bg-[#F4EFE6] overflow-x-auto">
            {(
              [
                { key: 'all', label: '전체' },
                { key: 'emerald', label: 'Emerald' },
                { key: 'gold', label: 'Gold' },
                { key: 'neutral', label: 'Parchment/Ink' },
                { key: 'semantic', label: 'Semantic' },
              ] as const
            ).map((cat) => (
              <button
                key={cat.key}
                type="button"
                onClick={() => setTokenFilter(cat.key)}
                className={`px-3 py-1.5 text-xs font-bold rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                  tokenFilter === cat.key ? 'bg-[#06281B] text-white' : 'text-[#58655E]'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3.5">
          {filteredTokens.map((token) => {
            const isCopied = copiedHex === token.hex;
            return (
              <button
                key={token.name}
                type="button"
                onClick={() => handleCopy(token.hex)}
                className="text-left p-3.5 rounded-xl border border-[#DCE5DD] hover:border-[#06281B]/40 bg-[#FBF9F4] hover:bg-white transition-colors cursor-pointer flex items-start gap-3"
              >
                <span
                  className="w-10 h-10 rounded-lg border border-black/10 shrink-0"
                  style={{ backgroundColor: token.hex }}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-[#111814] truncate">{token.name}</span>
                    {isCopied ? (
                      <Check className="w-3.5 h-3.5 text-[#0B4635] shrink-0" />
                    ) : (
                      <Copy className="w-3.5 h-3.5 text-[#58655E] shrink-0" />
                    )}
                  </div>
                  <span className="text-[11px] font-mono font-bold text-[#835500] block mt-0.5">
                    {isCopied ? '복사됨!' : token.hex}
                  </span>
                  <span className="text-[11px] text-[#58655E] block mt-1 leading-snug">
                    {token.role}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Lightbox Modal for Screenshot */}
      {isLightboxOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs"
          onClick={() => setIsLightboxOpen(false)}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="relative max-w-4xl w-full max-h-[90vh] bg-white rounded-2xl overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-3 border-b border-[#DCE5DD]">
              <span className="text-sm font-bold text-[#111814]">
                원본 스크린샷 검수 (screen_b7839ea5.png)
              </span>
              <button
                type="button"
                onClick={() => setIsLightboxOpen(false)}
                className="p-1.5 rounded-lg text-[#58655E] hover:text-[#111814] cursor-pointer"
                aria-label="닫기"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="overflow-y-auto p-4 bg-[#FBF9F4]">
              <img
                src="/assets/aistudio/screen_b7839ea5.png"
                alt="단기납 자산케어 원본 랜딩 페이지 확대 보기"
                referrerPolicy="no-referrer"
                className="w-full h-auto rounded-lg border border-[#DCE5DD]"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
