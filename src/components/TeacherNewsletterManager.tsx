import React, { useState } from 'react';
import { useClassEconomy } from '../context/ClassEconomyContext';
import { NewsArticle } from '../types';

interface PresetTemplate {
  name: string;
  badge: string;
  category: 'stock' | 'policy' | 'economy' | 'class' | 'special';
  impact: 'positive' | 'negative' | 'neutral';
  isBreaking?: boolean;
  title: string;
  summary: string;
  content: string;
  author: string;
  stockKeyword?: string;
}

export const TeacherNewsletterManager: React.FC = () => {
  const { state, publishNewsArticle, updateNewsArticle, deleteNewsArticle, publishNews } = useClassEconomy();

  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<'stock' | 'policy' | 'economy' | 'class' | 'special'>('economy');
  const [impact, setImpact] = useState<'positive' | 'negative' | 'neutral'>('neutral');
  const [selectedStockId, setSelectedStockId] = useState<string>('');
  const [isBreaking, setIsBreaking] = useState(false);
  const [author, setAuthor] = useState(state.teacherName ? `${state.teacherName} 선생님` : '학급경제신문');
  const [summary, setSummary] = useState('');
  const [content, setContent] = useState('');

  const [editingArticle, setEditingArticle] = useState<NewsArticle | null>(null);
  const [successToast, setSuccessToast] = useState<string | null>(null);

  const presets: PresetTemplate[] = [
    {
      name: '🤖 AI·IT 신기술 지원',
      badge: '테크 호재',
      category: 'stock',
      impact: 'positive',
      isBreaking: true,
      stockKeyword: '테크',
      title: '정부, 미래 인공지능(AI) 및 차세대 소프트웨어 육성에 1조 원 지원 확정',
      summary: '정부의 대규모 AI 육성 정책으로 IT 테크 기업들의 수혜가 기대되며 실적 전망치가 대폭 상향되었습니다.',
      content: `[학급경제신문 = IT산업부] 정부가 오늘 차세대 인공지능과 클라우드 플랫폼 육성을 위해 대규모 지원 펀드를 조성한다고 공식 발표했습니다.\n\n이에 따라 소프트웨어 개발과 첨단 IT 솔루션을 공급하는 대표 기업들의 신규 수주 및 매출이 급증할 것으로 기대됩니다. 투자자들의 매수세가 집중되고 있습니다.`,
      author: '학급경제신문 IT전문기자'
    },
    {
      name: '💊 바이오 신약 3상 승인',
      badge: '바이오 호재',
      category: 'stock',
      impact: 'positive',
      isBreaking: false,
      stockKeyword: '바이오',
      title: '바이오헬스, 혁신 신약 글로벌 임상 3상 시험 최종 승인 획득',
      summary: '신약 개발 파이프라인의 핵심 신약이 3상 시험을 통과하며 기술 수출 계약에 청신호가 켜졌습니다.',
      content: `[학급경제신문 = 바이오제약팀] 바이오헬스가 다년간 집중 개발해 온 혁신 신약 물질이 글로벌 보건당국으로부터 3상 임상시험 최종 승인을 획득했습니다.\n\n전문가들은 이번 승인으로 글로벌 라이선스 아웃 및 상용화 가능성이 매우 높아졌다고 평가했습니다.`,
      author: '신약개발 전문기자'
    },
    {
      name: '☀️ 친환경 신재생 수주',
      badge: '신재생 호재',
      category: 'stock',
      impact: 'positive',
      isBreaking: false,
      stockKeyword: '신재생',
      title: '신재생그린, 정부 탄소중립 프로젝트 대규모 태양광·풍력 단지 단독 수주',
      summary: '친환경 에너지 전환 정책 가속화로 신재생 인프라 공급 계약이 체결되었습니다.',
      content: `[학급일보 = 에너지산업부] 친환경 에너지 솔루션 대표 기업 신재생그린이 정부의 2050 탄소중립 로드맵에 따른 대형 신재생 인프라 단지 건설을 수주했습니다.\n\n친환경 ESG 투자자들의 기대감이 한층 높아지고 있습니다.`,
      author: '에너지산업 전문기자'
    },
    {
      name: '📉 원자재 공급난 악재',
      badge: '제조업 악재',
      category: 'stock',
      impact: 'negative',
      isBreaking: true,
      stockKeyword: '제조',
      title: '글로벌 원자재 가격 급등… 제조업계 단기 영업이익률 하락 불가피',
      summary: '국제 원자재 및 부품 가격 급등으로 제조 기업들의 원가 부담이 가중되고 있습니다.',
      content: `[학급경제신문 = 거시경제부] 글로벌 공급망 차질로 인해 주요 원자재 가격이 20% 이상 폭등하면서 제조업 관련 기업들의 단기 실적 둔화가 우려됩니다.\n\n증권가에서는 당분간 변동성에 대비한 리스크 관리가 필요하다고 조언했습니다.`,
      author: '원자재분석 전문기자'
    },
    {
      name: '🏦 기준금리 인상 단행',
      badge: '예금 금리↑',
      category: 'policy',
      impact: 'neutral',
      isBreaking: false,
      title: '중앙은행, 물가 안정 위해 정기예금 기준금리 인상 전격 단행',
      summary: '중앙은행이 시중 유동성을 조절하고 저축을 장려하기 위해 예금 금리를 인상했습니다.',
      content: `[한국은행 경제연구원] 중앙은행 금융통화위원회가 인플레이션 억제와 건전한 자산 형성을 유도하기 위해 이번 회차부터 정기예금 금리를 인상하기로 결정했습니다.\n\n안정적인 이자 수익을 선호하는 학생들은 은행 저축 비중을 높이는 전략이 권장됩니다.`,
      author: '한국은행 금융통화연구팀'
    },
    {
      name: '🛒 학급 마켓 깜짝 세일',
      badge: '학급 이벤트',
      category: 'class',
      impact: 'positive',
      isBreaking: false,
      title: '선생님과 함께하는 학급 상점 전 품목 깜짝 할인 페스티벌 개최!',
      summary: '열심히 경제 활동에 참여한 학생들을 위해 인기 쿠폰 및 상품을 할인 판매합니다.',
      content: `[학급 알림마당] 우리반 경제 활동 우수 참여 학생들을 격려하기 위해 이번 라운드 동안 상점의 모든 아이템이 특별 할인된 가격으로 공급됩니다.\n\n보유 중인 현금을 활용하여 필요한 쿠폰을 알뜰하게 구매해 보세요!`,
      author: `${state.teacherName || '선생님'} 알림`
    }
  ];

  const handleApplyPreset = (preset: PresetTemplate) => {
    setTitle(preset.title);
    setCategory(preset.category);
    setImpact(preset.impact);
    setIsBreaking(!!preset.isBreaking);
    setAuthor(preset.author);
    setSummary(preset.summary);
    setContent(preset.content);

    if (preset.stockKeyword) {
      const match = state.stocks.find(s => s.name.includes(preset.stockKeyword!) || s.category.includes(preset.stockKeyword!));
      if (match) {
        setSelectedStockId(match.id);
      }
    } else {
      setSelectedStockId('');
    }

    setSuccessToast(`💡 '${preset.name}' 템플릿이 입력창에 자동 적용되었습니다.`);
    setTimeout(() => setSuccessToast(null), 3000);
  };

  const handlePublish = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) {
      alert('기사 제목과 본문을 입력해 주세요.');
      return;
    }

    const selectedStock = state.stocks.find(s => s.id === selectedStockId);

    publishNewsArticle({
      title: title.trim(),
      content: content.trim(),
      summary: summary.trim() || content.trim().slice(0, 100) + '...',
      category,
      relatedStockId: selectedStockId || undefined,
      relatedStockName: selectedStock ? selectedStock.name : undefined,
      impact,
      isBreaking,
      author: author.trim() || (state.teacherName ? `${state.teacherName} 선생님` : '학급경제신문')
    });

    setSuccessToast('🎉 뉴스가 성공적으로 배급되었습니다! 모든 학생 화면에 실시간 전달됩니다.');
    setTimeout(() => setSuccessToast(null), 4000);

    // Reset Form
    setTitle('');
    setSummary('');
    setContent('');
    setIsBreaking(false);
    setSelectedStockId('');
  };

  const handleUpdate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingArticle || !editingArticle.title.trim() || !editingArticle.content.trim()) {
      return;
    }

    updateNewsArticle(editingArticle);
    setEditingArticle(null);
    setSuccessToast('✅ 기사가 성공적으로 수정되었습니다.');
    setTimeout(() => setSuccessToast(null), 3000);
  };

  const articles = state.newsArticles || [];

  return (
    <div className="space-y-8">
      {/* Toast Notification */}
      {successToast && (
        <div className="p-3 bg-emerald-100 border-2 border-emerald-600 text-emerald-950 font-bold text-xs rounded-2xs flex items-center gap-2 animate-in fade-in">
          <span className="material-symbols-outlined text-lg text-emerald-800">check_circle</span>
          <span>{successToast}</span>
        </div>
      )}

      {/* Header Info */}
      <div className="bg-[#1a1a1a] text-white p-5 rounded-sm flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="material-symbols-outlined text-amber-400 text-2xl">newspaper</span>
            <h2 className="font-editorial text-2xl font-bold">학급 뉴스룸 & 경제 뉴스 배급 센터</h2>
          </div>
          <p className="text-xs text-stone-300">
            학생들에게 실시간 경제 뉴스, 주식 시장 호재/악재, 금리 변동 소식을 배급하여 살아있는 경제 교육을 진행하세요.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-right">
            <span className="text-[10px] uppercase font-mono text-stone-400 block">현재 배급된 기사</span>
            <span className="font-mono text-xl font-bold text-amber-400">{articles.length}건</span>
          </div>
          <div className="h-8 w-px bg-white/20"></div>
          <div className="text-right">
            <span className="text-[10px] uppercase font-mono text-stone-400 block">현재 발행 회차</span>
            <span className="font-mono text-xl font-bold text-white">Round {state.currentRound}</span>
          </div>
        </div>
      </div>

      {/* 1-Click Preset Templates */}
      <div className="bg-[#faf8f5] p-5 rounded-sm border border-[#1a1a1a]/15 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-editorial text-base font-bold text-[#1a1a1a] flex items-center gap-1.5">
            <span className="material-symbols-outlined text-[18px] text-amber-700">bolt</span>
            1-Click 추천 뉴스 템플릿 (클릭 시 자동 작성)
          </h3>
          <span className="text-[11px] text-stone-500 font-mono">클릭 후 즉시 배급 가능</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
          {presets.map((preset, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => handleApplyPreset(preset)}
              className="p-2.5 bg-white border border-[#1a1a1a]/15 hover:border-[#1a1a1a] hover:bg-stone-50 rounded-2xs text-left transition-all shadow-2xs group flex flex-col justify-between h-24"
            >
              <div>
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-2xs bg-stone-100 text-stone-700 border border-stone-200 group-hover:bg-amber-100 group-hover:text-amber-900 group-hover:border-amber-300 transition-colors inline-block mb-1">
                  {preset.badge}
                </span>
                <p className="text-xs font-bold text-[#1a1a1a] line-clamp-2 leading-tight">
                  {preset.name}
                </p>
              </div>
              <span className="text-[10px] text-stone-400 group-hover:text-[#1a1a1a] font-mono">
                템플릿 적용 →
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* News Publishing Form */}
      <form onSubmit={handlePublish} className="bg-white p-6 rounded-sm border-2 border-[#1a1a1a] shadow-xs space-y-5">
        <div className="flex items-center justify-between border-b border-[#1a1a1a]/15 pb-3">
          <h3 className="font-editorial text-lg font-bold text-[#1a1a1a] flex items-center gap-2">
            <span className="material-symbols-outlined text-xl">edit_document</span>
            수시 경제 뉴스 작성 및 배급
          </h3>
          <label className="flex items-center gap-2 cursor-pointer bg-rose-50 px-3 py-1 rounded-2xs border border-rose-200 hover:bg-rose-100 transition-colors">
            <input
              type="checkbox"
              checked={isBreaking}
              onChange={e => setIsBreaking(e.target.checked)}
              className="rounded-2xs text-rose-600 focus:ring-rose-500"
            />
            <span className="text-xs font-bold text-rose-700 flex items-center gap-1">
              🚨 긴급 속보로 지정 (학생 화면 상단 강조)
            </span>
          </label>
        </div>

        {/* Row 1: Title */}
        <div>
          <label className="block text-xs font-bold text-[#1a1a1a] mb-1">
            기사 헤드라인 제목 <span className="text-rose-600">*</span>
          </label>
          <input
            type="text"
            required
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="예: 정부, AI 소프트웨어 육성에 1조 원 지원 확정! 관련 기술주 상승세"
            className="w-full px-3 py-2 bg-white border border-[#1a1a1a]/20 rounded-2xs text-sm font-bold text-[#1a1a1a] focus:border-[#1a1a1a] focus:ring-0"
          />
        </div>

        {/* Row 2: Category, Related Stock, Impact, Author */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          <div>
            <label className="block text-xs font-bold text-[#1a1a1a] mb-1">기사 분야 (카테고리)</label>
            <select
              value={category}
              onChange={e => setCategory(e.target.value as any)}
              className="w-full px-3 py-2 bg-white border border-[#1a1a1a]/20 rounded-2xs text-xs font-bold text-[#1a1a1a] focus:border-[#1a1a1a] focus:ring-0"
            >
              <option value="economy">🏛️ 거시경제</option>
              <option value="stock">📈 기업·증시</option>
              <option value="policy">🏦 금융·금리정책</option>
              <option value="class">🏫 학급소식·이벤트</option>
              <option value="special">🚨 특종·기획</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-[#1a1a1a] mb-1">연관 주식 종목 (선택)</label>
            <select
              value={selectedStockId}
              onChange={e => setSelectedStockId(e.target.value)}
              className="w-full px-3 py-2 bg-white border border-[#1a1a1a]/20 rounded-2xs text-xs font-bold text-[#1a1a1a] focus:border-[#1a1a1a] focus:ring-0"
            >
              <option value="">-- 연관 종목 없음 --</option>
              {state.stocks.map(s => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.currentPrice.toLocaleString()}{state.currencyUnit || '원'})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-[#1a1a1a] mb-1">시장 영향도</label>
            <select
              value={impact}
              onChange={e => setImpact(e.target.value as any)}
              className="w-full px-3 py-2 bg-white border border-[#1a1a1a]/20 rounded-2xs text-xs font-bold text-[#1a1a1a] focus:border-[#1a1a1a] focus:ring-0"
            >
              <option value="positive">호재 (▲ 주가/경기 긍정)</option>
              <option value="negative">악재 (▼ 주가/경기 부정)</option>
              <option value="neutral">중립 (─ 정보/정책성)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-[#1a1a1a] mb-1">작성자 / 발행처</label>
            <input
              type="text"
              value={author}
              onChange={e => setAuthor(e.target.value)}
              placeholder="예: 학급경제신문 기자, 선생님"
              className="w-full px-3 py-2 bg-white border border-[#1a1a1a]/20 rounded-2xs text-xs text-[#1a1a1a] focus:border-[#1a1a1a] focus:ring-0"
            />
          </div>
        </div>

        {/* Row 3: Summary */}
        <div>
          <label className="block text-xs font-bold text-[#1a1a1a] mb-1">
            핵심 요약문 (학생 목록 카드에 노출)
          </label>
          <input
            type="text"
            value={summary}
            onChange={e => setSummary(e.target.value)}
            placeholder="기사의 핵심 요점을 1~2문장으로 간결하게 작성하세요."
            className="w-full px-3 py-2 bg-white border border-[#1a1a1a]/20 rounded-2xs text-xs text-[#1a1a1a] focus:border-[#1a1a1a] focus:ring-0"
          />
        </div>

        {/* Row 4: Full Content */}
        <div>
          <label className="block text-xs font-bold text-[#1a1a1a] mb-1">
            기사 상세 본문 <span className="text-rose-600">*</span>
          </label>
          <textarea
            required
            rows={5}
            value={content}
            onChange={e => setContent(e.target.value)}
            placeholder="상세한 경제 기사 내용을 신문 기사 형식으로 자유롭게 작성하세요."
            className="w-full px-3 py-2 bg-white border border-[#1a1a1a]/20 rounded-2xs text-xs font-serif text-[#1a1a1a] focus:border-[#1a1a1a] focus:ring-0 leading-relaxed"
          />
        </div>

        {/* Submit Actions */}
        <div className="flex items-center justify-between pt-2 border-t border-[#1a1a1a]/10">
          <span className="text-xs text-stone-500">
            💡 배급 시 모든 학생 대시보드 상단 헤드라인 및 뉴스레터 창에 즉시 동기화됩니다.
          </span>
          <button
            type="submit"
            className="px-6 py-2.5 bg-[#1a1a1a] hover:bg-stone-800 text-white font-bold text-sm rounded-2xs shadow-xs transition-colors flex items-center gap-1.5"
          >
            <span className="material-symbols-outlined text-[18px]">send</span>
            전체 학생에게 즉시 뉴스 배급하기
          </button>
        </div>
      </form>

      {/* Published News Articles List */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-editorial text-xl font-bold text-[#1a1a1a]">
            발행된 학급 뉴스 아카이브 ({articles.length}건)
          </h3>
          <span className="text-xs text-stone-500">
            기사를 수정하거나 삭제, 또는 상단 전광판 알림으로 즉각 재지정할 수 있습니다.
          </span>
        </div>

        {articles.length === 0 ? (
          <div className="p-8 text-center bg-white rounded-sm border border-[#1a1a1a]/15 text-stone-400">
            <span className="material-symbols-outlined text-4xl mb-2">article</span>
            <p className="text-sm font-bold text-[#1a1a1a]">발행된 뉴스가 없습니다</p>
            <p className="text-xs mt-1">상단의 추천 템플릿 또는 직접 작성하여 첫 번째 뉴스를 배급해 보세요.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {articles.map((article) => {
              return (
                <div
                  key={article.id}
                  className="bg-white p-4 rounded-sm border border-[#1a1a1a]/15 hover:border-[#1a1a1a]/40 transition-all flex flex-col md:flex-row md:items-center justify-between gap-4"
                >
                  <div className="space-y-1.5 flex-1">
                    <div className="flex flex-wrap items-center gap-2 text-xs font-mono">
                      {article.isBreaking && (
                        <span className="bg-rose-600 text-white font-bold text-[9px] px-1.5 py-0.5 rounded-2xs animate-pulse">
                          🚨 속보
                        </span>
                      )}
                      <span className="bg-stone-100 text-stone-800 font-bold text-[10px] px-2 py-0.5 rounded-2xs border border-stone-200">
                        {article.category === 'stock' ? '📈 기업·증시' : article.category === 'policy' ? '🏦 금융·금리' : article.category === 'class' ? '🏫 학급소식' : '🏛️ 거시경제'}
                      </span>
                      {article.impact === 'positive' && (
                        <span className="bg-emerald-100 text-emerald-800 font-bold text-[10px] px-1.5 py-0.5 rounded-2xs border border-emerald-200">
                          호재 ▲
                        </span>
                      )}
                      {article.impact === 'negative' && (
                        <span className="bg-rose-100 text-rose-800 font-bold text-[10px] px-1.5 py-0.5 rounded-2xs border border-rose-200">
                          악재 ▼
                        </span>
                      )}
                      <span className="text-[#1a1a1a]/50">
                        Round {article.publishedRound} · {article.publishedAt}
                      </span>
                      <span className="text-[#1a1a1a]/50">· 기자: {article.author}</span>
                      {article.relatedStockName && (
                        <span className="bg-blue-50 text-blue-900 font-bold text-[10px] px-2 py-0.5 rounded-2xs border border-blue-200">
                          연관: {article.relatedStockName}
                        </span>
                      )}
                    </div>

                    <h4 className="font-editorial text-base font-bold text-[#1a1a1a]">
                      {article.title}
                    </h4>

                    <p className="text-xs text-stone-600 line-clamp-2 font-serif leading-relaxed">
                      {article.summary || article.content}
                    </p>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 flex-shrink-0 self-end md:self-center">
                    <button
                      type="button"
                      onClick={() => {
                        publishNews(article.title);
                        setSuccessToast(`📢 '${article.title}' 기사가 실시간 상단 전광판 알림으로 갱신되었습니다.`);
                        setTimeout(() => setSuccessToast(null), 3000);
                      }}
                      className="px-2.5 py-1.5 bg-stone-100 hover:bg-stone-200 text-[#1a1a1a] text-xs font-bold rounded-2xs border border-[#1a1a1a]/15 transition-colors flex items-center gap-1"
                      title="실시간 상단 전광판 알림으로 띄우기"
                    >
                      <span className="material-symbols-outlined text-[15px]">campaign</span>
                      전광판 알림
                    </button>

                    <button
                      type="button"
                      onClick={() => setEditingArticle(article)}
                      className="px-2.5 py-1.5 bg-[#faf8f5] hover:bg-stone-200 text-[#1a1a1a] text-xs font-bold rounded-2xs border border-[#1a1a1a]/15 transition-colors flex items-center gap-1"
                    >
                      <span className="material-symbols-outlined text-[15px]">edit</span>
                      수정
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        if (confirm(`'${article.title}' 기사를 삭제하시겠습니까?`)) {
                          deleteNewsArticle(article.id);
                          setSuccessToast('🗑️ 기사가 삭제되었습니다.');
                          setTimeout(() => setSuccessToast(null), 3000);
                        }
                      }}
                      className="px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold rounded-2xs border border-rose-200 transition-colors flex items-center gap-1"
                    >
                      <span className="material-symbols-outlined text-[15px]">delete</span>
                      삭제
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Edit Article Modal */}
      {editingArticle && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <form
            onSubmit={handleUpdate}
            className="bg-white rounded-sm max-w-xl w-full p-6 space-y-4 border-2 border-[#1a1a1a] shadow-2xl animate-in fade-in"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-[#1a1a1a]/15 pb-2">
              <h3 className="font-editorial text-lg font-bold text-[#1a1a1a]">
                기사 내용 수정
              </h3>
              <button
                type="button"
                onClick={() => setEditingArticle(null)}
                className="p-1 rounded-2xs hover:bg-stone-100"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>

            <div>
              <label className="block text-xs font-bold text-[#1a1a1a] mb-1">헤드라인 제목</label>
              <input
                type="text"
                required
                value={editingArticle.title}
                onChange={e => setEditingArticle({ ...editingArticle, title: e.target.value })}
                className="w-full px-3 py-2 bg-white border border-[#1a1a1a]/20 rounded-2xs text-xs font-bold text-[#1a1a1a]"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-[#1a1a1a] mb-1">카테고리</label>
                <select
                  value={editingArticle.category}
                  onChange={e => setEditingArticle({ ...editingArticle, category: e.target.value as any })}
                  className="w-full px-3 py-2 bg-white border border-[#1a1a1a]/20 rounded-2xs text-xs font-bold text-[#1a1a1a]"
                >
                  <option value="economy">🏛️ 거시경제</option>
                  <option value="stock">📈 기업·증시</option>
                  <option value="policy">🏦 금융·금리정책</option>
                  <option value="class">🏫 학급소식·이벤트</option>
                  <option value="special">🚨 특종·기획</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#1a1a1a] mb-1">시장 영향</label>
                <select
                  value={editingArticle.impact || 'neutral'}
                  onChange={e => setEditingArticle({ ...editingArticle, impact: e.target.value as any })}
                  className="w-full px-3 py-2 bg-white border border-[#1a1a1a]/20 rounded-2xs text-xs font-bold text-[#1a1a1a]"
                >
                  <option value="positive">호재 (▲)</option>
                  <option value="negative">악재 (▼)</option>
                  <option value="neutral">중립 (─)</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-[#1a1a1a] mb-1">핵심 요약</label>
              <input
                type="text"
                value={editingArticle.summary || ''}
                onChange={e => setEditingArticle({ ...editingArticle, summary: e.target.value })}
                className="w-full px-3 py-2 bg-white border border-[#1a1a1a]/20 rounded-2xs text-xs text-[#1a1a1a]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-[#1a1a1a] mb-1">기사 본문</label>
              <textarea
                rows={5}
                required
                value={editingArticle.content}
                onChange={e => setEditingArticle({ ...editingArticle, content: e.target.value })}
                className="w-full px-3 py-2 bg-white border border-[#1a1a1a]/20 rounded-2xs text-xs font-serif text-[#1a1a1a]"
              />
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-[#1a1a1a]/15">
              <label className="flex items-center gap-1.5 cursor-pointer text-xs font-bold text-rose-700">
                <input
                  type="checkbox"
                  checked={!!editingArticle.isBreaking}
                  onChange={e => setEditingArticle({ ...editingArticle, isBreaking: e.target.checked })}
                  className="rounded-2xs text-rose-600"
                />
                🚨 속보 지정
              </label>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setEditingArticle(null)}
                  className="px-3 py-1.5 bg-stone-100 hover:bg-stone-200 text-[#1a1a1a] text-xs font-bold rounded-2xs"
                >
                  취소
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-[#1a1a1a] hover:bg-stone-800 text-white text-xs font-bold rounded-2xs"
                >
                  수정 저장
                </button>
              </div>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
