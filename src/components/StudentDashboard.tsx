import React, { useState } from 'react';
import { useClassEconomy } from '../context/ClassEconomyContext';
import { SendMoneyModal } from './SendMoneyModal';
import { SavingsModal } from './SavingsModal';
import { StockModal } from './StockModal';
import { RebalanceModal } from './RebalanceModal';
import { StudentPinModal } from './StudentPinModal';
import { StudentAssetTable } from './StudentAssetTable';
import { NewsletterViewer } from './NewsletterViewer';
import { RepayDebtModal } from './RepayDebtModal';

export const StudentDashboard: React.FC = () => {
  const {
    currentStudent,
    calculateTotalAssets,
    state,
    buyShopItem,
    useCoupon,
    cancelCouponRequest,
    logout,
    isSyncing,
    lastSyncedAt,
    refreshClassData,
    lastActionError,
    clearLastActionError
  } = useClassEconomy();

  const [activeTab, setActiveTab] = useState<'dashboard' | 'newsletter' | 'asset_history' | 'shop' | 'lessons' | 'leaderboard' | 'profile'>('dashboard');

  // Modals state
  const [isSendMoneyOpen, setIsSendMoneyOpen] = useState(false);
  const [isSavingsOpen, setIsSavingsOpen] = useState(false);
  const [savingsDefaultMode, setSavingsDefaultMode] = useState<'deposit' | 'withdraw'>('deposit');
  const [isStockOpen, setIsStockOpen] = useState(false);
  const [stockDefaultId, setStockDefaultId] = useState<string>('');
  const [isRebalanceOpen, setIsRebalanceOpen] = useState(false);
  const [isPinModalOpen, setIsPinModalOpen] = useState(false);
  const [isFirstTimePinModal, setIsFirstTimePinModal] = useState(false);
  const [isNewsletterModalOpen, setIsNewsletterModalOpen] = useState(false);
  const [isRepayDebtOpen, setIsRepayDebtOpen] = useState(false);
  const [syncFeedback, setSyncFeedback] = useState('');
  const [buyingItemId, setBuyingItemId] = useState<string | null>(null);
  const [shopToast, setShopToast] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleBuyShopItem = async (item: typeof state.shopItems[number]) => {
    if (buyingItemId) return;
    setBuyingItemId(item.id);
    clearLastActionError();
    try {
      const ok = await buyShopItem(item);
      if (ok) {
        setShopToast({ type: 'success', text: `${item.name} 결제 완료! 쿠폰함에 추가되었습니다.` });
      } else {
        setShopToast({ type: 'error', text: lastActionError || '보유 현금이 부족하거나 구매에 실패했습니다.' });
      }
      setTimeout(() => setShopToast(null), 3500);
    } finally {
      setBuyingItemId(null);
    }
  };

  const nextPendingScenario = React.useMemo(() => {
    const list = (state.scheduledScenarios || []).filter(s => s.status === 'pending');
    if (list.length === 0) return null;
    return [...list].sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime())[0];
  }, [state.scheduledScenarios]);

  const formatSyncTime = (date: Date | null) => {
    if (!date) return '방금 전';
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    return `${hours}:${minutes}:${seconds}`;
  };

  const handleManualSync = async () => {
    const success = await refreshClassData();
    if (success) {
      setSyncFeedback('동기화 완료!');
      setTimeout(() => setSyncFeedback(''), 3000);
    }
  };

  // Auto-detect first time default PIN on mount
  React.useEffect(() => {
    if (currentStudent && !currentStudent.isPinChanged && (currentStudent.pin === '1234' || currentStudent.pin === '0000')) {
      setIsFirstTimePinModal(true);
      setIsPinModalOpen(true);
    }
  }, [currentStudent?.id, currentStudent?.isPinChanged, currentStudent?.pin]);

  if (!currentStudent) {
    return (
      <div className="bg-[#f7f9fb] text-[#191c1e] min-h-[calc(100vh-40px)] flex items-center justify-center p-6 text-center">
        <div className="bg-white rounded-3xl p-8 shadow-[0_8px_30px_rgba(0,0,0,0.06)] border border-stone-200 max-w-md w-full">
          <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center text-3xl mx-auto mb-4 border border-blue-100">
            🧒
          </div>
          <h2 className="font-extrabold text-2xl mb-2 text-[#191c1e]">학생 계정 확인 필요</h2>
          <p className="text-xs text-stone-500 leading-relaxed mb-6">
            접속된 학생 정보를 불러오는 중이거나 세션이 종료되었습니다.<br />
            로그인 화면으로 돌아가 학생 이름(또는 번호)으로 다시 로그인해 주세요.
          </p>
          <div className="flex flex-col sm:flex-row gap-2">
            <button
              type="button"
              onClick={handleManualSync}
              className="flex-1 h-12 bg-stone-100 hover:bg-stone-200 text-stone-700 font-bold text-sm rounded-xl transition-all flex items-center justify-center gap-1.5"
            >
              <span className="material-symbols-outlined text-lg">refresh</span>
              <span>다시 시도</span>
            </button>
            <button
              type="button"
              onClick={logout}
              className="flex-1 h-12 bg-[#005da7] hover:bg-[#004883] text-white font-bold text-sm rounded-xl shadow-md transition-all flex items-center justify-center gap-1.5"
            >
              <span className="material-symbols-outlined text-lg">login</span>
              <span>로그인 화면으로 이동</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  const totalAssets = calculateTotalAssets(currentStudent);

  // Calculate Asset Percentages for Portfolio Chart
  const totalStockValue = Math.round((state.stocks || []).reduce(
    (sum, st) => sum + ((currentStudent?.stockShares || {})[st.id] || 0) * (st.currentPrice || 0),
    0
  ));

  const totalStockPreviousValue = Math.round((state.stocks || []).reduce(
    (sum, st) => sum + ((currentStudent?.stockShares || {})[st.id] || 0) * (st.previousPrice || st.currentPrice || 0),
    0
  ));
  const totalStockGainLoss = totalStockValue - totalStockPreviousValue;

  const cashPct = totalAssets > 0 ? Math.round(((currentStudent?.cash || 0) / totalAssets) * 100) : 0;
  const savingsPct = totalAssets > 0 ? Math.round(((currentStudent?.savings || 0) / totalAssets) * 100) : 0;
  const stockPct = totalAssets > 0 ? Math.round((totalStockValue / totalAssets) * 100) : 0;

  const openSavingsModal = (mode: 'deposit' | 'withdraw') => {
    setSavingsDefaultMode(mode);
    setIsSavingsOpen(true);
  };

  const openStockModal = (stockId?: string) => {
    setStockDefaultId(stockId || state.stocks[0]?.id || '');
    setIsStockOpen(true);
  };

  return (
    <div className="bg-[#f5f2ed] text-[#1a1a1a] min-h-[calc(100vh-40px)] pb-24 md:pb-12 font-sans">
      {/* Top Header App Bar */}
      <header className="sticky top-0 left-0 w-full z-40 flex justify-between items-center px-4 md:px-10 h-16 bg-[#faf8f5] border-b border-[#1a1a1a]/12 shadow-xs">
        <button
          onClick={() => setActiveTab('dashboard')}
          title="학생 대시보드 홈으로 이동"
          type="button"
          className="flex items-center gap-3 group cursor-pointer hover:opacity-85 transition-opacity text-left bg-transparent border-0 p-0 focus:outline-none"
        >
          <div className="w-8 h-8 rounded-2xs bg-[#1a1a1a] text-white flex items-center justify-center font-editorial font-bold italic text-base border border-[#1a1a1a] shadow-2xs group-hover:scale-105 transition-transform">
            K
          </div>
          <div>
            <h1 className="font-editorial text-xl font-bold italic tracking-tight text-[#1a1a1a] group-hover:underline">
              Kids Rich <span className="text-xs not-italic font-sans uppercase tracking-[0.2em] text-[#1a1a1a]/60 ml-1">Class Economy</span>
            </h1>
          </div>
        </button>
        <div className="flex items-center gap-2">
          {/* Manual Sync Button */}
          <button
            onClick={handleManualSync}
            disabled={isSyncing}
            title={`클라우드 최신 정보 새로고침 (최근: ${formatSyncTime(lastSyncedAt)})`}
            className={`h-8 px-2.5 bg-emerald-50 border border-emerald-300 text-emerald-900 rounded-2xs text-xs font-bold flex items-center gap-1.5 hover:bg-emerald-100 shadow-2xs transition-all ${
              isSyncing ? 'opacity-70 cursor-not-allowed' : 'btn-press'
            }`}
          >
            <span className={`material-symbols-outlined text-[16px] text-emerald-800 ${isSyncing ? 'animate-spin' : ''}`}>
              sync
            </span>
            <span>{isSyncing ? '가져오는 중...' : syncFeedback ? `✓ ${syncFeedback}` : '새로고침 🔄'}</span>
          </button>

          {state.isTradingFrozen && (
            <span className="bg-red-900/10 text-red-900 border border-red-900/20 px-3 py-1 rounded-sm text-xs font-bold flex items-center gap-1 uppercase tracking-wider">
              <span className="material-symbols-outlined text-sm">lock</span> 거래 정지중
            </span>
          )}
          <button
            onClick={() => setActiveTab('profile')}
            title="학생 설정"
            className="w-8 h-8 flex items-center justify-center rounded-2xs hover:bg-[#1a1a1a]/5 text-[#1a1a1a] transition-colors border border-[#1a1a1a]/15 shadow-2xs bg-white"
          >
            <span className="material-symbols-outlined text-[18px]">settings</span>
          </button>

          <button
            onClick={logout}
            title="로그아웃"
            className="h-8 px-2.5 bg-white hover:bg-stone-100 border border-[#1a1a1a]/20 text-[#1a1a1a] rounded-2xs font-bold text-xs flex items-center gap-1 transition-all shadow-2xs whitespace-nowrap btn-press"
          >
            <span className="material-symbols-outlined text-[15px]">logout</span>
            <span className="hidden sm:inline">로그아웃</span>
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 md:px-10 py-6">
        {/* Header Info Row */}
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6 pb-4 border-b border-[#1a1a1a]/10">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-sm border border-[#1a1a1a]/15 shadow-2xs">
              <span className="text-base">🙋</span>
              <span className="font-medium text-xs tracking-wider uppercase text-[#1a1a1a]">
                {state.className} {currentStudent.number}번 <strong className="font-bold normal-case text-sm text-[#1a1a1a] ml-1">{currentStudent.name}</strong>
              </span>
            </div>

            {state.teacherName && (
              <div className="hidden sm:flex items-center gap-1.5 bg-white px-3.5 py-2 rounded-sm border border-[#1a1a1a]/15 shadow-2xs text-xs">
                <span className="text-sm">👨‍🏫</span>
                <span className="text-[#1a1a1a]/60">담임:</span>
                <span className="font-bold text-[#1a1a1a]">{state.teacherName} 선생님</span>
              </div>
            )}

            {/* Student Rank Badge */}
            {state.isLeaderboardPublic !== false ? (
              (() => {
                const myRank = state.students
                  .map(s => ({ id: s.id, total: calculateTotalAssets(s) }))
                  .sort((a, b) => b.total - a.total)
                  .findIndex(s => s.id === currentStudent.id) + 1;
                return (
                  <button
                    onClick={() => setActiveTab('leaderboard')}
                    className="bg-amber-100 hover:bg-amber-200/80 border border-amber-300 text-stone-900 px-3 py-2 rounded-sm font-bold text-xs flex items-center gap-1.5 shadow-2xs transition-colors"
                  >
                    <span>{myRank === 1 ? '👑 1위' : myRank === 2 ? '🥈 2위' : myRank === 3 ? '🥉 3위' : `🏅 ${myRank}위`}</span>
                    <span className="text-[10px] font-normal text-stone-600 font-sans">/ {state.students.length}명</span>
                  </button>
                );
              })()
            ) : (
              <div
                className="bg-stone-100 border border-stone-300 text-stone-600 px-3 py-2 rounded-sm font-bold text-xs flex items-center gap-1.5 shadow-2xs"
                title="선생님께서 학급 랭킹을 비공개로 설정하셨습니다"
              >
                <span className="material-symbols-outlined text-[15px] text-stone-500">lock</span>
                <span>랭킹 비공개</span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-4">
            <div className="bg-[#1a1a1a] px-4 py-2 rounded-sm text-white font-medium text-xs tracking-widest uppercase shadow-2xs">
              ROUND {state.currentRound} / {state.totalRounds}
            </div>
            <div className="text-right">
              <div className="text-[11px] uppercase tracking-[0.2em] text-[#1a1a1a]/60 font-semibold mb-0.5">
                {(currentStudent.debt || 0) > 0 ? '순자산 (자산 - 부채)' : '총 자산 평가액'}
              </div>
              <div className="flex items-baseline gap-2 justify-end">
                <span className="font-editorial text-2xl font-bold text-[#1a1a1a]">
                  {totalAssets.toLocaleString()}<span className="text-sm font-sans font-normal ml-0.5">{state.currencyUnit || '원'}</span>
                </span>
                {(currentStudent.debt || 0) > 0 && (
                  <span className="text-[11px] font-mono font-bold text-rose-800 bg-rose-100 px-2 py-0.5 rounded-2xs border border-rose-300">
                    빚 -{currentStudent.debt.toLocaleString()}원
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* News Ticker */}
        <div className="bg-[#1a1a1a] text-stone-100 rounded-xs py-2 px-3 sm:px-4 mb-6 flex flex-wrap items-center justify-between gap-3 shadow-2xs border border-[#1a1a1a]">
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-amber-300 border border-amber-400/30 px-2 py-0.5 rounded-2xs shrink-0 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping"></span>
              속보
            </span>
            <div className="ticker-wrap flex-1 min-w-0">
              <div className="ticker font-medium text-xs tracking-wide text-stone-200 truncate">
                {state.newsMessage}
              </div>
            </div>
          </div>
          {nextPendingScenario && (
            <span className="px-2.5 py-1 bg-indigo-500/20 text-indigo-200 border border-indigo-400/30 rounded-2xs text-[11px] font-mono font-bold shrink-0 flex items-center gap-1">
              <span className="material-symbols-outlined text-[13px]">schedule</span>
              다음 R{nextPendingScenario.targetRound}: {new Date(nextPendingScenario.scheduledAt).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
          <button
            onClick={() => setActiveTab('newsletter')}
            className="px-2.5 py-1 bg-white/10 hover:bg-white/20 text-white rounded-2xs text-[11px] font-bold font-mono transition-colors flex items-center gap-1 shrink-0"
          >
            <span className="material-symbols-outlined text-[14px]">newspaper</span>
            뉴스레터 보기 →
          </button>
        </div>

        {shopToast && (
          <div className={`mb-5 p-3.5 rounded-sm border text-xs font-bold flex items-center justify-between gap-2 shadow-2xs animate-in fade-in ${
            shopToast.type === 'success'
              ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
              : 'bg-rose-50 border-rose-300 text-rose-900'
          }`}>
            <span className="flex items-center gap-2">
              <span className="material-symbols-outlined text-base">
                {shopToast.type === 'success' ? 'check_circle' : 'error'}
              </span>
              {shopToast.text}
            </span>
            <button type="button" onClick={() => setShopToast(null)} className="text-[11px] underline">닫기</button>
          </div>
        )}

        {/* Initial PIN Change Prompt Banner */}
        {(!currentStudent.isPinChanged || currentStudent.pin === '1234' || currentStudent.pin === '0000') && (
          <div className="mb-6 p-4 bg-amber-50 border-2 border-amber-300 rounded-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-2xs animate-in fade-in">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-amber-200/80 text-amber-900 flex items-center justify-center font-bold text-lg shrink-0">
                🔒
              </div>
              <div>
                <h4 className="font-bold text-sm text-amber-950">
                  초기 비밀번호(PIN)를 변경해 주세요!
                </h4>
                <p className="text-xs text-amber-800">
                  현재 기본 비밀번호를 사용 중입니다. 다른 친구들이 내 자산을 건드리지 않도록 나만의 비밀번호로 변경하세요.
                </p>
              </div>
            </div>
            <button
              onClick={() => {
                setIsFirstTimePinModal(false);
                setIsPinModalOpen(true);
              }}
              className="px-4 py-2 bg-amber-800 hover:bg-amber-900 text-white rounded-2xs text-xs font-bold shrink-0 flex items-center gap-1.5 shadow-2xs transition-colors"
            >
              <span className="material-symbols-outlined text-[16px]">key</span>
              비밀번호 지금 변경하기
            </button>
          </div>
        )}

        {/* Debt Alert Banner */}
        {(currentStudent.debt || 0) > 0 && (
          <div className="mb-6 p-4 bg-rose-50 border-2 border-rose-300 rounded-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-2xs animate-in fade-in">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-rose-200 text-rose-950 flex items-center justify-center font-bold text-xl shrink-0">
                🚨
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="font-bold text-sm text-rose-950">
                    학급 부채(빚) 보유 알림
                  </h4>
                  <span className="px-2 py-0.5 rounded-2xs bg-rose-200 border border-rose-300 text-rose-900 font-mono font-bold text-xs">
                    {(currentStudent.debt || 0).toLocaleString()}원 미납
                  </span>
                </div>
                <p className="text-xs text-rose-800 mt-0.5">
                  벌금 부과 시 현금·저축·주식이 자동 청산된 후 부족한 금액이 부채로 누적되었습니다. 보유 현금이나 상금 수령으로 언제든지 빚을 상환할 수 있습니다.
                </p>
              </div>
            </div>
            <button
              onClick={() => setIsRepayDebtOpen(true)}
              className="px-4 py-2 bg-rose-900 hover:bg-rose-950 text-white rounded-2xs text-xs font-bold shrink-0 flex items-center gap-1.5 shadow-2xs transition-colors"
            >
              <span className="material-symbols-outlined text-[16px]">payments</span>
              빚 갚기 (부채 상환)
            </button>
          </div>
        )}

        {/* Desktop Navigation Tabs */}
        <div className="hidden md:flex bg-[#faf8f5] p-1 rounded-sm border border-[#1a1a1a]/15 mb-6 shadow-2xs w-max mx-auto">
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`px-5 py-2 rounded-2xs font-bold text-xs uppercase tracking-wider flex items-center gap-2 transition-all ${
              activeTab === 'dashboard'
                ? 'bg-[#1a1a1a] text-white shadow-2xs'
                : 'text-[#1a1a1a]/70 hover:bg-[#1a1a1a]/5 hover:text-[#1a1a1a]'
            }`}
          >
            <span className="material-symbols-outlined text-[18px]">trending_up</span>
            자산 & 모의투자
          </button>
          <button
            onClick={() => setActiveTab('newsletter')}
            className={`px-5 py-2 rounded-2xs font-bold text-xs uppercase tracking-wider flex items-center gap-2 transition-all ${
              activeTab === 'newsletter'
                ? 'bg-[#1a1a1a] text-white shadow-2xs'
                : 'text-[#1a1a1a]/70 hover:bg-[#1a1a1a]/5 hover:text-[#1a1a1a]'
            }`}
          >
            <span className="material-symbols-outlined text-[18px]">newspaper</span>
            학급 뉴스레터
            {(state.newsArticles?.length || 0) > 0 && (
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold ${activeTab === 'newsletter' ? 'bg-amber-400 text-[#1a1a1a]' : 'bg-stone-200 text-[#1a1a1a]'}`}>
                {state.newsArticles?.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('asset_history')}
            className={`px-5 py-2 rounded-2xs font-bold text-xs uppercase tracking-wider flex items-center gap-2 transition-all ${
              activeTab === 'asset_history'
                ? 'bg-[#1a1a1a] text-white shadow-2xs'
                : 'text-[#1a1a1a]/70 hover:bg-[#1a1a1a]/5 hover:text-[#1a1a1a]'
            }`}
          >
            <span className="material-symbols-outlined text-[18px]">receipt_long</span>
            자산 변동 현황표
          </button>
          <button
            onClick={() => setActiveTab('leaderboard')}
            className={`px-5 py-2 rounded-2xs font-bold text-xs uppercase tracking-wider flex items-center gap-2 transition-all ${
              activeTab === 'leaderboard'
                ? 'bg-[#1a1a1a] text-white shadow-2xs'
                : 'text-[#1a1a1a]/70 hover:bg-[#1a1a1a]/5 hover:text-[#1a1a1a]'
            }`}
          >
            <span className="material-symbols-outlined text-[18px]">
              {state.isLeaderboardPublic !== false ? 'leaderboard' : 'lock'}
            </span>
            <span>학급 랭킹</span>
            {state.isLeaderboardPublic === false && (
              <span className={`text-[10px] px-1.5 py-0.2 rounded-2xs font-semibold ${
                activeTab === 'leaderboard' ? 'bg-stone-700 text-stone-200' : 'bg-stone-200 text-stone-700'
              }`}>
                비공개
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('shop')}
            className={`px-5 py-2 rounded-2xs font-bold text-xs uppercase tracking-wider flex items-center gap-2 transition-all ${
              activeTab === 'shop'
                ? 'bg-[#1a1a1a] text-white shadow-2xs'
                : 'text-[#1a1a1a]/70 hover:bg-[#1a1a1a]/5 hover:text-[#1a1a1a]'
            }`}
          >
            <span className="material-symbols-outlined text-[18px]">storefront</span>
            학급 상점 & 송금
          </button>
          <button
            onClick={() => setActiveTab('lessons')}
            className={`px-5 py-2 rounded-2xs font-bold text-xs uppercase tracking-wider flex items-center gap-2 transition-all ${
              activeTab === 'lessons'
                ? 'bg-[#1a1a1a] text-white shadow-2xs'
                : 'text-[#1a1a1a]/70 hover:bg-[#1a1a1a]/5 hover:text-[#1a1a1a]'
            }`}
          >
            <span className="material-symbols-outlined text-[18px]">school</span>
            금융 배움터
          </button>
        </div>

        {/* TAB 1: DASHBOARD & INVESTMENTS */}
        {activeTab === 'dashboard' && (
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
            {/* Left Column: Asset Cards */}
            <div className="md:col-span-8 flex flex-col gap-5">
              {/* Cash Card */}
              <div className="bg-white rounded-sm p-6 border border-[#1a1a1a]/15 relative flex flex-col justify-between shadow-2xs">
                <div className="flex justify-between items-start mb-6">
                  <div className="flex items-center gap-3.5">
                    <div className="w-11 h-11 rounded-sm bg-[#faf8f5] border border-[#1a1a1a]/15 text-[#1a1a1a] flex items-center justify-center">
                      <span className="material-symbols-outlined text-xl">payments</span>
                    </div>
                    <div>
                      <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#1a1a1a]/50">CURRENT CASH</span>
                      <h3 className="font-editorial text-2xl font-bold text-[#1a1a1a] mt-0.5">
                        {currentStudent.cash.toLocaleString()}<span className="text-sm font-sans font-normal ml-0.5">{state.currencyUnit || '원'}</span>
                      </h3>
                    </div>
                  </div>
                  <span className="text-xs font-mono uppercase tracking-widest text-[#1a1a1a]/40 bg-[#faf8f5] px-2 py-1 rounded-2xs border border-[#1a1a1a]/10">
                    CASH
                  </span>
                </div>
                <div className="flex gap-3 pt-4 border-t border-[#1a1a1a]/10">
                  <button
                    onClick={() => setIsSendMoneyOpen(true)}
                    className="flex-1 h-11 bg-[#faf8f5] hover:bg-[#f0ede6] text-[#1a1a1a] rounded-2xs font-bold text-xs tracking-wider uppercase flex items-center justify-center gap-2 transition-colors btn-press border border-[#1a1a1a]/20"
                  >
                    <span className="material-symbols-outlined text-[18px]">send</span> 선생님께 송금
                  </button>
                  <button
                    onClick={() => openSavingsModal('deposit')}
                    className="flex-1 h-11 bg-[#1a1a1a] hover:bg-stone-800 text-white rounded-2xs font-bold text-xs tracking-wider uppercase flex items-center justify-center gap-2 transition-colors btn-press shadow-2xs"
                  >
                    <span className="material-symbols-outlined text-[18px]">savings</span> 저축으로 입금
                  </button>
                </div>
              </div>

              {/* Bank Savings Card */}
              <div className="bg-white rounded-sm p-6 border border-[#1a1a1a]/15 relative flex flex-col justify-between shadow-2xs">
                <div className="flex justify-between items-start mb-6">
                  <div className="flex items-center gap-3.5">
                    <div className="w-11 h-11 rounded-sm bg-[#faf8f5] border border-[#1a1a1a]/15 text-[#1a1a1a] flex items-center justify-center">
                      <span className="material-symbols-outlined text-xl">account_balance</span>
                    </div>
                    <div>
                      <h3 className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#1a1a1a]/50 flex items-center gap-2">
                        SAVINGS ACCOUNT
                        <span className="text-[10px] bg-stone-100 text-[#1a1a1a] border border-[#1a1a1a]/20 px-2 py-0.5 rounded-2xs font-mono font-bold">
                          연 {state.depositInterestRate.toFixed(1)}%
                        </span>
                      </h3>
                      <div className="flex items-baseline gap-3 mt-0.5">
                        <p className="font-editorial text-2xl font-bold text-[#1a1a1a]">
                          {currentStudent.savings.toLocaleString()}<span className="text-sm font-sans font-normal ml-0.5">{state.currencyUnit || '원'}</span>
                        </p>
                        <p className="font-bold text-xs text-emerald-800 flex items-center">
                          <span className="material-symbols-outlined text-[15px] mr-0.5">arrow_upward</span>
                          이자 +{Math.round(currentStudent.savings * (state.depositInterestRate / 100)).toLocaleString()}{state.currencyUnit || '원'}
                        </p>
                      </div>
                    </div>
                  </div>
                  <span className="text-xs font-mono uppercase tracking-widest text-[#1a1a1a]/40 bg-[#faf8f5] px-2 py-1 rounded-2xs border border-[#1a1a1a]/10">
                    BANK
                  </span>
                </div>
                <div className="flex gap-3 pt-4 border-t border-[#1a1a1a]/10">
                  <button
                    onClick={() => openSavingsModal('deposit')}
                    className="flex-1 h-11 bg-[#1a1a1a] hover:bg-stone-800 text-white rounded-2xs font-bold text-xs tracking-wider uppercase flex items-center justify-center gap-2 transition-colors btn-press shadow-2xs"
                  >
                    입금하기
                  </button>
                  <button
                    onClick={() => openSavingsModal('withdraw')}
                    className="flex-1 h-11 bg-[#faf8f5] hover:bg-[#f0ede6] text-[#1a1a1a] rounded-2xs font-bold text-xs tracking-wider uppercase flex items-center justify-center gap-2 transition-colors btn-press border border-[#1a1a1a]/20"
                  >
                    출금하기
                  </button>
                </div>
              </div>

              {/* Stocks Card */}
              <div className="bg-white rounded-sm p-6 border border-[#1a1a1a]/15 relative flex flex-col justify-between shadow-2xs">
                <div className="flex justify-between items-start mb-4">
                  <div className="flex items-center gap-3.5">
                    <div className="w-11 h-11 rounded-sm bg-[#faf8f5] border border-[#1a1a1a]/15 text-[#1a1a1a] flex items-center justify-center">
                      <span className="material-symbols-outlined text-xl">candlestick_chart</span>
                    </div>
                    <div>
                      <h3 className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#1a1a1a]/50 flex items-center gap-1.5">
                        STOCK PORTFOLIO
                        <span className="text-[10px] bg-[#1a1a1a]/10 text-[#1a1a1a] px-1.5 py-0.2 rounded-2xs">
                          {state.stocks.length}개 종목
                        </span>
                      </h3>
                      <div className="flex items-baseline gap-2 mt-0.5">
                        <p className="font-editorial text-2xl font-bold text-[#1a1a1a]">
                          {totalStockValue.toLocaleString()}<span className="text-sm font-sans font-normal ml-0.5">{state.currencyUnit || '원'}</span>
                        </p>
                        {totalStockGainLoss !== 0 && totalStockValue > 0 && (
                          <span className={`text-xs font-mono font-bold px-1.5 py-0.5 rounded-2xs border ${
                            totalStockGainLoss > 0 
                              ? 'text-emerald-800 bg-emerald-100/80 border-emerald-300' 
                              : 'text-rose-800 bg-rose-100/80 border-rose-300'
                          }`}>
                            {totalStockGainLoss > 0 ? `+${totalStockGainLoss.toLocaleString()}` : totalStockGainLoss.toLocaleString()}{state.currencyUnit || '원'}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => openStockModal()}
                    className="px-3 py-1.5 bg-[#1a1a1a] text-white font-bold text-xs uppercase tracking-wider rounded-2xs hover:bg-stone-800 transition-colors flex items-center gap-1"
                  >
                    <span className="material-symbols-outlined text-[16px]">candlestick_chart</span>
                    전체 매매
                  </button>
                </div>

                {/* Stock shares breakdown */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mb-4 max-h-80 overflow-y-auto pr-1">
                  {(state.stocks || []).map(st => {
                    const shares = (currentStudent?.stockShares || {})[st.id] || 0;
                    return (
                      <div
                        key={st.id}
                        className="p-3 bg-[#faf8f5] rounded-2xs border border-[#1a1a1a]/12 flex justify-between items-center hover:border-[#1a1a1a]/30 transition-colors"
                      >
                        <div className="min-w-0 flex-1 mr-2">
                          <div className="flex items-center gap-1">
                            <span className="text-[10px] font-bold uppercase text-[#1a1a1a]/50 truncate">{st.category}</span>
                            <span className="text-[9px] font-mono text-[#1a1a1a]/40">· 실시간</span>
                          </div>
                          <div className="text-xs font-bold text-[#1a1a1a] truncate">{st.name}</div>
                          <div className="text-[11px] font-mono text-[#1a1a1a] font-bold mt-0.5">
                            현재가: {st.currentPrice.toLocaleString()}{state.currencyUnit || '원'}
                          </div>
                          <div className="text-[10px] font-mono text-[#1a1a1a]/70">
                            {shares > 0 ? (
                              <div className="flex flex-col gap-0.5 mt-0.5">
                                <span className="text-[#1a1a1a] font-bold">
                                  {Number.isInteger(shares) ? `${shares.toLocaleString()}주` : `${parseFloat(shares.toFixed(4))}주`} 보유 ({ Math.round(shares * st.currentPrice).toLocaleString() }{state.currencyUnit || '원'})
                                </span>
                                {(st.currentPrice - st.previousPrice) !== 0 && (
                                  <span className={`text-[9px] font-bold ${
                                    (st.currentPrice - st.previousPrice) > 0 ? 'text-emerald-700' : 'text-rose-700'
                                  }`}>
                                    손익: { (st.currentPrice - st.previousPrice) * shares > 0 ? '+' : '' }{ Math.round((st.currentPrice - st.previousPrice) * shares).toLocaleString() }{state.currencyUnit || '원'}
                                  </span>
                                )}
                              </div>
                            ) : (
                              <span>이전가: {st.previousPrice.toLocaleString()}{state.currencyUnit || '원'}</span>
                            )}
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-1 flex-shrink-0">
                          <span className={`text-[10px] font-bold font-mono px-1.5 py-0.5 rounded-2xs border ${
                            st.changeRate >= 0
                              ? 'text-emerald-800 bg-emerald-100/70 border-emerald-300'
                              : 'text-rose-800 bg-rose-100/70 border-rose-300'
                          }`}>
                            {st.changeRate >= 0 ? `▲+${st.changeRate}%` : `▼${st.changeRate}%`}
                          </span>
                          <button
                            onClick={() => openStockModal(st.id)}
                            className="text-[10px] font-bold text-[#1a1a1a] bg-white border border-[#1a1a1a]/20 px-2 py-0.5 rounded-2xs hover:bg-[#1a1a1a] hover:text-white transition-colors"
                          >
                            매매하기
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Right Column: Portfolio Chart & Quick Shop */}
            <div className="md:col-span-4 flex flex-col gap-5">
              {/* Portfolio Chart */}
              <div className="bg-white rounded-sm p-6 border border-[#1a1a1a]/15 flex flex-col justify-center shadow-2xs">
                <h3 className="font-editorial text-lg font-bold text-[#1a1a1a] mb-4 pb-2 border-b border-[#1a1a1a]/10">
                  자산 구성 비율
                </h3>

                <div className="w-full h-6 flex rounded-2xs overflow-hidden border border-[#1a1a1a]/20 mb-4 bg-stone-100">
                  <div
                    className="bg-[#1a1a1a] h-full transition-all duration-300"
                    style={{ width: `${cashPct}%` }}
                    title="현금"
                  ></div>
                  <div
                    className="bg-[#5c5b57] h-full transition-all duration-300"
                    style={{ width: `${savingsPct}%` }}
                    title="저축"
                  ></div>
                  <div
                    className="bg-[#a8a49c] h-full transition-all duration-300"
                    style={{ width: `${stockPct}%` }}
                    title="주식"
                  ></div>
                </div>

                <div className="flex flex-col w-full gap-2 font-medium text-xs">
                  <div className="flex justify-between items-center px-3 py-2 rounded-2xs bg-[#faf8f5] border border-[#1a1a1a]/10">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-2xs bg-[#1a1a1a]"></div>
                      <span className="font-bold">현금</span>
                    </div>
                    <span className="font-mono">{cashPct}% ({currentStudent.cash.toLocaleString()}원)</span>
                  </div>
                  <div className="flex justify-between items-center px-3 py-2 rounded-2xs bg-[#faf8f5] border border-[#1a1a1a]/10">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-2xs bg-[#5c5b57]"></div>
                      <span className="font-bold">저축</span>
                    </div>
                    <span className="font-mono">{savingsPct}% ({currentStudent.savings.toLocaleString()}원)</span>
                  </div>
                  <div className="flex justify-between items-center px-3 py-2 rounded-2xs bg-[#faf8f5] border border-[#1a1a1a]/10">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-2xs bg-[#a8a49c]"></div>
                      <span className="font-bold">주식</span>
                    </div>
                    <span className="font-mono">{stockPct}% ({totalStockValue.toLocaleString()}원)</span>
                  </div>
                  {(currentStudent.debt || 0) > 0 && (
                    <div className="flex justify-between items-center px-3 py-2 rounded-2xs bg-rose-50 border border-rose-300 text-rose-900">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-2xs bg-rose-700"></div>
                        <span className="font-bold">학급 부채 (빚)</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-rose-800">
                          -{(currentStudent.debt || 0).toLocaleString()}원
                        </span>
                        <button
                          type="button"
                          onClick={() => setIsRepayDebtOpen(true)}
                          className="px-2 py-0.5 bg-rose-900 hover:bg-rose-950 text-white rounded-2xs text-[10px] font-bold shadow-2xs"
                        >
                          상환
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                <button
                  onClick={() => setIsRebalanceOpen(true)}
                  className="w-full mt-3 py-2.5 bg-[#1a1a1a] text-white hover:bg-stone-800 rounded-2xs font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all shadow-2xs btn-press"
                >
                  <span className="material-symbols-outlined text-[16px]">tune</span>
                  자산 보유 비중 설정 & 리밸런싱
                </button>
              </div>

              {/* Quick Shop Widget */}
              <div className="bg-white rounded-sm p-6 border border-[#1a1a1a]/15 flex-1 flex flex-col justify-between shadow-2xs">
                <div className="flex justify-between items-center mb-4 pb-2 border-b border-[#1a1a1a]/10">
                  <h3 className="font-editorial text-lg font-bold text-[#1a1a1a] flex items-center gap-2">
                    학급 상점
                  </h3>
                  <button
                    onClick={() => setActiveTab('shop')}
                    className="text-[#1a1a1a] text-xs font-bold uppercase tracking-wider hover:underline"
                  >
                    전체 보기 →
                  </button>
                </div>

                <div className="flex flex-col gap-3 flex-1">
                  {state.shopItems.slice(0, 3).map(item => (
                    <div
                      key={item.id}
                      className="bg-[#faf8f5] p-3 rounded-2xs border border-[#1a1a1a]/12 flex justify-between items-center"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-2xs bg-white border border-[#1a1a1a]/15 flex items-center justify-center text-lg">
                          {item.icon}
                        </div>
                        <div>
                          <div className="font-bold text-xs text-[#1a1a1a]">{item.name}</div>
                          <div className="text-xs font-mono font-bold text-[#1a1a1a]/80">{item.price.toLocaleString()}원</div>
                        </div>
                      </div>
                      <button
                        disabled={buyingItemId === item.id}
                        onClick={() => handleBuyShopItem(item)}
                        className="h-8 px-3 bg-[#1a1a1a] text-white rounded-2xs text-[11px] font-bold uppercase tracking-wider transition-colors hover:bg-stone-800 disabled:bg-stone-400 disabled:cursor-not-allowed btn-press"
                      >
                        {buyingItemId === item.id ? '결제 중...' : '구매'}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Newsletter Feed Section in Dashboard */}
            <div className="md:col-span-12">
              <div className="bg-[#faf8f5] rounded-sm p-6 border border-[#1a1a1a]/15 shadow-2xs">
                <div className="flex flex-wrap items-center justify-between gap-4 mb-4 pb-3 border-b border-[#1a1a1a]/10">
                  <div className="flex items-center gap-2.5">
                    <span className="material-symbols-outlined text-2xl text-[#1a1a1a]">newspaper</span>
                    <div>
                      <h3 className="font-editorial text-xl font-bold text-[#1a1a1a]">
                        오늘의 학급 경제 뉴스레터
                      </h3>
                      <p className="text-xs text-[#1a1a1a]/60 mt-0.5">
                        선생님이 배급한 실시간 경제 소식과 시장 동향을 확인하고 모의투자에 참고하세요.
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setActiveTab('newsletter')}
                    className="h-9 px-4 bg-[#1a1a1a] hover:bg-stone-800 text-white rounded-2xs text-xs font-bold flex items-center gap-1.5 shadow-2xs transition-colors btn-press"
                  >
                    <span>뉴스레터 전체 신문 보기</span>
                    <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
                  </button>
                </div>

                {(state.newsArticles && state.newsArticles.length > 0) ? (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
                    {state.newsArticles.slice(0, 3).map((art) => (
                      <div
                        key={art.id}
                        onClick={() => setActiveTab('newsletter')}
                        className="bg-white p-4 rounded-2xs border border-[#1a1a1a]/15 hover:border-[#1a1a1a]/50 hover:shadow-xs transition-all cursor-pointer flex flex-col justify-between"
                      >
                        <div>
                          <div className="flex items-center justify-between gap-2 mb-2">
                            <div className="flex items-center gap-1.5">
                              {art.isBreaking && (
                                <span className="bg-rose-600 text-white font-bold text-[9px] px-1.5 py-0.5 rounded-2xs animate-pulse">
                                  속보
                                </span>
                              )}
                              <span className="bg-stone-100 text-stone-800 font-bold text-[9px] px-1.5 py-0.5 rounded-2xs border border-stone-200">
                                {art.category === 'stock' ? '기업·증시' : art.category === 'policy' ? '금융·금리' : art.category === 'class' ? '학급소식' : '거시경제'}
                              </span>
                              {art.impact === 'positive' && <span className="text-[9px] font-bold text-emerald-800 bg-emerald-50 px-1 py-0.5 rounded-2xs border border-emerald-200">호재 ▲</span>}
                              {art.impact === 'negative' && <span className="text-[9px] font-bold text-rose-800 bg-rose-50 px-1 py-0.5 rounded-2xs border border-rose-200">악재 ▼</span>}
                            </div>
                            <span className="text-[10px] font-mono text-[#1a1a1a]/40">R{art.publishedRound}</span>
                          </div>
                          <h4 className="font-editorial text-sm font-bold text-[#1a1a1a] line-clamp-2 leading-snug mb-1.5">
                            {art.title}
                          </h4>
                          <p className="text-xs text-stone-600 line-clamp-2 font-serif leading-relaxed">
                            {art.summary || art.content}
                          </p>
                        </div>
                        <div className="pt-2 mt-2 border-t border-[#1a1a1a]/10 flex items-center justify-between text-[10px] font-mono text-[#1a1a1a]/50">
                          <span>{art.author || '경제부'}</span>
                          <span className="text-[#1a1a1a] font-bold underline">전문 읽기 →</span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-6 text-center bg-white rounded-2xs border border-[#1a1a1a]/10 text-stone-400">
                    <p className="text-xs">현재 배급된 뉴스가 없습니다. 선생님의 새로운 소식을 기다려 주세요!</p>
                  </div>
                )}
              </div>
            </div>

            {/* Asset Change History Ledger Table Section */}
            <div className="md:col-span-12">
              <div className="bg-white rounded-sm p-6 border border-[#1a1a1a]/15 shadow-2xs">
                <div className="flex flex-wrap items-center justify-between gap-4 mb-4 pb-3 border-b border-[#1a1a1a]/10">
                  <div className="flex items-center gap-2.5">
                    <span className="material-symbols-outlined text-2xl text-[#1a1a1a]">receipt_long</span>
                    <div>
                      <h3 className="font-editorial text-xl font-bold text-[#1a1a1a]">
                        학생 자산 변동 현황표
                      </h3>
                      <p className="text-xs text-[#1a1a1a]/60 mt-0.5">
                        저축 입출금, 주식 매매, 상점 결제 및 송금 변동 기록을 확인합니다.
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setActiveTab('asset_history')}
                    className="h-9 px-4 bg-[#1a1a1a] hover:bg-stone-800 text-white rounded-2xs text-xs font-bold flex items-center gap-1.5 shadow-2xs transition-colors btn-press"
                  >
                    <span>자산 변동 전체 원장 보기</span>
                    <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
                  </button>
                </div>
                <StudentAssetTable student={currentStudent} showPortfolioSummary={false} />
              </div>
            </div>
          </div>
        )}

        {/* TAB: NEWSLETTER */}
        {activeTab === 'newsletter' && (
          <div className="space-y-6">
            <NewsletterViewer
              onOpenStockModal={(stockId) => {
                setStockDefaultId(stockId);
                setIsStockOpen(true);
              }}
            />
          </div>
        )}

        {/* TAB: DEDICATED ASSET HISTORY & STATUS TABLE */}
        {activeTab === 'asset_history' && (
          <div className="space-y-6">
            <StudentAssetTable student={currentStudent} showPortfolioSummary={true} />
          </div>
        )}

        {/* TAB 2: SHOP & COUPONS */}
        {activeTab === 'shop' && (
          <div className="space-y-6">
            <div className="bg-white rounded-sm p-6 border border-[#1a1a1a]/15 shadow-2xs">
              <div className="mb-6 pb-4 border-b border-[#1a1a1a]/10">
                <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#1a1a1a]/50">CLASS MARKET</span>
                <h2 className="font-editorial text-2xl font-bold text-[#1a1a1a] mt-0.5">
                  학급 상점 아이템 목록
                </h2>
                <p className="text-xs text-[#1a1a1a]/70 mt-1">
                  열심히 모은 학급 통화(현금)로 필요한 학급 쿠폰을 구매해 보세요.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                {state.shopItems.map(item => (
                  <div
                    key={item.id}
                    className="bg-[#faf8f5] p-5 rounded-sm border border-[#1a1a1a]/15 flex flex-col justify-between hover:border-[#1a1a1a]/40 transition-all shadow-2xs"
                  >
                    <div>
                      <div className="text-3xl mb-3">{item.icon}</div>
                      <h4 className="font-bold text-base text-[#1a1a1a]">{item.name}</h4>
                      <p className="text-xs text-[#1a1a1a]/70 mt-1 mb-4 leading-relaxed">{item.description}</p>
                    </div>
                    <div className="flex justify-between items-center pt-3 border-t border-[#1a1a1a]/10">
                      <span className="font-mono font-bold text-[#1a1a1a] text-base">
                        {item.price.toLocaleString()}원
                      </span>
                      <button
                        disabled={buyingItemId === item.id}
                        onClick={() => handleBuyShopItem(item)}
                        className="px-4 py-2 bg-[#1a1a1a] text-white text-xs font-bold uppercase tracking-wider rounded-2xs hover:bg-stone-800 disabled:bg-stone-400 disabled:cursor-not-allowed btn-press"
                      >
                        {buyingItemId === item.id ? '결제 중...' : '구매하기'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* My Coupons Wallet */}
            <div className="bg-white rounded-sm p-6 border border-[#1a1a1a]/15 shadow-2xs">
              <div className="flex flex-wrap justify-between items-center mb-4 pb-2 border-b border-[#1a1a1a]/10 gap-2">
                <h3 className="font-editorial text-xl font-bold text-[#1a1a1a] flex items-center gap-2">
                  <span>🎟️</span> 내 보유 상품·쿠폰함 ({(currentStudent?.couponsOwned || []).length}개)
                </h3>
                <div className="flex items-center gap-3 text-xs text-[#1a1a1a]/70">
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-amber-500 inline-block"></span>
                    확인 대기 (비활성화): {(currentStudent?.couponsOwned || []).filter(c => !c.teacherConfirmed && !c.used).length}개
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-emerald-600 inline-block"></span>
                    사용 완료 (선생님 확인): {(currentStudent?.couponsOwned || []).filter(c => c.teacherConfirmed || c.used).length}개
                  </span>
                </div>
              </div>

              {(currentStudent?.couponsOwned || []).length === 0 ? (
                <div className="text-center py-12 text-[#1a1a1a]/40 text-xs uppercase tracking-wider font-medium bg-[#faf8f5] rounded-2xs border border-dashed border-[#1a1a1a]/15">
                  <span className="text-3xl block mb-2">🎟️</span>
                  보유 중인 상품이나 쿠폰이 없습니다. 상점에서 필요한 상품이나 특권을 구매해 보세요!
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                  {(currentStudent?.couponsOwned || []).map(coupon => {
                    const isConfirmed = Boolean(coupon.teacherConfirmed || coupon.used);

                    return (
                      <div
                        key={coupon.id}
                        className={`p-4 rounded-2xs border flex flex-col justify-between transition-all ${
                          isConfirmed
                            ? 'bg-[#f5f2ed] border-[#1a1a1a]/15 opacity-75'
                            : 'bg-[#faf8f5] border-amber-300/80 shadow-2xs hover:border-amber-400'
                        }`}
                      >
                        <div>
                          <div className="flex justify-between items-start">
                            <span className="text-3xl p-1 bg-white rounded-2xs border border-[#1a1a1a]/10 shadow-2xs">
                              {coupon.icon}
                            </span>
                            <div className="text-right">
                              <span className="text-[10px] font-mono text-[#1a1a1a]/60 block">{coupon.purchasedAt}</span>
                              <span className="text-[11px] font-mono font-bold text-amber-900">
                                {coupon.price.toLocaleString()}원
                              </span>
                            </div>
                          </div>

                          <h4 className="font-bold text-sm text-[#1a1a1a] mt-3">{coupon.name}</h4>

                          {/* Status Description Box */}
                          <div className="mt-2.5 text-[11px]">
                            {isConfirmed ? (
                              <div className="p-2.5 rounded-2xs bg-emerald-50 border border-emerald-200 text-emerald-900 flex flex-col gap-0.5">
                                <span className="font-bold flex items-center gap-1 text-xs text-emerald-800">
                                  <span className="material-symbols-outlined text-sm">verified</span>
                                  선생님 확인 완료 (사용 완료됨)
                                </span>
                                <span className="text-[11px] text-emerald-800/80">
                                  교사의 확인이 완료되어 상품 사용이 정상 처리되었습니다.
                                </span>
                                {(coupon.teacherConfirmedAt || coupon.usedAt) && (
                                  <span className="text-[10px] font-mono text-emerald-700 mt-0.5">
                                    확인일시: {coupon.teacherConfirmedAt || coupon.usedAt}
                                  </span>
                                )}
                              </div>
                            ) : (
                              <div className="p-2.5 rounded-2xs bg-amber-50/90 border border-amber-300/80 text-amber-950 flex flex-col gap-0.5">
                                <span className="font-bold flex items-center gap-1 text-xs text-amber-900">
                                  <span className="material-symbols-outlined text-sm">lock_clock</span>
                                  선생님 확인 대기중 (비활성화)
                                </span>
                                <span className="text-[11px] text-amber-900/85 leading-relaxed">
                                  교사의 확인 완료 전에는 <strong>'사용하기'</strong> 버튼이 비활성화되며, 선생님이 확인 장부에서 확인하면 자동으로 <strong>'사용 완료'</strong> 처리됩니다.
                                </span>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Action Buttons Area */}
                        <div className="mt-4 pt-2.5 border-t border-[#1a1a1a]/10 flex justify-between items-center">
                          <span className="text-[11px] font-medium text-[#1a1a1a]/60">
                            {isConfirmed ? (
                              <span className="text-emerald-800 font-bold flex items-center gap-1">
                                <span className="material-symbols-outlined text-xs">done_all</span>
                                사용 완료됨
                              </span>
                            ) : (
                              <span className="text-amber-900 font-bold flex items-center gap-1">
                                <span className="material-symbols-outlined text-xs">hourglass_empty</span>
                                교사 확인 대기
                              </span>
                            )}
                          </span>

                          {isConfirmed ? (
                            <div className="px-3.5 py-1.5 bg-emerald-100 text-emerald-900 border border-emerald-300 text-xs font-bold rounded-2xs shadow-2xs flex items-center gap-1">
                              <span className="material-symbols-outlined text-xs">check_circle</span>
                              <span>사용 완료</span>
                            </div>
                          ) : (
                            <button
                              type="button"
                              disabled={true}
                              title="교사의 확인 완료 전에는 비활성화되어 있습니다. 선생님이 확인 장부에서 확인하면 사용 완료됩니다."
                              className="px-3.5 py-1.5 bg-stone-200 text-stone-400 border border-stone-300 text-xs font-bold rounded-2xs cursor-not-allowed flex items-center gap-1.5 shadow-none select-none"
                            >
                              <span className="material-symbols-outlined text-xs">lock</span>
                              <span>사용하기</span>
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 3: LESSONS */}
        {activeTab === 'lessons' && (
          <div className="space-y-6">
            <div className="bg-white rounded-sm p-6 border border-[#1a1a1a]/15 shadow-2xs">
              <div className="mb-6 pb-4 border-b border-[#1a1a1a]/10">
                <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#1a1a1a]/50">FINANCIAL ACADEMY</span>
                <h2 className="font-editorial text-2xl font-bold text-[#1a1a1a] mt-0.5">
                  초등 경제 금융 배움터
                </h2>
                <p className="text-xs text-[#1a1a1a]/70 mt-1">
                  쉽고 재미있는 금융 퀴즈와 숏폼 개념 정리로 실전 경제 지식을 키워보세요.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="p-5 bg-[#faf8f5] rounded-sm border border-[#1a1a1a]/15">
                  <div className="text-[10px] font-bold tracking-[0.2em] uppercase text-[#1a1a1a]/50 mb-1">LESSON 1</div>
                  <h3 className="font-editorial text-lg font-bold text-[#1a1a1a] mb-2">복리 이자란 무엇일까요?</h3>
                  <p className="text-xs text-[#1a1a1a]/80 mb-4 leading-relaxed">
                    은행에 돈을 맡기면 은행이 보답으로 주는 돈이 이자입니다. 매 라운드 복리 이자가 늘어나는 원리를 배워보세요.
                  </p>
                  <button
                    onClick={() => alert('퀴즈: 현재 우리 반 예금 이자율 5%로 10,000원을 넣어두면 1라운드 후 얼마가 될까요?\n정답: 10,500원!')}
                    className="px-4 py-2 bg-[#1a1a1a] text-white text-xs font-bold uppercase tracking-wider rounded-2xs hover:bg-stone-800"
                  >
                    개념 퀴즈 풀어보기
                  </button>
                </div>

                <div className="p-5 bg-[#faf8f5] rounded-sm border border-[#1a1a1a]/15">
                  <div className="text-[10px] font-bold tracking-[0.2em] uppercase text-[#1a1a1a]/50 mb-1">LESSON 2</div>
                  <h3 className="font-editorial text-lg font-bold text-[#1a1a1a] mb-2">주가가 변동하는 원리</h3>
                  <p className="text-xs text-[#1a1a1a]/80 mb-4 leading-relaxed">
                    기업의 가치 상승이나 뉴스 호재가 발생하면 주가가 상승하고, 반대인 경우에는 주가가 하락합니다.
                  </p>
                  <button
                    onClick={() => alert('팁: 뉴스 속보를 잘 확인하면 어떤 주식이 오를지 예측할 수 있습니다!')}
                    className="px-4 py-2 bg-[#1a1a1a] text-white text-xs font-bold uppercase tracking-wider rounded-2xs hover:bg-stone-800"
                  >
                    뉴스 분석 팁 보기
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB: LEADERBOARD */}
        {activeTab === 'leaderboard' && (
          state.isLeaderboardPublic === false ? (
            <div className="bg-white rounded-sm p-8 sm:p-12 border border-[#1a1a1a]/15 shadow-2xs text-center max-w-xl mx-auto my-6 animate-fade-in">
              <div className="w-16 h-16 rounded-full bg-amber-50 border border-amber-300 text-amber-800 flex items-center justify-center mx-auto mb-4 text-3xl shadow-2xs">
                🔒
              </div>
              <div className="inline-block px-3 py-1 bg-amber-100 border border-amber-300 rounded-full text-amber-900 text-xs font-bold mb-3">
                학급 랭킹 비공개 운영 중
              </div>
              <h2 className="font-editorial text-2xl sm:text-3xl font-bold text-[#1a1a1a] mb-3">
                학급 랭킹이 비공개로 설정되어 있습니다
              </h2>
              <p className="text-xs sm:text-sm text-[#1a1a1a]/70 leading-relaxed mb-6">
                선생님께서 우리 반 친구들이 순위 경쟁보다는 <strong>합리적인 소비, 규칙적인 저축, 지혜로운 분산 투자</strong>를 스스로 실천할 수 있도록 학급 랭킹을 비공개로 설정하셨습니다.<br /><br />
                친구들과의 비교 대신, 나만의 경제 목표를 달성해 보세요!
              </p>

              <div className="p-5 bg-[#faf8f5] rounded-2xs border border-[#1a1a1a]/15 text-left mb-6">
                <div className="flex items-center justify-between pb-3 border-b border-[#1a1a1a]/10">
                  <span className="text-xs font-bold text-[#1a1a1a]/70">나의 현재 총 자산 ({currentStudent.name})</span>
                  <span className="font-editorial text-xl font-bold text-[#1a1a1a]">
                    {totalAssets.toLocaleString()}<span className="text-xs font-normal font-sans ml-1">{state.currencyUnit || '원'}</span>
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2 pt-3 text-center">
                  <div className="p-2.5 bg-white rounded-2xs border border-[#1a1a1a]/10">
                    <div className="text-[10px] text-[#1a1a1a]/60">보유 현금</div>
                    <div className="font-mono font-bold text-xs text-[#1a1a1a] mt-0.5">
                      {(Number(currentStudent.cash) || 0).toLocaleString()} {state.currencyUnit || '원'}
                    </div>
                  </div>
                  <div className="p-2.5 bg-white rounded-2xs border border-[#1a1a1a]/10">
                    <div className="text-[10px] text-[#1a1a1a]/60">저축 예금</div>
                    <div className="font-mono font-bold text-xs text-emerald-800 mt-0.5">
                      {(Number(currentStudent.savings) || 0).toLocaleString()} {state.currencyUnit || '원'}
                    </div>
                  </div>
                  <div className="p-2.5 bg-white rounded-2xs border border-[#1a1a1a]/10">
                    <div className="text-[10px] text-[#1a1a1a]/60">주식 평가액</div>
                    <div className="font-mono font-bold text-xs text-blue-800 mt-0.5">
                      {((state.stocks || []).reduce((sum, st) => sum + ((currentStudent.stockShares || {})[st.id] || 0) * (st.currentPrice || 0), 0)).toLocaleString()} {state.currencyUnit || '원'}
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={() => setActiveTab('dashboard')}
                  className="px-5 py-2.5 bg-[#1a1a1a] hover:bg-stone-800 text-white rounded-2xs font-bold text-xs uppercase tracking-wider flex items-center gap-1.5 shadow-2xs transition-all btn-press"
                >
                  <span className="material-symbols-outlined text-[16px]">dashboard</span>
                  내 계좌 대시보드로 이동
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('asset_history')}
                  className="px-5 py-2.5 bg-white hover:bg-stone-50 border border-[#1a1a1a]/20 text-[#1a1a1a] rounded-2xs font-bold text-xs uppercase tracking-wider flex items-center gap-1.5 shadow-2xs transition-all btn-press"
                >
                  <span className="material-symbols-outlined text-[16px]">receipt_long</span>
                  자산 변동표 확인하기
                </button>
              </div>
            </div>
          ) : (() => {
            const rankedList = (state.students || [])
            .map(s => {
              const stockVal = (state.stocks || []).reduce((sum, st) => sum + ((s.stockShares || {})[st.id] || 0) * (st.currentPrice || 0), 0);
              const total = (Number(s.cash) || 0) + (Number(s.savings) || 0) + stockVal;
              return {
                ...s,
                stockValue: stockVal,
                totalAssets: total
              };
            })
            .sort((a, b) => b.totalAssets - a.totalAssets);

          const myIndex = rankedList.findIndex(s => s.id === currentStudent.id);
          const myRank = myIndex !== -1 ? myIndex + 1 : '-';

          return (
            <div className="space-y-6">
              {/* Leaderboard Header */}
              <div className="bg-white rounded-sm p-6 border border-[#1a1a1a]/15 shadow-2xs">
                <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-[#1a1a1a]/10">
                  <div>
                    <h2 className="font-editorial text-2xl font-bold text-[#1a1a1a] flex items-center gap-2">
                      🏆 실시간 학급 자산 순위
                    </h2>
                    <p className="text-xs text-[#1a1a1a]/60 mt-1">
                      현재 Round {state.currentRound} 기준 우리 반 친구들의 자산 랭킹입니다.
                    </p>
                  </div>

                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => refreshClassData(true)}
                      disabled={isSyncing}
                      className={`h-10 px-4 bg-[#1a1a1a] hover:bg-stone-800 text-white rounded-2xs font-bold text-xs uppercase tracking-wider flex items-center gap-2 shadow-2xs transition-all ${
                        isSyncing ? 'opacity-70 cursor-not-allowed' : 'btn-press'
                      }`}
                    >
                      <span className={`material-symbols-outlined text-[18px] text-amber-300 ${isSyncing ? 'animate-spin' : ''}`}>
                        sync
                      </span>
                      <span>{isSyncing ? '동기화 중...' : '실시간 랭킹 새로고침'}</span>
                    </button>
                  </div>
                </div>

                {/* My Rank Summary Box */}
                <div className="mt-4 p-4 bg-gradient-to-r from-amber-50 to-orange-50 rounded-sm border border-amber-300 flex flex-wrap items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-amber-400 text-stone-950 font-black text-xl flex items-center justify-center shadow-xs">
                      {myRank === 1 ? '👑' : myRank === 2 ? '🥈' : myRank === 3 ? '🥉' : `${myRank}위`}
                    </div>
                    <div>
                      <div className="text-[11px] font-bold uppercase tracking-wider text-amber-900">
                        나의 현재 학급 순위 ({currentStudent.name})
                      </div>
                      <div className="text-xl font-editorial font-bold text-stone-950">
                        총 {state.students.length}명 중 <span className="text-amber-800 underline font-black">{myRank}위</span>
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-[10px] text-stone-500 font-medium">내 총 자산 평가액</div>
                    <div className="font-mono font-bold text-xl text-stone-900">
                      {totalAssets.toLocaleString()}원
                    </div>
                  </div>
                </div>
              </div>

              {/* Top 3 Podium Highlights */}
              {rankedList.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {rankedList.slice(0, 3).map((st, i) => (
                    <div
                      key={st.id}
                      className={`p-4 rounded-sm border shadow-2xs relative ${
                        st.id === currentStudent.id
                          ? 'bg-amber-50/70 border-amber-400 ring-2 ring-amber-300'
                          : i === 0
                          ? 'bg-gradient-to-b from-amber-50 to-white border-amber-300'
                          : i === 1
                          ? 'bg-gradient-to-b from-stone-100 to-white border-stone-300'
                          : 'bg-gradient-to-b from-orange-50 to-white border-orange-200'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-2xs ${
                          i === 0 ? 'bg-amber-400 text-stone-950' : i === 1 ? 'bg-stone-300 text-stone-900' : 'bg-orange-300 text-orange-950'
                        }`}>
                          {i === 0 ? '🥇 1위' : i === 1 ? '🥈 2위' : '🥉 3위'}
                        </span>
                        <span className="text-xs font-mono text-[#1a1a1a]/50">{st.number}번</span>
                      </div>
                      <div className="font-editorial text-lg font-bold text-[#1a1a1a]">
                        {st.name} {st.id === currentStudent.id && <span className="text-xs text-amber-700 font-sans font-bold">(나)</span>}
                      </div>
                      <div className="font-mono text-xl font-bold text-[#1a1a1a] mt-1">
                        {st.totalAssets.toLocaleString()}원
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Full Leaderboard Table */}
              <div className="bg-white rounded-sm shadow-2xs border border-[#1a1a1a]/15 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse min-w-[550px]">
                    <thead className="bg-[#faf8f5] border-b border-[#1a1a1a]/15 text-[11px] font-bold uppercase tracking-wider text-[#1a1a1a]/60">
                      <tr>
                        <th className="py-3 px-4 w-16 text-center">순위</th>
                        <th className="py-3 px-4">학생 성명</th>
                        <th className="py-3 px-4 text-right">보유 현금</th>
                        <th className="py-3 px-4 text-right">은행 예금</th>
                        <th className="py-3 px-4 text-right">주식 자산</th>
                        <th className="py-3 px-4 text-right">총 자산 평가액</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#1a1a1a]/10 text-xs font-medium">
                      {rankedList.map((st, idx) => {
                        const isMe = st.id === currentStudent.id;
                        return (
                          <tr
                            key={st.id}
                            className={`transition-colors ${
                              isMe ? 'bg-amber-100/70 font-bold border-l-4 border-amber-600' : 'hover:bg-[#faf8f5]'
                            }`}
                          >
                            <td className="py-3.5 px-4 text-center font-editorial font-bold text-sm text-[#1a1a1a]">
                              {idx === 0 ? '🥇 1' : idx === 1 ? '🥈 2' : idx === 2 ? '🥉 3' : idx + 1}
                            </td>
                            <td className="py-3.5 px-4">
                              <div className="font-bold text-[#1a1a1a] flex items-center gap-1.5">
                                <span>{st.name}</span>
                                <span className="text-[11px] font-mono text-[#1a1a1a]/50">({st.number}번)</span>
                                {isMe && (
                                  <span className="text-[10px] bg-amber-200 text-amber-900 px-1.5 py-0.2 rounded font-bold">
                                    나
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="py-3.5 px-4 text-right font-mono">{st.cash.toLocaleString()}원</td>
                            <td className="py-3.5 px-4 text-right font-mono font-bold text-emerald-900">{st.savings.toLocaleString()}원</td>
                            <td className="py-3.5 px-4 text-right font-mono text-stone-700">{st.stockValue.toLocaleString()}원</td>
                            <td className="py-3.5 px-4 text-right font-mono font-bold text-sm text-[#1a1a1a]">
                              {st.totalAssets.toLocaleString()}원
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
        })())}

        {/* TAB 4: PROFILE */}
        {activeTab === 'profile' && (
          <div className="space-y-6">
            <div className="bg-white rounded-sm p-6 border border-[#1a1a1a]/15 shadow-2xs">
              <div className="flex justify-between items-center mb-4 pb-2 border-b border-[#1a1a1a]/10">
                <h2 className="font-editorial text-2xl font-bold text-[#1a1a1a] flex items-center gap-2">
                  내 계정 프로필 & 거래 기록
                </h2>
                <button
                  onClick={logout}
                  className="px-3.5 py-1.5 bg-stone-900 text-white rounded-2xs text-xs font-bold flex items-center gap-1 hover:bg-stone-800 transition-colors shadow-2xs"
                >
                  <span className="material-symbols-outlined text-[16px]">logout</span>
                  로그아웃
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
                <div className="p-4 bg-[#faf8f5] rounded-2xs border border-[#1a1a1a]/12">
                  <div className="text-[10px] font-bold tracking-widest uppercase text-[#1a1a1a]/50">학생 번호</div>
                  <div className="font-editorial font-bold text-xl text-[#1a1a1a] mt-1">{currentStudent.number}번</div>
                </div>
                <div className="p-4 bg-[#faf8f5] rounded-2xs border border-[#1a1a1a]/12">
                  <div className="text-[10px] font-bold tracking-widest uppercase text-[#1a1a1a]/50">성명 / 아이디</div>
                  <div className="font-bold text-base text-[#1a1a1a] mt-1">{currentStudent.name} <span className="font-mono text-xs font-normal text-[#1a1a1a]/60">({currentStudent.username})</span></div>
                </div>
                <div className="p-4 bg-[#faf8f5] rounded-2xs border border-[#1a1a1a]/12 flex flex-col justify-between">
                  <div>
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] font-bold tracking-widest uppercase text-[#1a1a1a]/50">보안 PIN 비밀번호</span>
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                        currentStudent.isPinChanged ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                      }`}>
                        {currentStudent.isPinChanged ? '설정 완료' : '기본 비밀번호'}
                      </span>
                    </div>
                    <div className="font-mono font-bold text-base text-[#1a1a1a] mt-1">
                      {currentStudent.pin ? '●'.repeat(currentStudent.pin.length) : '****'}
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setIsFirstTimePinModal(false);
                      setIsPinModalOpen(true);
                    }}
                    className="mt-2 h-8 px-3 bg-[#005da7] hover:bg-[#004883] text-white rounded-2xs text-xs font-bold flex items-center justify-center gap-1 transition-colors shadow-2xs"
                  >
                    <span className="material-symbols-outlined text-[14px]">lock_reset</span>
                    비밀번호 변경
                  </button>
                </div>
              </div>

              <div className="mt-8 pt-6 border-t border-[#1a1a1a]/10">
                <h3 className="font-editorial text-xl font-bold text-[#1a1a1a] mb-4">내 자산 변동 현황표 (원장)</h3>
                <StudentAssetTable student={currentStudent} showPortfolioSummary={false} />
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Mobile Bottom Navigation Bar */}
      <nav className="md:hidden fixed bottom-0 left-0 w-full z-40 flex justify-around items-center h-16 px-2 bg-[#faf8f5] border-t border-[#1a1a1a]/15 shadow-sm">
        <button
          onClick={() => setActiveTab('dashboard')}
          className={`flex flex-col items-center justify-center rounded-2xs px-2 py-1 transition-all ${
            activeTab === 'dashboard'
              ? 'bg-[#1a1a1a] text-white'
              : 'text-[#1a1a1a]/70'
          }`}
        >
          <span className="material-symbols-outlined text-lg">dashboard</span>
          <span className="font-bold text-[9px] uppercase tracking-wider">자산</span>
        </button>

        <button
          onClick={() => setActiveTab('newsletter')}
          className={`flex flex-col items-center justify-center rounded-2xs px-2 py-1 transition-all ${
            activeTab === 'newsletter'
              ? 'bg-[#1a1a1a] text-white'
              : 'text-[#1a1a1a]/70'
          }`}
        >
          <span className="material-symbols-outlined text-lg">newspaper</span>
          <span className="font-bold text-[9px] uppercase tracking-wider">뉴스</span>
        </button>

        <button
          onClick={() => setActiveTab('asset_history')}
          className={`flex flex-col items-center justify-center rounded-2xs px-2 py-1 transition-all ${
            activeTab === 'asset_history'
              ? 'bg-[#1a1a1a] text-white'
              : 'text-[#1a1a1a]/70'
          }`}
        >
          <span className="material-symbols-outlined text-lg">receipt_long</span>
          <span className="font-bold text-[9px] uppercase tracking-wider">변동표</span>
        </button>

        <button
          onClick={() => setActiveTab('leaderboard')}
          className={`flex flex-col items-center justify-center rounded-2xs px-2 py-1 transition-all ${
            activeTab === 'leaderboard'
              ? 'bg-[#1a1a1a] text-white'
              : 'text-[#1a1a1a]/70'
          }`}
        >
          <span className="material-symbols-outlined text-lg">
            {state.isLeaderboardPublic !== false ? 'leaderboard' : 'lock'}
          </span>
          <span className="font-bold text-[9px] uppercase tracking-wider">
            {state.isLeaderboardPublic !== false ? '랭킹' : '비공개'}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('shop')}
          className={`flex flex-col items-center justify-center rounded-2xs px-2 py-1 transition-all ${
            activeTab === 'shop'
              ? 'bg-[#1a1a1a] text-white'
              : 'text-[#1a1a1a]/70'
          }`}
        >
          <span className="material-symbols-outlined text-lg">shopping_bag</span>
          <span className="font-bold text-[9px] uppercase tracking-wider">상점</span>
        </button>

        <button
          onClick={() => setActiveTab('lessons')}
          className={`flex flex-col items-center justify-center rounded-2xs px-2 py-1 transition-all ${
            activeTab === 'lessons'
              ? 'bg-[#1a1a1a] text-white'
              : 'text-[#1a1a1a]/70'
          }`}
        >
          <span className="material-symbols-outlined text-lg">school</span>
          <span className="font-bold text-[9px] uppercase tracking-wider">배움터</span>
        </button>
      </nav>

      {/* Modals */}
      {isNewsletterModalOpen && (
        <NewsletterViewer
          isModal
          onClose={() => setIsNewsletterModalOpen(false)}
          onOpenStockModal={(stockId) => {
            setIsNewsletterModalOpen(false);
            setStockDefaultId(stockId);
            setIsStockOpen(true);
          }}
        />
      )}
      <SendMoneyModal isOpen={isSendMoneyOpen} onClose={() => setIsSendMoneyOpen(false)} />
      <SavingsModal
        isOpen={isSavingsOpen}
        onClose={() => setIsSavingsOpen(false)}
        defaultMode={savingsDefaultMode}
      />
      <StockModal
        isOpen={isStockOpen}
        onClose={() => setIsStockOpen(false)}
        defaultStockId={stockDefaultId}
      />
      <RebalanceModal
        isOpen={isRebalanceOpen}
        onClose={() => setIsRebalanceOpen(false)}
      />
      <StudentPinModal
        isOpen={isPinModalOpen}
        isFirstTime={isFirstTimePinModal}
        student={currentStudent}
        onClose={() => {
          setIsPinModalOpen(false);
          setIsFirstTimePinModal(false);
        }}
      />
      <RepayDebtModal
        isOpen={isRepayDebtOpen}
        onClose={() => setIsRepayDebtOpen(false)}
      />
    </div>
  );
};
