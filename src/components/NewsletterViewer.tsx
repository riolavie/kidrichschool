import React, { useState, useMemo } from 'react';
import { useClassEconomy } from '../context/ClassEconomyContext';
import { NewsArticle, StockInfo } from '../types';

interface NewsletterViewerProps {
  onOpenStockModal?: (stockId: string) => void;
  isModal?: boolean;
  onClose?: () => void;
}

export const NewsletterViewer: React.FC<NewsletterViewerProps> = ({
  onOpenStockModal,
  isModal = false,
  onClose
}) => {
  const { state } = useClassEconomy();
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedRound, setSelectedRound] = useState<number | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [activeArticle, setActiveArticle] = useState<NewsArticle | null>(null);

  const articles: NewsArticle[] = useMemo(() => {
    return state.newsArticles || [];
  }, [state.newsArticles]);

  const filteredArticles = useMemo(() => {
    return articles.filter(article => {
      // Category filter
      if (selectedCategory === 'breaking' && !article.isBreaking) return false;
      if (selectedCategory !== 'all' && selectedCategory !== 'breaking' && article.category !== selectedCategory) return false;
      
      // Round filter
      if (selectedRound !== 'all' && article.publishedRound !== selectedRound) return false;

      // Search filter
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchTitle = article.title.toLowerCase().includes(query);
        const matchContent = article.content.toLowerCase().includes(query);
        const matchStock = article.relatedStockName?.toLowerCase().includes(query);
        const matchAuthor = article.author?.toLowerCase().includes(query);
        if (!matchTitle && !matchContent && !matchStock && !matchAuthor) return false;
      }

      return true;
    });
  }, [articles, selectedCategory, selectedRound, searchQuery]);

  // Find featured/hero article
  const heroArticle = useMemo(() => {
    if (selectedCategory !== 'all' || selectedRound !== 'all' || searchQuery.trim()) {
      return null;
    }
    return articles.find(a => a.isBreaking) || articles[0] || null;
  }, [articles, selectedCategory, selectedRound, searchQuery]);

  const listArticles = useMemo(() => {
    if (heroArticle && selectedCategory === 'all' && selectedRound === 'all' && !searchQuery.trim()) {
      return filteredArticles.filter(a => a.id !== heroArticle.id);
    }
    return filteredArticles;
  }, [filteredArticles, heroArticle, selectedCategory, selectedRound, searchQuery]);

  // Available rounds in articles
  const availableRounds = useMemo(() => {
    const rounds = Array.from(new Set(articles.map(a => a.publishedRound))).sort((a, b) => b - a);
    return rounds;
  }, [articles]);

  const getCategoryBadge = (category: string) => {
    switch (category) {
      case 'stock':
        return { label: '기업·증시', color: 'bg-blue-100 text-blue-900 border-blue-200' };
      case 'policy':
        return { label: '금융·금리', color: 'bg-purple-100 text-purple-900 border-purple-200' };
      case 'economy':
        return { label: '거시경제', color: 'bg-emerald-100 text-emerald-900 border-emerald-200' };
      case 'class':
        return { label: '학급소식', color: 'bg-amber-100 text-amber-900 border-amber-200' };
      case 'special':
        return { label: '특종·기획', color: 'bg-rose-100 text-rose-900 border-rose-200' };
      default:
        return { label: '일반경제', color: 'bg-stone-100 text-stone-800 border-stone-200' };
    }
  };

  const getImpactBadge = (impact?: 'positive' | 'negative' | 'neutral') => {
    if (impact === 'positive') {
      return <span className="inline-flex items-center text-[10px] font-bold font-mono px-1.5 py-0.5 rounded-2xs bg-emerald-100 text-emerald-800 border border-emerald-300">호재 ▲</span>;
    }
    if (impact === 'negative') {
      return <span className="inline-flex items-center text-[10px] font-bold font-mono px-1.5 py-0.5 rounded-2xs bg-rose-100 text-rose-800 border border-rose-300">악재 ▼</span>;
    }
    return <span className="inline-flex items-center text-[10px] font-bold font-mono px-1.5 py-0.5 rounded-2xs bg-stone-100 text-stone-600 border border-stone-200">중립 ─</span>;
  };

  const findStock = (stockId?: string): StockInfo | undefined => {
    if (!stockId) return undefined;
    return state.stocks.find(s => s.id === stockId);
  };

  const content = (
    <div className="space-y-6">
      {/* Newspaper Header */}
      <div className="border-b-2 border-[#1a1a1a] pb-4">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#1a1a1a]/20 pb-2 mb-3 text-xs font-mono text-[#1a1a1a]/70">
          <div className="flex items-center gap-3">
            <span className="font-bold text-[#1a1a1a]">제 {state.currentRound}호</span>
            <span>|</span>
            <span>발행일: {new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })}</span>
            <span>|</span>
            <span>학급: <strong>{state.className}</strong></span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-2xs border border-emerald-200">
              ● 실시간 경제 뉴스룸
            </span>
            {isModal && onClose && (
              <button
                onClick={onClose}
                className="p-1 rounded-2xs hover:bg-stone-200 text-[#1a1a1a] transition-colors ml-2"
                title="닫기"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            )}
          </div>
        </div>

        <div className="text-center py-2">
          <h1 className="font-editorial text-3xl sm:text-4xl font-bold tracking-tight text-[#1a1a1a]">
            학급 경제 신문 & 뉴스레터
          </h1>
          <p className="text-xs font-serif text-[#1a1a1a]/70 italic mt-1">
            "시장의 흐름을 읽고 지혜로운 금융 의사결정을 내리는 어린이 경제 리더의 소식지"
          </p>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-[#faf8f5] p-3 rounded-2xs border border-[#1a1a1a]/15 flex flex-wrap items-center justify-between gap-3">
        {/* Category Pills */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            onClick={() => setSelectedCategory('all')}
            className={`px-3 py-1 text-xs font-bold rounded-2xs transition-all ${
              selectedCategory === 'all'
                ? 'bg-[#1a1a1a] text-white shadow-2xs'
                : 'bg-white border border-[#1a1a1a]/15 text-[#1a1a1a]/70 hover:bg-stone-100'
            }`}
          >
            전체 ({articles.length})
          </button>
          <button
            onClick={() => setSelectedCategory('breaking')}
            className={`px-2.5 py-1 text-xs font-bold rounded-2xs transition-all flex items-center gap-1 ${
              selectedCategory === 'breaking'
                ? 'bg-rose-700 text-white shadow-2xs'
                : 'bg-white border border-rose-200 text-rose-700 hover:bg-rose-50'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping"></span>
            🚨 속보
          </button>
          <button
            onClick={() => setSelectedCategory('stock')}
            className={`px-2.5 py-1 text-xs font-bold rounded-2xs transition-all ${
              selectedCategory === 'stock'
                ? 'bg-blue-800 text-white shadow-2xs'
                : 'bg-white border border-[#1a1a1a]/15 text-[#1a1a1a]/70 hover:bg-stone-100'
            }`}
          >
            📈 기업·증시
          </button>
          <button
            onClick={() => setSelectedCategory('policy')}
            className={`px-2.5 py-1 text-xs font-bold rounded-2xs transition-all ${
              selectedCategory === 'policy'
                ? 'bg-purple-800 text-white shadow-2xs'
                : 'bg-white border border-[#1a1a1a]/15 text-[#1a1a1a]/70 hover:bg-stone-100'
            }`}
          >
            🏦 금융·금리
          </button>
          <button
            onClick={() => setSelectedCategory('economy')}
            className={`px-2.5 py-1 text-xs font-bold rounded-2xs transition-all ${
              selectedCategory === 'economy'
                ? 'bg-emerald-800 text-white shadow-2xs'
                : 'bg-white border border-[#1a1a1a]/15 text-[#1a1a1a]/70 hover:bg-stone-100'
            }`}
          >
            🏛️ 거시경제
          </button>
          <button
            onClick={() => setSelectedCategory('class')}
            className={`px-2.5 py-1 text-xs font-bold rounded-2xs transition-all ${
              selectedCategory === 'class'
                ? 'bg-amber-800 text-white shadow-2xs'
                : 'bg-white border border-[#1a1a1a]/15 text-[#1a1a1a]/70 hover:bg-stone-100'
            }`}
          >
            🏫 학급소식
          </button>
        </div>

        {/* Search & Round Filter */}
        <div className="flex items-center gap-2 flex-1 sm:flex-initial min-w-[240px]">
          {availableRounds.length > 1 && (
            <select
              value={selectedRound}
              onChange={e => setSelectedRound(e.target.value === 'all' ? 'all' : Number(e.target.value))}
              className="px-2.5 py-1 bg-white border border-[#1a1a1a]/20 rounded-2xs text-xs font-mono font-bold text-[#1a1a1a] focus:ring-0 focus:border-[#1a1a1a]"
            >
              <option value="all">전체 회차</option>
              {availableRounds.map(r => (
                <option key={r} value={r}>Round {r}</option>
              ))}
            </select>
          )}
          <div className="relative flex-1">
            <span className="material-symbols-outlined absolute left-2 top-1/2 -translate-y-1/2 text-stone-400 text-[16px]">
              search
            </span>
            <input
              type="text"
              placeholder="기사 제목, 종목, 내용 검색..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-7 pr-3 py-1 bg-white border border-[#1a1a1a]/20 rounded-2xs text-xs text-[#1a1a1a] focus:border-[#1a1a1a] focus:ring-0"
            />
          </div>
        </div>
      </div>

      {/* Hero Headline Article (If on default view) */}
      {heroArticle && (
        <article
          onClick={() => setActiveArticle(heroArticle)}
          className="bg-white rounded-sm p-6 border-2 border-[#1a1a1a] shadow-xs hover:border-[#1a1a1a]/80 transition-all cursor-pointer group relative overflow-hidden"
        >
          <div className="absolute top-0 right-0 bg-[#1a1a1a] text-white text-[10px] font-bold px-3 py-1 font-mono uppercase tracking-wider">
            헤드라인 특종
          </div>

          <div className="flex items-center gap-2 mb-2">
            {heroArticle.isBreaking && (
              <span className="inline-flex items-center gap-1 bg-rose-600 text-white font-bold text-[10px] px-2 py-0.5 rounded-2xs uppercase animate-pulse">
                🚨 속보
              </span>
            )}
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-2xs border ${getCategoryBadge(heroArticle.category).color}`}>
              {getCategoryBadge(heroArticle.category).label}
            </span>
            <span className="text-[11px] font-mono text-[#1a1a1a]/60">
              Round {heroArticle.publishedRound} · {heroArticle.publishedAt}
            </span>
            {getImpactBadge(heroArticle.impact)}
          </div>

          <h2 className="font-editorial text-xl sm:text-2xl font-bold text-[#1a1a1a] group-hover:text-stone-700 transition-colors leading-tight mb-2">
            {heroArticle.title}
          </h2>

          <p className="text-stone-600 text-xs sm:text-sm line-clamp-2 sm:line-clamp-3 mb-4 leading-relaxed font-serif">
            {heroArticle.summary || heroArticle.content}
          </p>

          <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-[#1a1a1a]/10">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-mono font-medium text-[#1a1a1a]/60">
                기자: {heroArticle.author || '학급경제신문'}
              </span>
              {heroArticle.relatedStockName && (
                <div className="flex items-center gap-1">
                  <span className="text-[11px] text-[#1a1a1a]/40">·</span>
                  <span className="text-[11px] font-bold text-blue-900 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-2xs">
                    연관 종목: {heroArticle.relatedStockName}
                  </span>
                </div>
              )}
            </div>

            <div className="flex items-center gap-2">
              {heroArticle.relatedStockId && onOpenStockModal && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpenStockModal(heroArticle.relatedStockId!);
                  }}
                  className="px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-900 border border-blue-300 font-bold text-[11px] rounded-2xs transition-colors flex items-center gap-1"
                >
                  <span className="material-symbols-outlined text-[13px]">candlestick_chart</span>
                  종목 주가 보기
                </button>
              )}
              <span className="text-xs font-bold text-[#1a1a1a] underline group-hover:text-stone-600 flex items-center gap-0.5">
                기사 전문 읽기 <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
              </span>
            </div>
          </div>
        </article>
      )}

      {/* Grid of Articles */}
      {listArticles.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-sm border border-[#1a1a1a]/15 p-6">
          <span className="material-symbols-outlined text-4xl text-stone-300 mb-2">newspaper</span>
          <h3 className="font-editorial text-lg font-bold text-[#1a1a1a]">검색된 경제 뉴스가 없습니다</h3>
          <p className="text-xs text-stone-500 mt-1">다른 카테고리를 선택하거나 검색어를 변경해 보세요.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {listArticles.map((article) => {
            const stock = findStock(article.relatedStockId);
            return (
              <article
                key={article.id}
                onClick={() => setActiveArticle(article)}
                className="bg-white rounded-sm p-4 border border-[#1a1a1a]/15 shadow-2xs hover:border-[#1a1a1a]/40 hover:shadow-xs transition-all cursor-pointer group flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <div className="flex items-center gap-1.5">
                      {article.isBreaking && (
                        <span className="bg-rose-600 text-white font-bold text-[9px] px-1.5 py-0.5 rounded-2xs animate-pulse">
                          🚨 속보
                        </span>
                      )}
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-2xs border ${getCategoryBadge(article.category).color}`}>
                        {getCategoryBadge(article.category).label}
                      </span>
                      {getImpactBadge(article.impact)}
                    </div>
                    <span className="text-[10px] font-mono text-[#1a1a1a]/50">
                      R{article.publishedRound}
                    </span>
                  </div>

                  <h3 className="font-editorial text-base font-bold text-[#1a1a1a] group-hover:text-stone-700 transition-colors leading-snug mb-2">
                    {article.title}
                  </h3>

                  <p className="text-xs text-stone-600 line-clamp-3 leading-relaxed mb-3 font-serif">
                    {article.summary || article.content}
                  </p>
                </div>

                <div className="pt-2 border-t border-[#1a1a1a]/10 flex items-center justify-between text-[11px] font-mono text-[#1a1a1a]/60">
                  <div className="flex items-center gap-1.5 truncate">
                    <span>{article.author || '경제부'}</span>
                    <span>·</span>
                    <span className="text-[10px] text-[#1a1a1a]/40">{article.publishedAt.slice(5, 16)}</span>
                  </div>

                  {article.relatedStockId && onOpenStockModal ? (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpenStockModal(article.relatedStockId!);
                      }}
                      className="px-2 py-0.5 bg-[#faf8f5] hover:bg-stone-200 border border-[#1a1a1a]/15 text-[#1a1a1a] font-bold text-[10px] rounded-2xs transition-colors flex items-center gap-1 flex-shrink-0"
                    >
                      <span className="material-symbols-outlined text-[12px]">trending_up</span>
                      {stock ? `${stock.name} (${stock.changeRate >= 0 ? '+' : ''}${stock.changeRate}%)` : article.relatedStockName || '종목보기'}
                    </button>
                  ) : (
                    <span className="text-stone-400 group-hover:text-[#1a1a1a] text-xs transition-colors">
                      전문 읽기 →
                    </span>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* Article Detail Reading Modal */}
      {activeArticle && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div
            className="bg-[#faf8f5] rounded-sm max-w-2xl w-full max-h-[90vh] flex flex-col shadow-2xl border-2 border-[#1a1a1a] animate-in fade-in zoom-in-95 duration-150"
            onClick={e => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="p-4 bg-white border-b border-[#1a1a1a]/20 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="font-editorial text-lg font-bold text-[#1a1a1a]">
                  학급 경제 신문
                </span>
                <span className="text-[11px] font-mono text-[#1a1a1a]/50">
                  | Round {activeArticle.publishedRound}호 기사
                </span>
              </div>
              <button
                onClick={() => setActiveArticle(null)}
                className="p-1 rounded-2xs hover:bg-stone-100 text-[#1a1a1a] transition-colors"
                title="닫기"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            {/* Modal Body / Article Content */}
            <div className="p-6 overflow-y-auto space-y-4 flex-1">
              {/* Badges & Meta */}
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#1a1a1a]/10 pb-3">
                <div className="flex items-center gap-2">
                  {activeArticle.isBreaking && (
                    <span className="bg-rose-600 text-white font-bold text-[10px] px-2 py-0.5 rounded-2xs animate-pulse">
                      🚨 속보
                    </span>
                  )}
                  <span className={`text-[11px] font-bold px-2 py-0.5 rounded-2xs border ${getCategoryBadge(activeArticle.category).color}`}>
                    {getCategoryBadge(activeArticle.category).label}
                  </span>
                  {getImpactBadge(activeArticle.impact)}
                </div>
                <div className="text-xs font-mono text-[#1a1a1a]/60">
                  발행일: {activeArticle.publishedAt}
                </div>
              </div>

              {/* Title */}
              <h2 className="font-editorial text-2xl sm:text-3xl font-bold text-[#1a1a1a] leading-tight">
                {activeArticle.title}
              </h2>

              {/* Byline */}
              <div className="flex items-center justify-between text-xs font-mono text-[#1a1a1a]/70 py-1 border-b border-[#1a1a1a]/10">
                <span>기자: <strong>{activeArticle.author || '학급경제신문 경제부'}</strong></span>
                <span>학급: {state.className}</span>
              </div>

              {/* Summary Callout Box */}
              {activeArticle.summary && (
                <div className="p-3.5 bg-white rounded-2xs border-l-4 border-[#1a1a1a] border-y border-r border-stone-200">
                  <p className="text-xs font-bold text-[#1a1a1a] leading-relaxed">
                    📌 핵심 요약: {activeArticle.summary}
                  </p>
                </div>
              )}

              {/* Full Content */}
              <div className="text-stone-800 text-sm sm:text-base leading-relaxed font-serif whitespace-pre-line py-2">
                {activeArticle.content}
              </div>

              {/* Related Stock Impact Box */}
              {activeArticle.relatedStockId && (
                <div className="mt-4 p-4 bg-blue-50/80 rounded-2xs border border-blue-200">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-blue-900 block mb-0.5">
                        📈 기사 연관 시장 종목
                      </span>
                      <p className="text-xs font-bold text-blue-950">
                        {activeArticle.relatedStockName || findStock(activeArticle.relatedStockId)?.name}
                        {findStock(activeArticle.relatedStockId) && (
                          <span className="ml-2 font-mono text-[11px] font-normal text-blue-800">
                            현재가: {findStock(activeArticle.relatedStockId)!.currentPrice.toLocaleString()}{state.currencyUnit || '원'}
                            {' '}({findStock(activeArticle.relatedStockId)!.changeRate >= 0 ? '+' : ''}{findStock(activeArticle.relatedStockId)!.changeRate}%)
                          </span>
                        )}
                      </p>
                    </div>

                    {onOpenStockModal && (
                      <button
                        type="button"
                        onClick={() => {
                          const stockId = activeArticle.relatedStockId;
                          setActiveArticle(null);
                          if (stockId) onOpenStockModal(stockId);
                        }}
                        className="px-3 py-1.5 bg-blue-900 hover:bg-blue-800 text-white font-bold text-xs rounded-2xs shadow-2xs transition-colors flex items-center gap-1"
                      >
                        <span className="material-symbols-outlined text-[15px]">candlestick_chart</span>
                        주식 매매 바로가기
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-white border-t border-[#1a1a1a]/20 flex justify-between items-center">
              <span className="text-xs text-stone-500">
                💡 뉴스 기사는 학급 경제 주가와 금리 정책에 영향을 미칠 수 있습니다.
              </span>
              <button
                type="button"
                onClick={() => setActiveArticle(null)}
                className="px-4 py-1.5 bg-[#1a1a1a] hover:bg-stone-800 text-white font-bold text-xs rounded-2xs transition-colors"
              >
                확인 완료
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  if (isModal) {
    return (
      <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
        <div
          className="bg-white rounded-sm max-w-4xl w-full max-h-[92vh] overflow-y-auto p-6 shadow-2xl border border-[#1a1a1a]/20 my-auto"
          onClick={e => e.stopPropagation()}
        >
          {content}
        </div>
      </div>
    );
  }

  return content;
};
