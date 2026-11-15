import React, { useMemo, useState } from 'react';
import {
  ClientRecord,
  PlanPeriod,
  calculatePlanProjection,
  formatKoreanMoney,
} from '../data/wealthData';
import { Plus, Search, Users, X } from 'lucide-react';

interface ClientsTabProps {
  records: ClientRecord[];
  onAddRecord: (record: ClientRecord) => void;
}

export const ClientsTab: React.FC<ClientsTabProps> = ({ records, onAddRecord }) => {
  const [search, setSearch] = useState('');
  const [sourceFilter, setSourceFilter] = useState<'all' | 'verified_review' | 'live_lead'>('all');
  const [planFilter, setPlanFilter] = useState<'all' | 5 | 7>('all');
  const [ageFilter, setAgeFilter] = useState<'all' | '30s' | '40s' | '50s'>('all');
  const [selectedRecord, setSelectedRecord] = useState<ClientRecord | null>(records[0] ?? null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  // Add Lead Form State
  const [newName, setNewName] = useState('');
  const [newAge, setNewAge] = useState(41);
  const [newRegion, setNewRegion] = useState('서울특별시');
  const [newOccupation, setNewOccupation] = useState('');
  const [newPlan, setNewPlan] = useState<PlanPeriod>(5);
  const [newAmount, setNewAmount] = useState(50);

  const filteredRecords = useMemo(() => {
    return records.filter((rec) => {
      if (sourceFilter !== 'all' && rec.sourceType !== sourceFilter) return false;
      if (planFilter !== 'all' && rec.planPeriod !== planFilter) return false;
      if (ageFilter === '30s' && (rec.age < 30 || rec.age >= 40)) return false;
      if (ageFilter === '40s' && (rec.age < 40 || rec.age >= 50)) return false;
      if (ageFilter === '50s' && rec.age < 50) return false;

      if (search.trim()) {
        const q = search.trim().toLowerCase();
        const hay = `${rec.name} ${rec.occupation} ${rec.region} ${rec.statusLabel}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [records, sourceFilter, planFilter, ageFilter, search]);

  const stats = useMemo(() => {
    const count = filteredRecords.length;
    if (count === 0) {
      return {
        count: 0,
        avgMonthly: 0,
        avgAge: 0,
        totalTenYearVolume: 0,
        plan5Count: 0,
        plan7Count: 0,
      };
    }
    const totalMonthly = filteredRecords.reduce((acc, r) => acc + r.monthlyAmount, 0);
    const totalAge = filteredRecords.reduce((acc, r) => acc + r.age, 0);
    const totalTenYearVolume = filteredRecords.reduce((acc, r) => acc + r.tenYearValue, 0);
    const plan5Count = filteredRecords.filter((r) => r.planPeriod === 5).length;
    const plan7Count = filteredRecords.filter((r) => r.planPeriod === 7).length;

    return {
      count,
      avgMonthly: Math.round(totalMonthly / count),
      avgAge: Math.round((totalAge / count) * 10) / 10,
      totalTenYearVolume,
      plan5Count,
      plan7Count,
    };
  }, [filteredRecords]);

  // Budget Tier Distribution
  const tierDistribution = useMemo(() => {
    const tiers = [
      { label: '10~30만원 (실속형)', min: 0, max: 30 },
      { label: '50만원 (BEST 주력)', min: 31, max: 50 },
      { label: '100만원 (전문직·사업자)', min: 51, max: 100 },
      { label: '150~200만원+ (프레스티지)', min: 101, max: 9999 },
    ];
    return tiers.map((t) => {
      const matched = filteredRecords.filter(
        (r) => r.monthlyAmount >= t.min && r.monthlyAmount <= t.max
      );
      return {
        label: t.label,
        count: matched.length,
        pct: filteredRecords.length ? Math.round((matched.length / filteredRecords.length) * 100) : 0,
      };
    });
  }, [filteredRecords]);

  // Age Band Average Contribution
  const ageSegments = useMemo(() => {
    const bands = [
      { label: '30대 (청년·신혼)', min: 20, max: 39 },
      { label: '40대 (자산증식 핵심)', min: 40, max: 49 },
      { label: '50대+ (은퇴·상속준비)', min: 50, max: 99 },
    ];
    return bands.map((b) => {
      const matched = filteredRecords.filter((r) => r.age >= b.min && r.age <= b.max);
      const avgAmt = matched.length
        ? Math.round(matched.reduce((s, r) => s + r.monthlyAmount, 0) / matched.length)
        : 0;
      return {
        label: b.label,
        count: matched.length,
        avgAmt,
      };
    });
  }, [filteredRecords]);

  const handleResetFilters = () => {
    setSearch('');
    setSourceFilter('all');
    setPlanFilter('all');
    setAgeFilter('all');
  };

  const handleSubmitNewLead = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;

    const proj = calculatePlanProjection(newPlan, newAmount, 0.154);
    const created: ClientRecord = {
      id: `LEAD-${Date.now().toString().slice(-4)}`,
      sourceType: 'live_lead',
      name: newName.trim(),
      age: Number(newAge) || 40,
      region: newRegion,
      occupation: newOccupation.trim() || `${newRegion} 신규 상담`,
      planPeriod: newPlan,
      monthlyAmount: newAmount,
      tenYearValue: proj.tenYearValue,
      statusLabel: '신규 배정 대기',
      timeLabel: '방금 추가',
    };

    onAddRecord(created);
    setSelectedRecord(created);
    setNewName('');
    setNewOccupation('');
    setIsAddModalOpen(false);
  };

  return (
    <div className="space-y-8">
      {/* Top Analytical Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
        <div className="bg-white rounded-2xl border border-[#06281B]/10 p-5">
          <span className="text-xs font-semibold text-[#58655E]">필터링된 고객·리드 표본</span>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-3xl font-extrabold text-[#06281B] font-mono tabular-nums">
              {stats.count}건
            </span>
            <span className="text-xs text-[#58655E] tabular-nums">
              일일 누적 142명 유입 중
            </span>
          </div>
          <p className="mt-3 text-xs text-[#58655E]">
            5년납 {stats.plan5Count}건 · 7년납 {stats.plan7Count}건
          </p>
        </div>

        <div className="bg-white rounded-2xl border border-[#06281B]/10 p-5">
          <span className="text-xs font-semibold text-[#58655E]">표본 평균 월 납입액</span>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-3xl font-extrabold text-[#835500] font-mono tabular-nums">
              {stats.avgMonthly.toLocaleString()}만원
            </span>
            <span className="text-xs font-bold text-[#0B4635] tabular-nums">
              평균 {stats.avgAge}세
            </span>
          </div>
          <p className="mt-3 text-xs text-[#58655E]">주력 선택 금액 50~100만원 집중</p>
        </div>

        <div className="bg-white rounded-2xl border border-[#06281B]/10 p-5">
          <span className="text-xs font-semibold text-[#58655E]">10년 누적 예상 환급 규모</span>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-3xl font-extrabold text-[#0B4635] font-mono tabular-nums">
              {formatKoreanMoney(stats.totalTenYearVolume, true)}
            </span>
            <span className="text-xs text-[#58655E]">확정 복리 합계</span>
          </div>
          <p className="mt-3 text-xs text-[#58655E]">표본 전체 10년 거치 시 수령 총액</p>
        </div>

        <div className="bg-[#06281B] text-white rounded-2xl border border-[#06281B] p-5">
          <span className="text-xs font-medium text-[#BBEED6]">설문 기반 전체 고객 평점</span>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-3xl font-extrabold text-[#FFC93C] font-mono tabular-nums">
              4.9 / 5.0
            </span>
            <span className="text-xs text-white/80 tabular-nums">2,840명 응답</span>
          </div>
          <p className="mt-3 text-xs text-[#BBEED6]/80">실명 인증 가입자 만족도 조사</p>
        </div>
      </div>

      {/* Distribution Analytics Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-6 bg-white rounded-2xl border border-[#06281B]/10 p-6">
          <h3 className="text-base font-extrabold text-[#111814] tracking-tight mb-1">
            월 납입금액 구간별 고객 분포
          </h3>
          <p className="text-xs text-[#58655E] mb-5">
            현재 필터 기준 각 예산 구간에 속한 고객 비중
          </p>
          <div className="space-y-4">
            {tierDistribution.map((tier) => (
              <div key={tier.label}>
                <div className="flex items-center justify-between text-xs mb-1.5">
                  <span className="font-semibold text-[#111814]">{tier.label}</span>
                  <span className="font-mono font-bold text-[#06281B] tabular-nums">
                    {tier.count}명 ({tier.pct}%)
                  </span>
                </div>
                <div className="h-2.5 w-full rounded-full bg-[#F4EFE6] overflow-hidden">
                  <div
                    className="h-full rounded-full bg-[#0B4635] transition-all duration-300"
                    style={{ width: `${tier.pct}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="lg:col-span-6 bg-white rounded-2xl border border-[#06281B]/10 p-6">
          <h3 className="text-base font-extrabold text-[#111814] tracking-tight mb-1">
            연령대별 평균 월 납입 여력 분석
          </h3>
          <p className="text-xs text-[#58655E] mb-5">
            30대(목돈마련) · 40대(절세·자산증식) · 50대+(은퇴자금) 비교
          </p>
          <div className="space-y-4">
            {ageSegments.map((seg) => {
              const barPct = Math.min(100, Math.round((seg.avgAmt / 200) * 100));
              return (
                <div key={seg.label}>
                  <div className="flex items-center justify-between text-xs mb-1.5">
                    <span className="font-semibold text-[#111814]">
                      {seg.label} ({seg.count}명)
                    </span>
                    <span className="font-mono font-bold text-[#835500] tabular-nums">
                      평균 월 {seg.avgAmt.toLocaleString()}만원
                    </span>
                  </div>
                  <div className="h-2.5 w-full rounded-full bg-[#F4EFE6] overflow-hidden">
                    <div
                      className="h-full rounded-full bg-[#FEAE2C] transition-all duration-300"
                      style={{ width: `${barPct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Filter Bar + Table + Detail Inspector */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        <div className="xl:col-span-8 bg-white rounded-2xl border border-[#06281B]/10 p-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-[#0B4635]" />
              <h3 className="text-lg font-extrabold text-[#111814] tracking-tight">
                고객 후기 및 실시간 상담 접수 레코드 ({filteredRecords.length})
              </h3>
            </div>
            <button
              type="button"
              onClick={() => setIsAddModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-[#FEAE2C] hover:bg-[#E09419] text-[#06281B] text-xs font-bold transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>신규 상담 데이터 추가</span>
            </button>
          </div>

          {/* Search & Segmented Filters */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3 mb-5">
            <div className="md:col-span-4 relative">
              <Search className="w-4 h-4 text-[#58655E] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="고객명, 직종, 지역 검색..."
                className="w-full pl-9 pr-3 py-2 rounded-lg border border-[#DCE5DD] text-xs bg-[#FBF9F4] focus:bg-white focus:outline-none focus:border-[#06281B]"
              />
            </div>

            <div className="md:col-span-3 flex p-1 rounded-lg bg-[#F4EFE6]">
              {(
                [
                  { key: 'all', label: '전체' },
                  { key: 'verified_review', label: '가입후기' },
                  { key: 'live_lead', label: '상담접수' },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => setSourceFilter(opt.key)}
                  className={`flex-1 py-1 px-2 text-xs font-bold rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                    sourceFilter === opt.key ? 'bg-[#06281B] text-white' : 'text-[#58655E]'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            <div className="md:col-span-2 flex p-1 rounded-lg bg-[#F4EFE6]">
              {(
                [
                  { key: 'all', label: '전체' },
                  { key: 5, label: '5년' },
                  { key: 7, label: '7년' },
                ] as const
              ).map((opt) => (
                <button
                  key={String(opt.key)}
                  type="button"
                  onClick={() => setPlanFilter(opt.key)}
                  className={`flex-1 py-1 px-2 text-xs font-bold rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                    planFilter === opt.key ? 'bg-[#06281B] text-white' : 'text-[#58655E]'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            <div className="md:col-span-3">
              <select
                value={ageFilter}
                onChange={(e) => setAgeFilter(e.target.value as 'all' | '30s' | '40s' | '50s')}
                className="w-full px-3 py-2 rounded-lg border border-[#DCE5DD] bg-white text-xs font-bold text-[#111814] focus:outline-none focus:border-[#06281B]"
              >
                <option value="all">연령대 전체</option>
                <option value="30s">30대 (30~39세)</option>
                <option value="40s">40대 (40~49세)</option>
                <option value="50s">50대 이상</option>
              </select>
            </div>
          </div>

          {/* Data Table or Empty State */}
          {filteredRecords.length === 0 ? (
            <div className="py-12 text-center border border-dashed border-[#DCE5DD] rounded-xl bg-[#FBF9F4]">
              <p className="text-sm font-bold text-[#111814]">조건에 일치하는 고객 레코드가 없습니다.</p>
              <p className="text-xs text-[#58655E] mt-1">
                검색어나 연령대·플랜 필터를 초기화하여 전체 16건의 데이터를 확인하세요.
              </p>
              <button
                type="button"
                onClick={handleResetFilters}
                className="mt-4 px-4 py-2 rounded-full bg-[#06281B] text-white text-xs font-bold cursor-pointer"
              >
                필터 초기화
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs sm:text-sm">
                <thead>
                  <tr className="border-b border-[#DCE5DD] text-xs font-bold text-[#58655E] bg-[#FBF9F4]">
                    <th className="py-2.5 px-3">고객명 · 연령</th>
                    <th className="py-2.5 px-3">구분 / 직종·지역</th>
                    <th className="py-2.5 px-3">플랜</th>
                    <th className="py-2.5 px-3 text-right">월 납입</th>
                    <th className="py-2.5 px-3 text-right">10년 확정액</th>
                    <th className="py-2.5 px-3">상태</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#DCE5DD]/60 tabular-nums">
                  {filteredRecords.map((rec) => {
                    const active = selectedRecord?.id === rec.id;
                    return (
                      <tr
                        key={rec.id}
                        onClick={() => setSelectedRecord(rec)}
                        className={`cursor-pointer transition-colors ${
                          active ? 'bg-[#EAF6EF]' : 'hover:bg-[#FBF9F4]'
                        }`}
                      >
                        <td className="py-3 px-3 font-bold text-[#111814] whitespace-nowrap">
                          {rec.name} <span className="text-xs font-normal text-[#58655E]">({rec.age}세)</span>
                        </td>
                        <td className="py-3 px-3 text-[#58655E]">
                          <span className="font-medium text-[#111814]">{rec.occupation}</span>
                          <span className="block text-[11px] text-[#58655E]">{rec.region}</span>
                        </td>
                        <td className="py-3 px-3 font-semibold text-[#06281B] whitespace-nowrap">
                          {rec.planPeriod}년납
                        </td>
                        <td className="py-3 px-3 text-right font-mono font-bold text-[#111814] whitespace-nowrap">
                          {rec.monthlyAmount}만원
                        </td>
                        <td className="py-3 px-3 text-right font-mono font-extrabold text-[#0B4635] whitespace-nowrap">
                          {formatKoreanMoney(rec.tenYearValue)}
                        </td>
                        <td className="py-3 px-3 text-xs text-[#58655E] whitespace-nowrap">
                          {rec.statusLabel}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Right Detail Inspector */}
        <div className="xl:col-span-4 bg-white rounded-2xl border border-[#06281B]/10 p-6">
          <h3 className="text-base font-extrabold text-[#111814] tracking-tight mb-4">
            선택 고객 상세 프로파일
          </h3>

          {selectedRecord ? (
            <div className="space-y-4">
              <div className="pb-4 border-b border-[#DCE5DD]">
                <div className="flex items-center justify-between">
                  <span className="text-lg font-extrabold text-[#06281B]">
                    {selectedRecord.name} ({selectedRecord.age}세)
                  </span>
                  <span className="text-xs font-bold text-[#835500]">
                    {selectedRecord.sourceType === 'verified_review' ? '가입 확정 후기' : '실시간 상담 접수'}
                  </span>
                </div>
                <p className="text-xs text-[#58655E] mt-1">
                  {selectedRecord.occupation} · {selectedRecord.region} · {selectedRecord.timeLabel}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-3 rounded-xl bg-[#FBF9F4] border border-[#DCE5DD]">
                  <span className="text-[#58655E] block">선택 플랜</span>
                  <span className="text-sm font-extrabold text-[#111814] mt-0.5 block">
                    {selectedRecord.planPeriod}년 납입 / 월 {selectedRecord.monthlyAmount}만원
                  </span>
                </div>
                <div className="p-3 rounded-xl bg-[#EAF6EF] border border-[#0B4635]/15">
                  <span className="text-[#0B4635] block">10년 확정 수령액</span>
                  <span className="text-sm font-extrabold text-[#06281B] font-mono tabular-nums mt-0.5 block">
                    {formatKoreanMoney(selectedRecord.tenYearValue)}
                  </span>
                </div>
              </div>

              {selectedRecord.quote ? (
                <div className="p-4 rounded-xl bg-[#FBF9F4] border border-[#DCE5DD]">
                  <span className="text-[11px] font-bold text-[#58655E] block mb-1.5">
                    가입 동기 및 분석 코멘트
                  </span>
                  <p className="text-xs text-[#111814] leading-relaxed">"{selectedRecord.quote}"</p>
                </div>
              ) : (
                <div className="p-4 rounded-xl bg-[#FBF9F4] border border-[#DCE5DD]">
                  <span className="text-[11px] font-bold text-[#58655E] block mb-1">
                    진행 상태
                  </span>
                  <p className="text-xs font-semibold text-[#06281B]">
                    {selectedRecord.statusLabel} — 전 금융사 {selectedRecord.planPeriod}년납 환급률 비교표 및 비과세 세무 분석 배정 대상
                  </p>
                </div>
              )}
            </div>
          ) : (
            <p className="text-xs text-[#58655E]">좌측 테이블에서 고객 행을 클릭하면 상세 분석 내용을 확인할 수 있습니다.</p>
          )}
        </div>
      </div>

      {/* Add New Lead Modal */}
      {isAddModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-md bg-white rounded-2xl border border-[#06281B]/15 p-6 shadow-xl">
            <div className="flex items-center justify-between pb-3 border-b border-[#DCE5DD] mb-5">
              <h4 className="text-base font-extrabold text-[#111814]">신규 상담 신청 데이터 추가</h4>
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="p-1.5 rounded-lg text-[#58655E] hover:text-[#111814] cursor-pointer"
                aria-label="닫기"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmitNewLead} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-[#111814] mb-1">고객 성함</label>
                  <input
                    type="text"
                    required
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="예: 홍*동"
                    className="w-full px-3 py-2 rounded-lg border border-[#DCE5DD] text-sm focus:outline-none focus:border-[#06281B]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#111814] mb-1">연령 (세)</label>
                  <input
                    type="number"
                    min={1}
                    max={70}
                    value={newAge}
                    onChange={(e) => setNewAge(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-lg border border-[#DCE5DD] text-sm font-mono focus:outline-none focus:border-[#06281B]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-[#111814] mb-1">거주 지역</label>
                  <select
                    value={newRegion}
                    onChange={(e) => setNewRegion(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-[#DCE5DD] text-sm bg-white focus:outline-none focus:border-[#06281B]"
                  >
                    <option>서울특별시</option>
                    <option>경기도 / 인천</option>
                    <option>부산 / 울산 / 경남</option>
                    <option>대구 / 경북</option>
                    <option>대전 / 세종 / 충청</option>
                    <option>광주 / 전라</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#111814] mb-1">직업 / 메모</label>
                  <input
                    type="text"
                    value={newOccupation}
                    onChange={(e) => setNewOccupation(e.target.value)}
                    placeholder="예: 전문직 / 법인대표"
                    className="w-full px-3 py-2 rounded-lg border border-[#DCE5DD] text-sm focus:outline-none focus:border-[#06281B]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-[#111814] mb-1">희망 납입기간</label>
                  <select
                    value={newPlan}
                    onChange={(e) => setNewPlan(Number(e.target.value) as PlanPeriod)}
                    className="w-full px-3 py-2 rounded-lg border border-[#DCE5DD] text-sm bg-white focus:outline-none focus:border-[#06281B]"
                  >
                    <option value={5}>5년 납입 (120.4%)</option>
                    <option value={7}>7년 납입 (122.5%)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#111814] mb-1">월 납입금액</label>
                  <select
                    value={newAmount}
                    onChange={(e) => setNewAmount(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-lg border border-[#DCE5DD] text-sm bg-white font-mono focus:outline-none focus:border-[#06281B]"
                  >
                    <option value={10}>10만원</option>
                    <option value={30}>30만원</option>
                    <option value={50}>50만원</option>
                    <option value={100}>100만원</option>
                    <option value={150}>150만원</option>
                    <option value={200}>200만원</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#DCE5DD]">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 rounded-full border border-[#DCE5DD] text-xs font-bold text-[#58655E] hover:text-[#111814] cursor-pointer"
                >
                  취소
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-full bg-[#FEAE2C] hover:bg-[#E09419] text-[#06281B] text-xs font-bold cursor-pointer"
                >
                  파이프라인에 등록
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
