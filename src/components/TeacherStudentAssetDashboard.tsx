import React, { useState, useMemo } from 'react';
import { useClassEconomy } from '../context/ClassEconomyContext';
import { Student, Transaction, StudentRoundSnapshot } from '../types';
import { getEnrichedStudentTransactions, reconstructStudentRoundHistory } from '../utils/studentAnalytics';
import { syncStudentNonBalanceFieldsFromTeacher } from '../lib/firebase';

interface TeacherStudentAssetDashboardProps {
  initialStudentId?: string;
  onSelectStudent?: (studentId: string) => void;
}

export const TeacherStudentAssetDashboard: React.FC<TeacherStudentAssetDashboardProps> = ({
  initialStudentId,
  onSelectStudent
}) => {
  const { state, calculateTotalAssets, forgiveStudentDebt } = useClassEconomy();
  const students = useClassEconomy().state.students || [];

  // Selected Student ID
  const [selectedId, setSelectedId] = useState<string>(() => {
    if (initialStudentId && students.some(s => s.id === initialStudentId)) {
      return initialStudentId;
    }
    return students.length > 0 ? students[0].id : '';
  });

  // Search filter for student picker
  const [studentSearch, setStudentSearch] = useState<string>('');
  const [showPin, setShowPin] = useState<boolean>(false);
  const [txCategoryFilter, setTxCategoryFilter] = useState<string>('all');
  const [txSearch, setTxSearch] = useState<string>('');

  // Keep selectedId valid if students list changes
  React.useEffect(() => {
    if (students.length > 0 && !students.some(s => s.id === selectedId)) {
      setSelectedId(students[0].id);
    }
  }, [students, selectedId]);

  const currentStudent = useMemo(() => {
    return students.find(s => s.id === selectedId) || students[0];
  }, [students, selectedId]);

  const currentIndex = useMemo(() => {
    return students.findIndex(s => s.id === (currentStudent?.id || ''));
  }, [students, currentStudent]);

  // Handle Stepper
  const handlePrevStudent = () => {
    if (students.length === 0) return;
    const nextIdx = (currentIndex - 1 + students.length) % students.length;
    setSelectedId(students[nextIdx].id);
    if (onSelectStudent) onSelectStudent(students[nextIdx].id);
  };

  const handleNextStudent = () => {
    if (students.length === 0) return;
    const nextIdx = (currentIndex + 1) % students.length;
    setSelectedId(students[nextIdx].id);
    if (onSelectStudent) onSelectStudent(students[nextIdx].id);
  };

  // Calculate ranks
  const rankedStudents = useMemo(() => {
    return [...students].sort((a, b) => calculateTotalAssets(b) - calculateTotalAssets(a));
  }, [students, calculateTotalAssets]);

  const studentRank = useMemo(() => {
    if (!currentStudent) return 0;
    const idx = rankedStudents.findIndex(s => s.id === currentStudent.id);
    return idx >= 0 ? idx + 1 : 0;
  }, [rankedStudents, currentStudent]);

  const classAverageAssets = useMemo(() => {
    if (students.length === 0) return 0;
    const total = students.reduce((sum, s) => sum + calculateTotalAssets(s), 0);
    return Math.round(total / students.length);
  }, [students, calculateTotalAssets]);

  // Current student metrics
  const cash = currentStudent?.cash || 0;
  const savings = currentStudent?.savings || 0;

  // Stock holdings
  const stockHoldings = useMemo(() => {
    if (!currentStudent) return [];
    const sharesMap = currentStudent.stockShares || {};
    return (state.stocks || []).map(st => {
      const shares = sharesMap[st.id] || 0;
      const value = Math.round(shares * (st.currentPrice || 0));
      const prevPrice = st.previousPrice || st.currentPrice;
      const changeRate = prevPrice > 0 ? parseFloat((((st.currentPrice - prevPrice) / prevPrice) * 100).toFixed(1)) : 0;
      return {
        stock: st,
        shares,
        value,
        changeRate
      };
    });
  }, [currentStudent, state.stocks]);

  const totalStockValue = useMemo(() => {
    return stockHoldings.reduce((sum, h) => sum + h.value, 0);
  }, [stockHoldings]);

  const studentDebt = Math.max(0, currentStudent?.debt || 0);
  const totalAssets = Math.round(cash + savings + totalStockValue - studentDebt);

  // Asset Allocation Percentages
  const cashPct = totalAssets > 0 ? Math.round((cash / totalAssets) * 100) : 0;
  const savingsPct = totalAssets > 0 ? Math.round((savings / totalAssets) * 100) : 0;
  const stockPct = totalAssets > 0 ? Math.max(0, 100 - cashPct - savingsPct) : 0;

  // Enriched and matched transactions for current student (including coupons and stock actions)
  const studentTransactions = useMemo(() => {
    if (!currentStudent) return [];
    return getEnrichedStudentTransactions(
      currentStudent,
      state.transactions || [],
      state.stocks || [],
      state.currentRound || 1,
      state.depositInterestRate || 5.0
    );
  }, [currentStudent, state.transactions, state.stocks, state.currentRound, state.depositInterestRate]);

  // Reconstruct round-by-round trajectory & analytics
  const analyticsData = useMemo(() => {
    if (!currentStudent) {
      return {
        roundHistory: [],
        totalIncome: 0,
        totalExpense: 0,
        incomeBreakdown: { reward: 0, interest: 0, stockSell: 0, transferIn: 0, other: 0 },
        expenseBreakdown: { shop: 0, stockBuy: 0, fine: 0, transferOut: 0, other: 0 }
      };
    }
    return reconstructStudentRoundHistory(
      currentStudent,
      state.currentRound || 1,
      state.transactions || [],
      state.stocks || [],
      state.depositInterestRate || 5.0
    );
  }, [currentStudent, state.currentRound, state.transactions, state.stocks, state.depositInterestRate]);

  const currencyUnit = state.currencyUnit || '원';

  const roundHistoryData = analyticsData.roundHistory;
  const baseAsset = analyticsData.initialBaseAsset || 30000;

  const incomeDetails = {
    totalIncome: analyticsData.totalIncome,
    rewardTotal: analyticsData.incomeBreakdown.reward,
    interestTotal: analyticsData.incomeBreakdown.interest,
    stockSellTotal: analyticsData.incomeBreakdown.stockSell,
    transferInTotal: analyticsData.incomeBreakdown.transferIn
  };

  const expenseDetails = {
    totalExpense: analyticsData.totalExpense,
    shopTotal: analyticsData.expenseBreakdown.shop,
    stockBuyTotal: analyticsData.expenseBreakdown.stockBuy,
    fineTotal: analyticsData.expenseBreakdown.fine,
    transferOutTotal: analyticsData.expenseBreakdown.transferOut
  };

  // Auto-sync reconstructed past snapshots to Firestore so they are permanently preserved in the cloud
  React.useEffect(() => {
    if (!currentStudent || !state.classCode) return;
    const pastSnapshots = analyticsData.roundHistory.filter(s => s.round < state.currentRound);
    if (pastSnapshots.length === 0) return;

    const existingHistory = Array.isArray(currentStudent.roundHistory) ? currentStudent.roundHistory : [];
    const hasFakeData = existingHistory.some(s => s && s.notes && s.notes.includes('(+1.0%)'));
    if (hasFakeData || existingHistory.length < pastSnapshots.length) {
      syncStudentNonBalanceFieldsFromTeacher(state.classCode, currentStudent.id, {
        roundHistory: pastSnapshots
      }).catch(err => {
        console.warn('Syncing reconstructed round history to Firestore error:', err);
      });
    }
  }, [currentStudent, analyticsData.roundHistory, state.classCode, state.currentRound]);

  // Max asset across rounds for bar chart scaling
  const maxRoundAsset = useMemo(() => {
    return Math.max(1, ...roundHistoryData.map(d => d.totalAssets));
  }, [roundHistoryData]);

  // Filtered student transactions
  const filteredTxs = useMemo(() => {
    return studentTransactions
      .filter(tx => {
        if (txCategoryFilter === 'savings') {
          return tx.type === 'deposit' || tx.type === 'withdraw' || tx.description.includes('저축') || tx.description.includes('예금');
        }
        if (txCategoryFilter === 'stocks') {
          return tx.type === 'stock_buy' || tx.type === 'stock_sell' || tx.description.includes('주식') || tx.description.includes('매수') || tx.description.includes('매도');
        }
        if (txCategoryFilter === 'shop') {
          return tx.type === 'shop_buy' || tx.description.includes('상점') || tx.description.includes('쿠폰');
        }
        if (txCategoryFilter === 'reward') {
          return tx.type === 'reward' || tx.description.includes('상금') || tx.description.includes('기본급') || tx.description.includes('이자');
        }
        if (txCategoryFilter === 'fine') {
          return tx.type === 'fine' || tx.description.includes('벌금') || tx.description.includes('세금');
        }
        if (txCategoryFilter === 'transfer') {
          return tx.type === 'transfer' || tx.description.includes('송금') || tx.description.includes('수령');
        }
        return true;
      })
      .filter(tx => {
        if (!txSearch.trim()) return true;
        const q = txSearch.toLowerCase();
        return (
          tx.description.toLowerCase().includes(q) ||
          tx.type.toLowerCase().includes(q) ||
          String(tx.amount).includes(q) ||
          (tx.timestamp && tx.timestamp.toLowerCase().includes(q))
        );
      });
  }, [studentTransactions, txCategoryFilter, txSearch]);

  // Export Individual Student Report to CSV
  const handleExportStudentCsv = () => {
    if (!currentStudent) return;

    let csv = `\uFEFF[키즈리치스쿨] 학생 개인별 자산 변동 리포트\n`;
    csv += `학생명,${currentStudent.name},학번,${currentStudent.number}번,아이디,${currentStudent.username}\n`;
    csv += `현재 라운드,Round ${state.currentRound},학급 순위,${studentRank}위 / ${students.length}명,총 자산,${totalAssets.toLocaleString()}원\n`;
    csv += `현금 잔액,${cash.toLocaleString()}원 (${cashPct}%),저축 잔액,${savings.toLocaleString()}원 (${savingsPct}%),주식 평가액,${totalStockValue.toLocaleString()}원 (${stockPct}%)\n`;
    csv += `총 수입,${incomeDetails.totalIncome.toLocaleString()}원,총 지출,${expenseDetails.totalExpense.toLocaleString()}원,순수익(현금흐름),${(incomeDetails.totalIncome - expenseDetails.totalExpense).toLocaleString()}원\n\n`;

    // Round-by-round section
    csv += `[라운드별 자산 합계 변동표]\n`;
    csv += `라운드,현금,저축,주식 평가액,총자산 합계,직전 라운드 대비 변동액,변동률,비고\n`;
    roundHistoryData.forEach(r => {
      csv += `Round ${r.round},${r.cash},${r.savings},${r.stockValue},${r.totalAssets},${r.changeAmount >= 0 ? '+' : ''}${r.changeAmount},${r.changeRate}%,${r.notes.replace(/,/g, ' ')}\n`;
    });
    csv += `\n`;

    // Stock holdings section
    csv += `[주식 투자 종목 및 변동 현황]\n`;
    csv += `종목명,카테고리,보유수량,현재가,등락률,보유 평가액,주식 포트폴리오 비중\n`;
    stockHoldings.forEach(h => {
      const pct = totalStockValue > 0 ? ((h.value / totalStockValue) * 100).toFixed(1) : '0';
      csv += `${h.stock.name},${h.stock.category},${h.shares}주,${h.stock.currentPrice}원,${h.changeRate}%,${h.value}원,${pct}%\n`;
    });
    csv += `\n`;

    // Transaction History section
    csv += `[상세 거래 및 자산 변동 내역]\n`;
    csv += `일시,분류,상세 내용,금액\n`;
    studentTransactions.forEach(t => {
      csv += `${t.timestamp || '-'},${t.type},"${(t.description || '').replace(/"/g, '""')}",${t.amount}\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${currentStudent.number}번_${currentStudent.name}_개인자산분석리포트_Round${state.currentRound}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Filtered list of students for quick carousel/pills
  const filteredStudentPills = useMemo(() => {
    if (!studentSearch.trim()) return students;
    const q = studentSearch.trim().toLowerCase();
    return students.filter(
      s =>
        s.name.toLowerCase().includes(q) ||
        String(s.number).includes(q) ||
        s.username.toLowerCase().includes(q)
    );
  }, [students, studentSearch]);

  if (!currentStudent) {
    return (
      <div className="bg-white rounded-sm p-8 text-center border border-[#1a1a1a]/15 shadow-2xs">
        <span className="material-symbols-outlined text-4xl text-[#1a1a1a]/40 mb-2">person_off</span>
        <h3 className="font-editorial text-lg font-bold text-[#1a1a1a]">등록된 학생이 없습니다.</h3>
        <p className="text-xs text-[#1a1a1a]/60 mt-1">[학생 계정 & PIN 관리] 탭에서 학생을 먼저 추가해 주세요.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* 1. Header Banner & Student Selector Strip */}
      <div className="bg-white rounded-sm p-5 md:p-6 shadow-2xs border border-[#1a1a1a]/15">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-5 border-b border-[#1a1a1a]/12">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-2xs text-[11px] font-bold bg-[#1a1a1a] text-amber-300">
                <span className="material-symbols-outlined text-[14px]">query_stats</span>
                대시보드
              </span>
              <h2 className="font-editorial text-xl md:text-2xl font-bold text-[#1a1a1a]">
                학생 개인별 자산 변동 현황 분석
              </h2>
            </div>
            <p className="text-xs text-[#1a1a1a]/65 mt-1 leading-relaxed">
              선택한 학생의 <strong>수입·지출 흐름</strong>, <strong>주식/저축/현금 비중</strong>, <strong>보유 종목 등락 상황</strong> 및 <strong>라운드별 자산 총계 변동 추이</strong>를 종합 진단합니다.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {/* Prev / Next Student Quick Nav */}
            <div className="flex items-center gap-1 bg-[#faf8f5] p-1 rounded-2xs border border-[#1a1a1a]/15 shadow-2xs">
              <button
                type="button"
                onClick={handlePrevStudent}
                title="이전 번호 학생 (단축키: ◀)"
                className="h-8 px-2.5 bg-white hover:bg-stone-100 border border-[#1a1a1a]/15 rounded-2xs font-bold text-xs text-[#1a1a1a] flex items-center gap-1 transition-colors btn-press"
              >
                <span className="material-symbols-outlined text-[16px]">chevron_left</span>
                <span className="hidden sm:inline">이전 학생</span>
              </button>
              <span className="px-2 font-mono text-xs font-bold text-[#1a1a1a]/70">
                {currentIndex + 1} / {students.length}
              </span>
              <button
                type="button"
                onClick={handleNextStudent}
                title="다음 번호 학생 (단축키: ▶)"
                className="h-8 px-2.5 bg-white hover:bg-stone-100 border border-[#1a1a1a]/15 rounded-2xs font-bold text-xs text-[#1a1a1a] flex items-center gap-1 transition-colors btn-press"
              >
                <span className="hidden sm:inline">다음 학생</span>
                <span className="material-symbols-outlined text-[16px]">chevron_right</span>
              </button>
            </div>

            {/* Export CSV button */}
            <button
              type="button"
              onClick={handleExportStudentCsv}
              className="h-10 px-3.5 bg-emerald-800 hover:bg-emerald-900 text-white rounded-2xs font-bold text-xs flex items-center gap-1.5 transition-all shadow-2xs btn-press"
            >
              <span className="material-symbols-outlined text-[17px]">download</span>
              <span>개인 리포트 CSV</span>
            </button>
          </div>
        </div>

        {/* Student Quick Pill Carousel & Dropdown */}
        <div className="pt-4 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <span className="text-xs font-bold text-[#1a1a1a] shrink-0">학생 선택:</span>
            <select
              value={selectedId}
              onChange={e => {
                setSelectedId(e.target.value);
                if (onSelectStudent) onSelectStudent(e.target.value);
              }}
              className="h-9 px-3 bg-[#faf8f5] border border-[#1a1a1a]/25 rounded-2xs text-xs font-bold text-[#1a1a1a] focus:outline-none focus:border-[#1a1a1a] min-w-[200px]"
            >
              {students.map(s => {
                const sTotal = calculateTotalAssets(s);
                return (
                  <option key={s.id} value={s.id}>
                    {s.number}번 {s.name} ({sTotal.toLocaleString()}원)
                  </option>
                );
              })}
            </select>

            {/* Quick Search */}
            <div className="relative flex-1 max-w-xs hidden sm:block">
              <span className="material-symbols-outlined absolute left-2.5 top-2 text-[#1a1a1a]/40 text-[18px]">
                search
              </span>
              <input
                type="text"
                placeholder="학생 번호/이름 빠른 검색..."
                value={studentSearch}
                onChange={e => setStudentSearch(e.target.value)}
                className="w-full h-9 pl-8 pr-3 bg-[#faf8f5] border border-[#1a1a1a]/20 rounded-2xs text-xs text-[#1a1a1a] placeholder-[#1a1a1a]/40 focus:outline-none focus:border-[#1a1a1a]"
              />
            </div>
          </div>

          <div className="text-xs font-mono text-[#1a1a1a]/60 text-right">
            학급 평균 자산: <strong className="text-[#1a1a1a] font-bold">{classAverageAssets.toLocaleString()}원</strong>
          </div>
        </div>

        {/* Quick Student Mini Pills */}
        <div className="mt-3 flex gap-1.5 overflow-x-auto no-scrollbar pb-1">
          {filteredStudentPills.map(s => {
            const isSelected = s.id === currentStudent.id;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => {
                  setSelectedId(s.id);
                  if (onSelectStudent) onSelectStudent(s.id);
                }}
                className={`px-2.5 py-1.5 rounded-2xs text-xs font-bold shrink-0 transition-all border flex items-center gap-1.5 ${
                  isSelected
                    ? 'bg-[#1a1a1a] text-white border-[#1a1a1a] shadow-2xs'
                    : 'bg-[#faf8f5] text-[#1a1a1a]/80 border-[#1a1a1a]/15 hover:bg-stone-200/70'
                }`}
              >
                <span className={`w-4 h-4 rounded-full text-[10px] flex items-center justify-center font-mono ${
                  isSelected ? 'bg-amber-300 text-[#1a1a1a]' : 'bg-stone-300 text-[#1a1a1a]'
                }`}>
                  {s.number}
                </span>
                <span>{s.name}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 2. Selected Student Profile Banner */}
      <div className="bg-gradient-to-r from-stone-900 to-[#1a1a1a] text-white rounded-sm p-6 shadow-md border border-[#1a1a1a] flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xs bg-amber-400 text-[#1a1a1a] flex items-center justify-center font-editorial font-bold text-3xl shadow-inner shrink-0">
            {currentStudent.number}
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-editorial text-2xl font-bold text-white tracking-wide">
                {currentStudent.name}
              </h3>
              <span className="text-xs font-mono text-stone-300 bg-white/10 px-2 py-0.5 rounded-2xs border border-white/15">
                @{currentStudent.username}
              </span>
              <span className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-2xs ${
                currentStudent.isOnline ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/40' : 'bg-stone-700 text-stone-400'
              }`}>
                <span className={`w-2 h-2 rounded-full ${currentStudent.isOnline ? 'bg-emerald-400 animate-pulse' : 'bg-stone-400'}`}></span>
                {currentStudent.isOnline ? '온라인 접속' : '오프라인'}
              </span>
            </div>

            <div className="flex items-center gap-3 mt-1.5 text-xs text-stone-300 flex-wrap">
              <span className="flex items-center gap-1">
                <span className="material-symbols-outlined text-[15px] text-amber-300">military_tech</span>
                학급 순위: <strong className="text-amber-300 font-bold">{studentRank}위</strong> / {students.length}명
              </span>
              <span className="text-white/20">|</span>
              <span className="flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[15px] text-stone-400">key</span>
                <span>PIN:</span>
                <strong className="font-mono text-amber-200">
                  {showPin ? currentStudent.pin : '••••'}
                </strong>
                <button
                  type="button"
                  onClick={() => setShowPin(!showPin)}
                  className="text-stone-400 hover:text-white transition-colors"
                  title={showPin ? 'PIN 숨기기' : 'PIN 보기'}
                >
                  <span className="material-symbols-outlined text-[15px]">
                    {showPin ? 'visibility_off' : 'visibility'}
                  </span>
                </button>
              </span>
              <span className="text-white/20">|</span>
              <span className="text-stone-400">
                최근 활동: {currentStudent.recentActivity || '정상 운영'}
              </span>
            </div>
          </div>
        </div>

        {/* Total Assets Badge */}
        <div className="bg-white/10 border border-white/15 p-4 rounded-2xs flex flex-col items-start md:items-end w-full md:w-auto">
          <span className="text-[11px] uppercase font-bold text-stone-300 tracking-wider">
            현재 총 자산 합계
          </span>
          <div className="font-mono font-bold text-2xl sm:text-3xl text-amber-300 mt-0.5">
            {totalAssets.toLocaleString()}{state.currencyUnit || '원'}
          </div>
          <div className="text-[11px] text-stone-300 mt-1">
            학급 평균 대비{' '}
            <strong className={totalAssets >= classAverageAssets ? 'text-emerald-300' : 'text-rose-300'}>
              {totalAssets >= classAverageAssets ? '+' : ''}
              {(totalAssets - classAverageAssets).toLocaleString()}원
            </strong>
          </div>
        </div>
      </div>

      {/* Debt Alert & Forgiveness Management Banner for Teacher */}
      {studentDebt > 0 && (
        <div className="bg-rose-50 border-2 border-rose-300 rounded-sm p-4 md:p-5 shadow-2xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4 animate-in fade-in">
          <div className="flex items-start md:items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-rose-200 text-rose-950 flex items-center justify-center font-bold text-xl shrink-0">
              🚨
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h4 className="font-bold text-base text-rose-950">
                  학급 부채(빚) 보유 학생
                </h4>
                <span className="px-2.5 py-0.5 rounded-2xs bg-rose-200 border border-rose-300 text-rose-950 font-mono font-bold text-xs">
                  미납 빚: {studentDebt.toLocaleString()}{currencyUnit}
                </span>
              </div>
              <p className="text-xs text-rose-800 mt-1">
                벌금 부과 시 보유 현금, 저축 예금 및 주식이 모두 자동 청산·소진되어 부채(빚)가 발생한 상태입니다.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0 w-full md:w-auto">
            <button
              type="button"
              onClick={async () => {
                const promptAmt = prompt(`${currentStudent.name} 학생의 부채 ${studentDebt.toLocaleString()}원 중 탕감(면제)할 금액을 입력하세요:`, String(studentDebt));
                if (!promptAmt) return;
                const amt = parseInt(promptAmt.replace(/[^0-9]/g, ''), 10);
                if (amt && amt > 0) {
                  const ok = await forgiveStudentDebt(currentStudent.id, amt);
                  if (ok) {
                    alert(`${currentStudent.name} 학생의 부채 ${amt.toLocaleString()}원이 탕감(면제)되었습니다.`);
                  }
                }
              }}
              className="flex-1 md:flex-initial px-3.5 py-2 bg-white hover:bg-stone-50 border border-rose-300 text-rose-900 font-bold text-xs rounded-2xs shadow-2xs transition-colors flex items-center justify-center gap-1"
            >
              <span className="material-symbols-outlined text-[15px]">remove_done</span>
              일부 탕감
            </button>
            <button
              type="button"
              onClick={async () => {
                if (confirm(`${currentStudent.name} 학생의 학급 부채 전액(${studentDebt.toLocaleString()}원)을 모두 탕감(면제)하시겠습니까?`)) {
                  const ok = await forgiveStudentDebt(currentStudent.id);
                  if (ok) {
                    alert(`${currentStudent.name} 학생의 부채 전액(${studentDebt.toLocaleString()}원)이 성공적으로 탕감되었습니다.`);
                  }
                }
              }}
              className="flex-1 md:flex-initial px-4 py-2 bg-rose-900 hover:bg-rose-950 text-white font-bold text-xs rounded-2xs shadow-2xs transition-colors flex items-center justify-center gap-1"
            >
              <span className="material-symbols-outlined text-[15px]">heart_check</span>
              부채 전액 탕감 (완전 면제)
            </button>
          </div>
        </div>
      )}

      {/* 3. Section 1: KPI Cards - 수입, 지출, 순자산 변동 */}
      <div className={`grid grid-cols-1 sm:grid-cols-2 ${studentDebt > 0 ? 'lg:grid-cols-5' : 'lg:grid-cols-4'} gap-4`}>
        {/* KPI 1: Total Assets */}
        <div className="bg-white rounded-sm p-4 border border-[#1a1a1a]/15 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#1a1a1a]/60">
              {studentDebt > 0 ? '순자산 (자산-부채)' : '총 평가 자산'}
            </span>
            <span className="w-7 h-7 rounded-2xs bg-amber-50 text-amber-900 border border-amber-200 flex items-center justify-center font-bold text-sm">
              💰
            </span>
          </div>
          <div className="mt-3">
            <div className="font-mono font-bold text-2xl text-[#1a1a1a]">
              {totalAssets.toLocaleString()}{currencyUnit}
            </div>
            <div className="text-[11px] text-[#1a1a1a]/60 mt-1 flex items-center gap-1">
              <span>초기 자본({baseAsset.toLocaleString()}{currencyUnit}) 대비</span>
              <strong className={totalAssets >= baseAsset ? 'text-emerald-800' : 'text-rose-800'}>
                {totalAssets >= baseAsset ? '+' : ''}
                {(totalAssets - baseAsset).toLocaleString()}{currencyUnit}
              </strong>
            </div>
          </div>
        </div>

        {/* KPI 2: Total Income */}
        <div className="bg-white rounded-sm p-4 border border-[#1a1a1a]/15 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-800">누적 수입 총액 (+)</span>
            <span className="w-7 h-7 rounded-2xs bg-emerald-50 text-emerald-800 border border-emerald-200 flex items-center justify-center font-bold text-sm">
              📥
            </span>
          </div>
          <div className="mt-3">
            <div className="font-mono font-bold text-2xl text-emerald-900">
              +{incomeDetails.totalIncome.toLocaleString()}{currencyUnit}
            </div>
            <div className="text-[11px] text-[#1a1a1a]/60 mt-1 flex flex-wrap gap-1">
              <span>상금/급여: {incomeDetails.rewardTotal.toLocaleString()}</span>
              <span>·</span>
              <span>이자: {incomeDetails.interestTotal.toLocaleString()}</span>
              {incomeDetails.stockSellTotal > 0 && (
                <>
                  <span>·</span>
                  <span>주식매도: {incomeDetails.stockSellTotal.toLocaleString()}</span>
                </>
              )}
              {incomeDetails.transferInTotal > 0 && (
                <>
                  <span>·</span>
                  <span>송금수령: {incomeDetails.transferInTotal.toLocaleString()}</span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* KPI 3: Total Expenses */}
        <div className="bg-white rounded-sm p-4 border border-[#1a1a1a]/15 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-rose-800">누적 지출 총액 (-)</span>
            <span className="w-7 h-7 rounded-2xs bg-rose-50 text-rose-800 border border-rose-200 flex items-center justify-center font-bold text-sm">
              📤
            </span>
          </div>
          <div className="mt-3">
            <div className="font-mono font-bold text-2xl text-rose-900">
              -{expenseDetails.totalExpense.toLocaleString()}{currencyUnit}
            </div>
            <div className="text-[11px] text-[#1a1a1a]/60 mt-1 flex flex-wrap gap-1">
              <span>상점: {expenseDetails.shopTotal.toLocaleString()}</span>
              <span>·</span>
              <span>벌금: {expenseDetails.fineTotal.toLocaleString()}</span>
              <span>·</span>
              <span>주식매수: {expenseDetails.stockBuyTotal.toLocaleString()}</span>
              {expenseDetails.transferOutTotal > 0 && (
                <>
                  <span>·</span>
                  <span>송금: {expenseDetails.transferOutTotal.toLocaleString()}</span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* KPI 4: Net Flow & Growth */}
        <div className="bg-white rounded-sm p-4 border border-[#1a1a1a]/15 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#1a1a1a]/60">순수익 (수입-지출)</span>
            <span className="w-7 h-7 rounded-2xs bg-blue-50 text-blue-800 border border-blue-200 flex items-center justify-center font-bold text-sm">
              ⚖️
            </span>
          </div>
          <div className="mt-3">
            {(() => {
              const net = incomeDetails.totalIncome - expenseDetails.totalExpense;
              const isPos = net >= 0;
              const netGrowth = totalAssets - baseAsset;
              const growthRate = baseAsset > 0 ? ((netGrowth / baseAsset) * 100).toFixed(1) : '0';
              return (
                <div>
                  <div className={`font-mono font-bold text-2xl ${isPos ? 'text-blue-900' : 'text-rose-900'}`}>
                    {isPos ? '+' : ''}{net.toLocaleString()}{currencyUnit}
                  </div>
                  <div className="text-[11px] text-[#1a1a1a]/60 mt-1 flex items-center gap-1">
                    <span>순자산 증감:</span>
                    <strong className={netGrowth >= 0 ? 'text-emerald-800' : 'text-rose-800'}>
                      {netGrowth >= 0 ? '+' : ''}{netGrowth.toLocaleString()}{currencyUnit} ({growthRate}%)
                    </strong>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>

        {/* KPI 5: Debt (if student has debt) */}
        {studentDebt > 0 && (
          <div className="bg-rose-50 rounded-sm p-4 border-2 border-rose-300 shadow-2xs flex flex-col justify-between animate-in fade-in">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-rose-900">학급 부채 (빚)</span>
              <span className="w-7 h-7 rounded-2xs bg-rose-200 text-rose-950 flex items-center justify-center font-bold text-sm">
                🚨
              </span>
            </div>
            <div className="mt-3">
              <div className="font-mono font-bold text-2xl text-rose-900">
                -{studentDebt.toLocaleString()}{currencyUnit}
              </div>
              <div className="text-[11px] text-rose-800 mt-1 flex items-center gap-1">
                <span>자산 부족분 벌금 누적</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 4. Section 2: 자산 포트폴리오 비중 (현금 · 저축 · 주식 비중) */}
      <div className="bg-white rounded-sm p-6 shadow-2xs border border-[#1a1a1a]/15">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4 pb-3 border-b border-[#1a1a1a]/10">
          <div>
            <h3 className="font-editorial text-lg font-bold text-[#1a1a1a] flex items-center gap-2">
              <span className="material-symbols-outlined text-xl text-amber-700">pie_chart</span>
              자산 구성 비중 분석 (현금 · 저축 · 주식)
            </h3>
            <p className="text-xs text-[#1a1a1a]/60 mt-0.5">
              학생의 총자산 내 현금 유동성, 안정형 저축(예금), 투자형 주식 자산의 포트폴리오 비율을 점검합니다.
            </p>
          </div>
          <span className="text-xs font-mono font-bold bg-[#faf8f5] px-3 py-1 rounded-2xs border border-[#1a1a1a]/15">
            합계 100% ({totalAssets.toLocaleString()}원)
          </span>
        </div>

        {/* Visual Segmented Progress Bar */}
        <div className="space-y-2 mb-6">
          <div className="h-6 w-full bg-stone-100 rounded-2xs overflow-hidden flex border border-[#1a1a1a]/15 shadow-inner">
            {cashPct > 0 && (
              <div
                style={{ width: `${cashPct}%` }}
                className="bg-emerald-600 hover:bg-emerald-700 transition-all flex items-center justify-center text-white text-[11px] font-mono font-bold overflow-hidden whitespace-nowrap px-1"
                title={`현금: ${cash.toLocaleString()}원 (${cashPct}%)`}
              >
                {cashPct >= 8 ? `현금 ${cashPct}%` : ''}
              </div>
            )}
            {savingsPct > 0 && (
              <div
                style={{ width: `${savingsPct}%` }}
                className="bg-blue-600 hover:bg-blue-700 transition-all flex items-center justify-center text-white text-[11px] font-mono font-bold overflow-hidden whitespace-nowrap px-1"
                title={`저축: ${savings.toLocaleString()}원 (${savingsPct}%)`}
              >
                {savingsPct >= 8 ? `저축 ${savingsPct}%` : ''}
              </div>
            )}
            {stockPct > 0 && (
              <div
                style={{ width: `${stockPct}%` }}
                className="bg-purple-600 hover:bg-purple-700 transition-all flex items-center justify-center text-white text-[11px] font-mono font-bold overflow-hidden whitespace-nowrap px-1"
                title={`주식: ${totalStockValue.toLocaleString()}원 (${stockPct}%)`}
              >
                {stockPct >= 8 ? `주식 ${stockPct}%` : ''}
              </div>
            )}
            {totalAssets === 0 && (
              <div className="w-full bg-stone-200 flex items-center justify-center text-xs text-stone-500 font-medium">
                보유 자산 없음 (0원)
              </div>
            )}
          </div>

          <div className="flex items-center justify-between text-xs font-mono text-[#1a1a1a]/70 px-1">
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-2xs bg-emerald-600 inline-block"></span>
              <strong>현금</strong> {cash.toLocaleString()}원 ({cashPct}%)
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-2xs bg-blue-600 inline-block"></span>
              <strong>저축</strong> {savings.toLocaleString()}원 ({savingsPct}%)
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-2xs bg-purple-600 inline-block"></span>
              <strong>주식</strong> {totalStockValue.toLocaleString()}원 ({stockPct}%)
            </span>
          </div>
        </div>

        {/* 3 Detail Cards for Cash, Savings, Stocks */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* 1. Cash Card */}
          <div className="bg-[#faf8f5] rounded-2xs p-4 border border-[#1a1a1a]/15 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xl">💵</span>
                  <span className="font-bold text-sm text-[#1a1a1a]">보유 현금</span>
                </div>
                <span className="font-mono text-xs font-bold px-2 py-0.5 rounded-2xs bg-emerald-100 text-emerald-900 border border-emerald-300">
                  {cashPct}%
                </span>
              </div>
              <div className="mt-3">
                <div className="font-mono font-bold text-2xl text-emerald-900">
                  {cash.toLocaleString()}원
                </div>
                <p className="text-[11px] text-[#1a1a1a]/60 mt-1 leading-snug">
                  상점 쿠폰 구매, 친구 송금 및 즉시 투자에 사용할 수 있는 가용 유동성 자산입니다.
                </p>
              </div>
            </div>
            <div className="mt-4 pt-3 border-t border-[#1a1a1a]/10 text-[11px] text-[#1a1a1a]/70 flex items-center justify-between">
              <span>유동성 상태</span>
              <strong className={cashPct >= 30 ? 'text-emerald-800' : 'text-amber-800'}>
                {cashPct >= 30 ? '안정적 (충분)' : '낮음 (현금 부족 주의)'}
              </strong>
            </div>
          </div>

          {/* 2. Savings Card */}
          <div className="bg-[#faf8f5] rounded-2xs p-4 border border-[#1a1a1a]/15 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xl">🏦</span>
                  <span className="font-bold text-sm text-[#1a1a1a]">예금 저축</span>
                </div>
                <span className="font-mono text-xs font-bold px-2 py-0.5 rounded-2xs bg-blue-100 text-blue-900 border border-blue-300">
                  {savingsPct}%
                </span>
              </div>
              <div className="mt-3">
                <div className="font-mono font-bold text-2xl text-blue-900">
                  {savings.toLocaleString()}원
                </div>
                <p className="text-[11px] text-[#1a1a1a]/60 mt-1 leading-snug">
                  원금이 안전하게 보장되며, 매 라운드 종료 시 정기 예금 이자가 지급되는 안전 자산입니다.
                </p>
              </div>
            </div>
            <div className="mt-4 pt-3 border-t border-[#1a1a1a]/10 text-[11px] text-[#1a1a1a]/70 flex items-center justify-between">
              <span>적용 금리 / 다음 이자</span>
              <strong className="text-blue-900 font-mono">
                연 {state.depositInterestRate.toFixed(1)}% (+{Math.round(savings * (state.depositInterestRate / 100)).toLocaleString()}원)
              </strong>
            </div>
          </div>

          {/* 3. Stocks Card */}
          <div className="bg-[#faf8f5] rounded-2xs p-4 border border-[#1a1a1a]/15 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xl">📈</span>
                  <span className="font-bold text-sm text-[#1a1a1a]">주식 투자</span>
                </div>
                <span className="font-mono text-xs font-bold px-2 py-0.5 rounded-2xs bg-purple-100 text-purple-900 border border-purple-300">
                  {stockPct}%
                </span>
              </div>
              <div className="mt-3">
                <div className="font-mono font-bold text-2xl text-purple-900">
                  {totalStockValue.toLocaleString()}원
                </div>
                <p className="text-[11px] text-[#1a1a1a]/60 mt-1 leading-snug">
                  시장 변동성에 따라 고수익 또는 평가 손실이 발생할 수 있는 성장형 투자 자산입니다.
                </p>
              </div>
            </div>
            <div className="mt-4 pt-3 border-t border-[#1a1a1a]/10 text-[11px] text-[#1a1a1a]/70 flex items-center justify-between">
              <span>보유 종목 수</span>
              <strong className="text-purple-900">
                {stockHoldings.filter(h => h.shares > 0).length}개 종목 보유
              </strong>
            </div>
          </div>
        </div>
      </div>

      {/* 5. Section 3: 주식 투자 종목 및 변동 상황 */}
      <div className="bg-white rounded-sm p-6 shadow-2xs border border-[#1a1a1a]/15">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4 pb-3 border-b border-[#1a1a1a]/10">
          <div>
            <h3 className="font-editorial text-lg font-bold text-[#1a1a1a] flex items-center gap-2">
              <span className="material-symbols-outlined text-xl text-purple-700">trending_up</span>
              주식 투자 종목 및 변동 상황
            </h3>
            <p className="text-xs text-[#1a1a1a]/60 mt-0.5">
              학급 상장 종목별 학생의 보유 주수, 현재 시세, 직전 대비 등락률 및 총 평가액을 상세하게 확인합니다.
            </p>
          </div>
          <span className="text-xs font-mono font-bold text-purple-950 bg-purple-50 border border-purple-200 px-3 py-1 rounded-2xs">
            주식 총 평가액: {totalStockValue.toLocaleString()}원
          </span>
        </div>

        {/* Stock Holdings Table */}
        <div className="overflow-x-auto border border-[#1a1a1a]/15 rounded-2xs">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-[#faf8f5] border-b border-[#1a1a1a]/15 text-[#1a1a1a] font-bold text-[11px] uppercase tracking-wider">
                <th className="py-3 px-4">종목명 / 섹터</th>
                <th className="py-3 px-4 text-center">보유 수량</th>
                <th className="py-3 px-4 text-right">현재 주가</th>
                <th className="py-3 px-4 text-center">전 라운드 대비</th>
                <th className="py-3 px-4 text-right">보유 주식 총 평가액</th>
                <th className="py-3 px-4 text-center">주식 포트폴리오 비중</th>
                <th className="py-3 px-4 text-center">상태</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1a1a1a]/10 font-sans">
              {stockHoldings.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-[#1a1a1a]/50">
                    현재 상장된 주식 종목이 없습니다.
                  </td>
                </tr>
              ) : (
                stockHoldings.map(h => {
                  const hasShares = h.shares > 0;
                  const isUp = h.changeRate > 0;
                  const isDown = h.changeRate < 0;
                  const sharePctOfStock = totalStockValue > 0
                    ? ((h.value / totalStockValue) * 100).toFixed(1)
                    : '0';

                  return (
                    <tr
                      key={h.stock.id}
                      className={`hover:bg-[#faf8f5]/80 transition-colors ${
                        hasShares ? 'bg-white' : 'bg-stone-50/50 opacity-75'
                      }`}
                    >
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-[#1a1a1a] text-xs">
                            {h.stock.name}
                          </span>
                          <span className="text-[10px] font-bold uppercase bg-stone-100 text-stone-700 px-1.5 py-0.5 rounded-2xs border border-stone-200">
                            {h.stock.category || '일반'}
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-center font-mono font-bold">
                        {hasShares ? (
                          <span className="px-2 py-0.5 rounded-2xs bg-purple-50 text-purple-900 border border-purple-200">
                            {Number.isInteger(h.shares) ? `${h.shares.toLocaleString()}주` : `${parseFloat(h.shares.toFixed(4))}주`}
                          </span>
                        ) : (
                          <span className="text-[#1a1a1a]/40 font-normal">0주</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-[#1a1a1a]">
                        {h.stock.currentPrice.toLocaleString()}원
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span
                          className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded-2xs font-mono font-bold text-[11px] ${
                            isUp
                              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                              : isDown
                              ? 'bg-rose-50 text-rose-800 border border-rose-200'
                              : 'bg-stone-100 text-stone-700 border border-stone-200'
                          }`}
                        >
                          {isUp ? `▲ +${h.changeRate}%` : isDown ? `▼ ${h.changeRate}%` : '0%'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold">
                        <span className={hasShares ? 'text-[#1a1a1a] text-sm' : 'text-[#1a1a1a]/40'}>
                          {h.value.toLocaleString()}원
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center font-mono text-xs">
                        {hasShares ? (
                          <span className="font-bold text-purple-900">{sharePctOfStock}%</span>
                        ) : (
                          <span className="text-[#1a1a1a]/30">-</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-center">
                        {hasShares ? (
                          <span className="px-2 py-0.5 rounded-2xs text-[10px] font-bold bg-emerald-100 text-emerald-900 border border-emerald-300">
                            적극 보유
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-2xs text-[10px] font-bold bg-stone-100 text-stone-600 border border-stone-200">
                            미보유
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 6. Section 4: 라운드별 자산 합계 변동표 */}
      <div className="bg-white rounded-sm p-6 shadow-2xs border border-[#1a1a1a]/15">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4 pb-3 border-b border-[#1a1a1a]/10">
          <div>
            <h3 className="font-editorial text-lg font-bold text-[#1a1a1a] flex items-center gap-2">
              <span className="material-symbols-outlined text-xl text-amber-800">bar_chart</span>
              라운드별 자산 합계 변동표 및 성장 궤적
            </h3>
            <p className="text-xs text-[#1a1a1a]/60 mt-0.5">
              Round 1부터 현재 라운드까지 학생의 현금, 저축, 주식 및 총자산 변동 내역을 회차별로 대조합니다.
            </p>
          </div>
          <span className="text-xs font-mono text-[#1a1a1a]/60">
            총 {roundHistoryData.length}개 회차 기록
          </span>
        </div>

        {/* Visual Trend Bars across Rounds */}
        <div className="mb-6 p-4 bg-[#faf8f5] rounded-2xs border border-[#1a1a1a]/12">
          <div className="text-[11px] font-bold uppercase tracking-wider text-[#1a1a1a]/60 mb-3 flex items-center justify-between">
            <span>회차별 총 자산 시각화 추이</span>
            <span className="text-stone-500 font-mono text-[10px]">최대치: {maxRoundAsset.toLocaleString()}원 기준</span>
          </div>

          <div className="flex items-end gap-3 h-28 pt-2 pb-1 overflow-x-auto no-scrollbar">
            {roundHistoryData.map(r => {
              const heightPct = Math.max(12, Math.round((r.totalAssets / maxRoundAsset) * 100));
              const isGain = r.changeAmount >= 0;

              return (
                <div key={r.round} className="flex-1 min-w-[50px] flex flex-col items-center h-full justify-end group">
                  <span className="text-[10px] font-mono font-bold text-[#1a1a1a] opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap mb-1">
                    {r.totalAssets.toLocaleString()}원
                  </span>
                  <div
                    style={{ height: `${heightPct}%` }}
                    className={`w-full max-w-[48px] rounded-t-2xs transition-all relative border ${
                      r.isCurrent
                        ? 'bg-amber-400 border-amber-600 shadow-sm'
                        : isGain
                        ? 'bg-[#1a1a1a] border-[#1a1a1a] hover:bg-stone-700'
                        : 'bg-rose-700 border-rose-900 hover:bg-rose-800'
                    }`}
                  >
                    {r.isCurrent && (
                      <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
                    )}
                  </div>
                  <span className={`text-[11px] font-mono mt-1 font-bold ${
                    r.isCurrent ? 'text-amber-800 underline' : 'text-[#1a1a1a]/70'
                  }`}>
                    R{r.round}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Round Progression Table */}
        <div className="overflow-x-auto border border-[#1a1a1a]/15 rounded-2xs">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-[#faf8f5] border-b border-[#1a1a1a]/15 text-[#1a1a1a] font-bold text-[11px] uppercase tracking-wider">
                <th className="py-3 px-3 text-center w-16">회차</th>
                <th className="py-3 px-4 text-right">현금 잔액</th>
                <th className="py-3 px-4 text-right">예금 저축</th>
                <th className="py-3 px-4 text-right">주식 평가액</th>
                <th className="py-3 px-4 text-right bg-amber-50/50">자산 총계</th>
                <th className="py-3 px-4 text-right">직전 대비 변동</th>
                <th className="py-3 px-4 text-center">변동률</th>
                <th className="py-3 px-4">활동 요약 및 비고</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1a1a1a]/10 font-sans">
              {roundHistoryData.map(r => {
                const isGain = r.changeAmount > 0;
                const isLoss = r.changeAmount < 0;

                return (
                  <tr
                    key={r.round}
                    className={`hover:bg-[#faf8f5]/80 transition-colors ${
                      r.isCurrent ? 'bg-amber-50/40 font-medium' : ''
                    }`}
                  >
                    <td className="py-3 px-3 text-center">
                      <span className={`inline-block px-2 py-0.5 rounded-2xs font-mono font-bold text-xs ${
                        r.isCurrent
                          ? 'bg-[#1a1a1a] text-amber-300'
                          : 'bg-stone-100 text-[#1a1a1a]'
                      }`}>
                        Round {r.round}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right font-mono">
                      {r.cash.toLocaleString()}원
                    </td>
                    <td className="py-3 px-4 text-right font-mono">
                      {r.savings.toLocaleString()}원
                    </td>
                    <td className="py-3 px-4 text-right font-mono">
                      {r.stockValue.toLocaleString()}원
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-sm bg-amber-50/50 text-[#1a1a1a]">
                      {r.totalAssets.toLocaleString()}{state.currencyUnit || '원'}
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-bold">
                      <span className={isGain ? 'text-emerald-800' : isLoss ? 'text-rose-800' : 'text-[#1a1a1a]/60'}>
                        {isGain ? '+' : ''}{r.changeAmount.toLocaleString()}원
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center font-mono">
                      <span className={`inline-block px-2 py-0.5 rounded-2xs text-[11px] font-bold ${
                        isGain
                          ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                          : isLoss
                          ? 'bg-rose-50 text-rose-800 border border-rose-200'
                          : 'bg-stone-100 text-stone-600'
                      }`}>
                        {isGain ? `▲ +${r.changeRate}%` : isLoss ? `▼ ${r.changeRate}%` : '0%'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-[#1a1a1a]/70 text-xs">
                      {r.notes || '-'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* 7. Section 5: 학생 개인별 상세 거래 장부 (Recent Transactions) */}
      <div className="bg-white rounded-sm p-6 shadow-2xs border border-[#1a1a1a]/15">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 pb-3 border-b border-[#1a1a1a]/10">
          <div>
            <h3 className="font-editorial text-lg font-bold text-[#1a1a1a] flex items-center gap-2">
              <span className="material-symbols-outlined text-xl text-stone-700">receipt_long</span>
              {currentStudent.name} 학생 개인 거래 장부 ({filteredTxs.length}건)
            </h3>
            <p className="text-xs text-[#1a1a1a]/60 mt-0.5">
              학생의 입출금, 주식 매수/매도, 상점 결제, 송금, 상벌금 모든 개별 거래 기록입니다.
            </p>
          </div>

          {/* Filters */}
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={txCategoryFilter}
              onChange={e => setTxCategoryFilter(e.target.value)}
              className="h-8 px-2.5 bg-[#faf8f5] border border-[#1a1a1a]/20 rounded-2xs text-xs font-bold text-[#1a1a1a] focus:outline-none focus:border-[#1a1a1a]"
            >
              <option value="all">전체 거래</option>
              <option value="savings">저축 입출금</option>
              <option value="stocks">주식 매매</option>
              <option value="shop">상점 결제</option>
              <option value="reward">상금/기본급/이자</option>
              <option value="fine">벌금/세금</option>
              <option value="transfer">송금 거래</option>
            </select>

            <div className="relative">
              <span className="material-symbols-outlined absolute left-2 top-1.5 text-[#1a1a1a]/40 text-[16px]">
                search
              </span>
              <input
                type="text"
                placeholder="내역 검색..."
                value={txSearch}
                onChange={e => setTxSearch(e.target.value)}
                className="h-8 pl-7 pr-2.5 bg-[#faf8f5] border border-[#1a1a1a]/20 rounded-2xs text-xs text-[#1a1a1a] focus:outline-none focus:border-[#1a1a1a] w-36 sm:w-44"
              />
            </div>
          </div>
        </div>

        {/* Transactions Table */}
        <div className="overflow-x-auto border border-[#1a1a1a]/15 rounded-2xs">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-[#faf8f5] border-b border-[#1a1a1a]/15 text-[#1a1a1a] font-bold text-[11px] uppercase tracking-wider">
                <th className="py-2.5 px-3 text-center w-12">No</th>
                <th className="py-2.5 px-3 w-28">일시</th>
                <th className="py-2.5 px-3 text-center w-24">분류</th>
                <th className="py-2.5 px-4">거래 상세 내역</th>
                <th className="py-2.5 px-4 text-right w-36">변동 금액</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1a1a1a]/10 font-sans">
              {filteredTxs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-[#1a1a1a]/50">
                    거래 내역이 없습니다.
                  </td>
                </tr>
              ) : (
                filteredTxs.map((t, idx) => {
                  const desc = t.description || '';
                  const isRebal = desc.includes('리밸런싱');
                  const isInterest = desc.includes('이자');
                  const isDeposit = t.type === 'deposit' && !isInterest;
                  const isWithdraw = t.type === 'withdraw';
                  const isPositive =
                    t.type === 'reward' ||
                    t.type === 'stock_sell' ||
                    isInterest ||
                    desc.includes('입금수령') ||
                    desc.includes('상금');

                  let badgeColor = 'bg-stone-100 text-stone-700 border-stone-300';
                  let badgeText = '거래';

                  if (isRebal) {
                    badgeColor = 'bg-indigo-50 text-indigo-900 border-indigo-300';
                    badgeText = '리밸런싱';
                  } else if (isDeposit) {
                    badgeColor = 'bg-blue-50 text-blue-900 border-blue-300';
                    badgeText = '저축 입금';
                  } else if (isWithdraw) {
                    badgeColor = 'bg-emerald-50 text-emerald-900 border-emerald-300';
                    badgeText = '저축 출금';
                  } else if (t.type === 'stock_buy' || t.type === 'stock_sell' || desc.includes('주식')) {
                    badgeColor = 'bg-purple-50 text-purple-900 border-purple-300';
                    badgeText = t.type === 'stock_sell' ? '주식 매도' : '주식 매수';
                  } else if (t.type === 'shop_buy' || desc.includes('상점')) {
                    badgeColor = 'bg-amber-50 text-amber-900 border-amber-300';
                    badgeText = '상점 결제';
                  } else if (t.type === 'transfer' || desc.includes('송금')) {
                    badgeColor = 'bg-cyan-50 text-cyan-900 border-cyan-300';
                    badgeText = desc.includes('수령') ? '송금 수령' : '송금';
                  } else if (t.type === 'reward' || desc.includes('상금') || isInterest) {
                    badgeColor = 'bg-teal-50 text-teal-900 border-teal-300';
                    badgeText = isInterest ? '예금 이자' : '상금/급여';
                  } else if (t.type === 'fine' || desc.includes('벌금')) {
                    badgeColor = 'bg-rose-50 text-rose-900 border-rose-300';
                    badgeText = '벌금';
                  }

                  return (
                    <tr key={t.id || idx} className="hover:bg-[#faf8f5]/80 transition-colors">
                      <td className="py-2.5 px-3 text-center font-mono text-[#1a1a1a]/40 text-[11px]">
                        {idx + 1}
                      </td>
                      <td className="py-2.5 px-3 font-mono text-[11px] text-[#1a1a1a]/60 whitespace-nowrap">
                        {t.timestamp || '-'}
                      </td>
                      <td className="py-2.5 px-3 text-center whitespace-nowrap">
                        <span className={`inline-block px-2 py-0.5 rounded-2xs text-[10px] font-bold border ${badgeColor}`}>
                          {badgeText}
                        </span>
                      </td>
                      <td className="py-2.5 px-4 font-medium text-[#1a1a1a]">
                        {t.description}
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono font-bold whitespace-nowrap">
                        {isRebal ? (
                          <span className="text-stone-700">
                            {(t.amount || 0).toLocaleString()}원 (배분)
                          </span>
                        ) : isDeposit ? (
                          <span className="text-blue-800">
                            +{(t.amount || 0).toLocaleString()}원 (저축)
                          </span>
                        ) : isWithdraw ? (
                          <span className="text-emerald-800">
                            +{(t.amount || 0).toLocaleString()}원 (현금)
                          </span>
                        ) : (
                          <span className={isPositive ? 'text-emerald-800' : 'text-rose-800'}>
                            {isPositive ? '+' : '-'}
                            {(t.amount || 0).toLocaleString()}원
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
