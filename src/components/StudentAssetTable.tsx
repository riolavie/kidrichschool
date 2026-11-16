import React, { useState, useMemo } from 'react';
import { useClassEconomy } from '../context/ClassEconomyContext';
import { Student, Transaction } from '../types';

interface StudentAssetTableProps {
  student?: Student | null;
  showPortfolioSummary?: boolean;
}

export const StudentAssetTable: React.FC<StudentAssetTableProps> = ({
  student: propStudent,
  showPortfolioSummary = true
}) => {
  const { state, role, currentStudent, calculateTotalAssets, deleteTransaction, deleteMultipleTransactions } = useClassEconomy();

  const targetStudent = propStudent || currentStudent;

  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');
  const [selectedTxIds, setSelectedTxIds] = useState<string[]>([]);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);

  if (!targetStudent) {
    return (
      <div className="bg-white rounded-sm p-8 text-center border border-[#1a1a1a]/15 shadow-2xs">
        <p className="text-sm text-[#1a1a1a]/60">학생 정보를 불러올 수 없습니다.</p>
      </div>
    );
  }

  // Calculate Asset breakdown
  const stockHoldings = state.stocks.map(st => {
    const shares = (targetStudent.stockShares || {})[st.id] || 0;
    const value = Math.round(shares * st.currentPrice);
    return {
      stock: st,
      shares,
      value
    };
  }).filter(h => h.shares > 0);

  const totalStockValue = stockHoldings.reduce((sum, h) => sum + h.value, 0);
  const studentDebt = Math.max(0, targetStudent.debt || 0);
  const totalAssets = calculateTotalAssets(targetStudent);

  // Filter transactions for this student
  const studentTransactions = useMemo(() => {
    return (state.transactions || []).filter(tx => tx.studentId === targetStudent.id);
  }, [state.transactions, targetStudent.id]);

  // Income vs Expense statistics
  const { totalInflow, totalOutflow } = useMemo(() => {
    let inflow = 0;
    let outflow = 0;

    studentTransactions.forEach(tx => {
      // Inflow types
      if (
        tx.type === 'reward' ||
        tx.type === 'stock_sell' ||
        tx.description.includes('입금수령') ||
        tx.description.includes('이자 지급') ||
        tx.description.includes('지급') ||
        (tx.type === 'withdraw' && tx.description.includes('출금'))
      ) {
        inflow += tx.amount || 0;
      }
      // Outflow types
      else if (
        tx.type === 'fine' ||
        tx.type === 'shop_buy' ||
        tx.type === 'stock_buy' ||
        tx.description.includes('송금') ||
        tx.description.includes('결제')
      ) {
        outflow += tx.amount || 0;
      }
    });

    return { totalInflow: inflow, totalOutflow: outflow };
  }, [studentTransactions]);

  // Filtered transactions
  const filteredTransactions = useMemo(() => {
    return studentTransactions
      .filter(tx => {
        // Filter by category
        if (categoryFilter === 'savings') {
          return tx.type === 'deposit' || tx.type === 'withdraw' || tx.description.includes('예금') || tx.description.includes('저축');
        }
        if (categoryFilter === 'stocks') {
          return tx.type === 'stock_buy' || tx.type === 'stock_sell' || tx.description.includes('매수') || tx.description.includes('매도');
        }
        if (categoryFilter === 'shop') {
          return tx.type === 'shop_buy' || tx.description.includes('상점') || tx.description.includes('쿠폰');
        }
        if (categoryFilter === 'transfer') {
          return tx.type === 'transfer' || tx.description.includes('송금') || tx.description.includes('수령');
        }
        if (categoryFilter === 'reward_fine') {
          return tx.type === 'reward' || tx.type === 'fine' || tx.description.includes('상금') || tx.description.includes('벌금') || tx.description.includes('이자');
        }
        return true;
      })
      .filter(tx => {
        if (!searchTerm.trim()) return true;
        const q = searchTerm.trim().toLowerCase();
        return (
          tx.description.toLowerCase().includes(q) ||
          tx.type.toLowerCase().includes(q) ||
          (tx.timestamp && tx.timestamp.toLowerCase().includes(q)) ||
          String(tx.amount).includes(q)
        );
      })
      .sort((a, b) => {
        if (sortOrder === 'asc') {
          return (a.id || '').localeCompare(b.id || '');
        }
        return (b.id || '').localeCompare(a.id || '');
      });
  }, [studentTransactions, categoryFilter, searchTerm, sortOrder]);

  // Format Transaction Type Badge
  const renderTypeBadge = (tx: Transaction) => {
    switch (tx.type) {
      case 'deposit':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-2xs text-[11px] font-bold bg-emerald-100 text-emerald-900 border border-emerald-300">
            <span>📥</span> 저축 입금
          </span>
        );
      case 'withdraw':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-2xs text-[11px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
            <span>📤</span> 저축 출금
          </span>
        );
      case 'stock_buy':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-2xs text-[11px] font-bold bg-blue-100 text-blue-900 border border-blue-300">
            <span>📈</span> 주식 매수
          </span>
        );
      case 'stock_sell':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-2xs text-[11px] font-bold bg-purple-100 text-purple-900 border border-purple-300">
            <span>📉</span> 주식 매도
          </span>
        );
      case 'shop_buy':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-2xs text-[11px] font-bold bg-orange-100 text-orange-900 border border-orange-300">
            <span>🛍️</span> 상점 결제
          </span>
        );
      case 'transfer':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-2xs text-[11px] font-bold bg-cyan-100 text-cyan-900 border border-cyan-300">
            <span>💸</span> 송금 거래
          </span>
        );
      case 'reward':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-2xs text-[11px] font-bold bg-yellow-100 text-yellow-900 border border-yellow-300">
            <span>🏆</span> 보상금/상금
          </span>
        );
      case 'fine':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-2xs text-[11px] font-bold bg-rose-100 text-rose-900 border border-rose-300">
            <span>⚠️</span> 벌금/세금
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-2xs text-[11px] font-bold bg-stone-100 text-stone-800 border border-stone-300">
            <span>📝</span> 일반 거래
          </span>
        );
    }
  };

  // Determine amount sign & color
  const renderAmount = (tx: Transaction) => {
    const isIncome =
      tx.type === 'reward' ||
      tx.type === 'stock_sell' ||
      tx.description.includes('입금수령') ||
      tx.description.includes('이자 지급') ||
      (tx.type === 'withdraw' && tx.description.includes('출금'));

    const isExpense =
      tx.type === 'fine' ||
      tx.type === 'shop_buy' ||
      tx.type === 'stock_buy' ||
      tx.type === 'deposit' ||
      tx.description.includes('송금') ||
      tx.description.includes('결제');

    if (isIncome) {
      return (
        <span className="font-mono font-bold text-emerald-800 flex items-center gap-0.5">
          +{tx.amount.toLocaleString()} <span className="text-[11px] font-normal font-sans">{state.currencyUnit || '원'}</span>
        </span>
      );
    } else if (isExpense) {
      return (
        <span className="font-mono font-bold text-rose-700 flex items-center gap-0.5">
          -{tx.amount.toLocaleString()} <span className="text-[11px] font-normal font-sans">{state.currencyUnit || '원'}</span>
        </span>
      );
    }

    return (
      <span className="font-mono font-bold text-[#1a1a1a]">
        {tx.amount.toLocaleString()} <span className="text-[11px] font-normal font-sans">{state.currencyUnit || '원'}</span>
      </span>
    );
  };

  // Export to CSV function
  const handleExportCSV = () => {
    const headers = ['거래번호', '일시', '학생이름', '거래구분', '상세내용', '금액(원)'];
    const rows = filteredTransactions.map((tx, idx) => [
      idx + 1,
      `"${tx.timestamp || ''}"`,
      `"${tx.studentName || targetStudent.name}"`,
      `"${tx.type}"`,
      `"${tx.description.replace(/"/g, '""')}"`,
      tx.amount
    ]);

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `${targetStudent.name}_자산변동현황_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* 1. 종합 자산 현황 요약 카드 그리드 */}
      {showPortfolioSummary && (
        <div className={`grid grid-cols-2 ${studentDebt > 0 ? 'lg:grid-cols-5' : 'lg:grid-cols-4'} gap-4`}>
          {/* Total Net Assets */}
          <div className="bg-gradient-to-br from-[#1a1a1a] to-stone-800 text-white rounded-sm p-4.5 border border-[#1a1a1a] shadow-2xs flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-amber-300/90">
                {studentDebt > 0 ? '순자산 (자산 - 부채)' : '총 자산 평가액'}
              </span>
              <span className="text-lg">💰</span>
            </div>
            <div className="mt-3">
              <div className="font-editorial text-2xl font-bold tracking-tight">
                {totalAssets.toLocaleString()}<span className="text-sm font-sans font-normal ml-0.5">{state.currencyUnit || '원'}</span>
              </div>
              <p className="text-[11px] text-stone-300 mt-0.5">
                {studentDebt > 0 ? `총 자산 ${(targetStudent.cash + targetStudent.savings + totalStockValue).toLocaleString()}원 - 빚 ${studentDebt.toLocaleString()}원` : '현금 + 예금 + 주식 종합'}
              </p>
            </div>
          </div>

          {/* Cash */}
          <div className="bg-white rounded-sm p-4.5 border border-[#1a1a1a]/15 shadow-2xs flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#1a1a1a]/60">보유 현금</span>
              <span className="w-6 h-6 rounded-2xs bg-stone-100 flex items-center justify-center text-sm">💵</span>
            </div>
            <div className="mt-3">
              <div className="font-mono text-xl font-bold text-[#1a1a1a]">
                {(targetStudent.cash || 0).toLocaleString()}<span className="text-xs font-sans font-normal ml-0.5">{state.currencyUnit || '원'}</span>
              </div>
              <div className="flex items-center justify-between text-[11px] text-[#1a1a1a]/60 mt-0.5">
                <span>비중</span>
                <span className="font-mono font-bold text-[#1a1a1a]">
                  {totalAssets > 0 ? ((targetStudent.cash / totalAssets) * 100).toFixed(1) : 0}%
                </span>
              </div>
            </div>
          </div>

          {/* Savings */}
          <div className="bg-white rounded-sm p-4.5 border border-emerald-200/80 bg-emerald-50/30 shadow-2xs flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-900">저축 예금</span>
              <span className="w-6 h-6 rounded-2xs bg-emerald-100 flex items-center justify-center text-sm">🏦</span>
            </div>
            <div className="mt-3">
              <div className="font-mono text-xl font-bold text-emerald-900">
                {(targetStudent.savings || 0).toLocaleString()}<span className="text-xs font-sans font-normal ml-0.5">{state.currencyUnit || '원'}</span>
              </div>
              <div className="flex items-center justify-between text-[11px] text-emerald-800 mt-0.5">
                <span>연이자율 +{state.depositInterestRate || 5}%</span>
                <span className="font-mono font-bold">
                  {totalAssets > 0 ? ((targetStudent.savings / totalAssets) * 100).toFixed(1) : 0}%
                </span>
              </div>
            </div>
          </div>

          {/* Stocks */}
          <div className="bg-white rounded-sm p-4.5 border border-blue-200/80 bg-blue-50/30 shadow-2xs flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-blue-900">주식 투자 자산</span>
              <span className="w-6 h-6 rounded-2xs bg-blue-100 flex items-center justify-center text-sm">📊</span>
            </div>
            <div className="mt-3">
              <div className="font-mono text-xl font-bold text-blue-900">
                {totalStockValue.toLocaleString()}<span className="text-xs font-sans font-normal ml-0.5">{state.currencyUnit || '원'}</span>
              </div>
              <div className="flex items-center justify-between text-[11px] text-blue-800 mt-0.5">
                <span>보유 {stockHoldings.length}개 종목</span>
                <span className="font-mono font-bold">
                  {totalAssets > 0 ? ((totalStockValue / totalAssets) * 100).toFixed(1) : 0}%
                </span>
              </div>
            </div>
          </div>

          {/* Debt (if any) */}
          {studentDebt > 0 && (
            <div className="bg-rose-50 rounded-sm p-4.5 border-2 border-rose-300 shadow-2xs flex flex-col justify-between animate-in fade-in">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-rose-900">학급 부채 (빚)</span>
                <span className="w-6 h-6 rounded-2xs bg-rose-200 text-rose-950 flex items-center justify-center text-xs font-bold">🚨</span>
              </div>
              <div className="mt-3">
                <div className="font-mono text-xl font-bold text-rose-900">
                  -{studentDebt.toLocaleString()}<span className="text-xs font-sans font-normal ml-0.5">{state.currencyUnit || '원'}</span>
                </div>
                <div className="flex items-center justify-between text-[11px] text-rose-800 mt-0.5">
                  <span>벌금 미납 누적</span>
                  <span className="font-bold text-rose-950">상환 필요</span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 2. 자산 구성 현황표 (Asset Allocation Table) */}
      {showPortfolioSummary && (
        <div className="bg-white rounded-sm shadow-2xs border border-[#1a1a1a]/15 overflow-hidden">
          <div className="p-4 border-b border-[#1a1a1a]/10 bg-[#faf8f5] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[20px] text-[#1a1a1a]">pie_chart</span>
              <h3 className="font-bold text-sm text-[#1a1a1a] uppercase tracking-wider">
                현재 자산 구성 현황표
              </h3>
            </div>
            <span className="text-xs text-[#1a1a1a]/60">
              Round {state.currentRound} 기준
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[600px]">
              <thead className="bg-[#faf8f5]/80 border-b border-[#1a1a1a]/10 text-[11px] font-bold uppercase tracking-wider text-[#1a1a1a]/60">
                <tr>
                  <th className="py-2.5 px-4">자산 구분</th>
                  <th className="py-2.5 px-4 text-right">보유 수량 / 원금</th>
                  <th className="py-2.5 px-4 text-right">현재 단가 / 가치</th>
                  <th className="py-2.5 px-4 text-right">평가 금액</th>
                  <th className="py-2.5 px-4 text-center">자산 비중</th>
                  <th className="py-2.5 px-4 text-left">특징 및 상태</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1a1a1a]/10 text-xs font-medium">
                {/* Cash row */}
                <tr className="hover:bg-[#faf8f5]/60 transition-colors">
                  <td className="py-3 px-4 font-bold text-[#1a1a1a] flex items-center gap-2">
                    <span className="text-base">💵</span> 보유 현금 (CASH)
                  </td>
                  <td className="py-3 px-4 text-right font-mono font-bold text-[#1a1a1a]">
                    {(targetStudent.cash || 0).toLocaleString()}원
                  </td>
                  <td className="py-3 px-4 text-right font-mono text-[#1a1a1a]/60">1.0 (기준화폐)</td>
                  <td className="py-3 px-4 text-right font-mono font-bold text-[#1a1a1a]">
                    {(targetStudent.cash || 0).toLocaleString()}원
                  </td>
                  <td className="py-3 px-4 text-center">
                    <span className="px-2 py-0.5 rounded-2xs font-mono font-bold text-[11px] bg-stone-100 text-stone-800 border border-stone-200">
                      {totalAssets > 0 ? ((targetStudent.cash / totalAssets) * 100).toFixed(1) : 0}%
                    </span>
                  </td>
                  <td className="py-3 px-4 text-[#1a1a1a]/70 text-[11px]">
                    즉시 상점 결제 및 송금 가능
                  </td>
                </tr>

                {/* Savings row */}
                <tr className="hover:bg-[#faf8f5]/60 transition-colors bg-emerald-50/10">
                  <td className="py-3 px-4 font-bold text-emerald-950 flex items-center gap-2">
                    <span className="text-base">🏦</span> 저축 예금 (SAVINGS)
                  </td>
                  <td className="py-3 px-4 text-right font-mono font-bold text-emerald-900">
                    {(targetStudent.savings || 0).toLocaleString()}원
                  </td>
                  <td className="py-3 px-4 text-right font-mono text-emerald-800">
                    +{(state.depositInterestRate || 5)}% / R
                  </td>
                  <td className="py-3 px-4 text-right font-mono font-bold text-emerald-900">
                    {(targetStudent.savings || 0).toLocaleString()}원
                  </td>
                  <td className="py-3 px-4 text-center">
                    <span className="px-2 py-0.5 rounded-2xs font-mono font-bold text-[11px] bg-emerald-100 text-emerald-900 border border-emerald-300">
                      {totalAssets > 0 ? ((targetStudent.savings / totalAssets) * 100).toFixed(1) : 0}%
                    </span>
                  </td>
                  <td className="py-3 px-4 text-emerald-900 text-[11px]">
                    매 라운드 안정적 확정 이자 지급
                  </td>
                </tr>

                {/* Stock rows */}
                {stockHoldings.length > 0 ? (
                  stockHoldings.map(h => (
                    <tr key={h.stock.id} className="hover:bg-[#faf8f5]/60 transition-colors bg-blue-50/10">
                      <td className="py-3 px-4 font-bold text-blue-950 flex items-center gap-2">
                        <span className="text-base">📈</span> {h.stock.name} ({h.stock.code || h.stock.id})
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-blue-900">
                        {Number.isInteger(h.shares) ? `${h.shares.toLocaleString()}주` : `${parseFloat(h.shares.toFixed(4))}주`}
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-blue-800">
                        {h.stock.currentPrice.toLocaleString()}원
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-blue-900">
                        {h.value.toLocaleString()}원
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className="px-2 py-0.5 rounded-2xs font-mono font-bold text-[11px] bg-blue-100 text-blue-900 border border-blue-300">
                          {totalAssets > 0 ? ((h.value / totalAssets) * 100).toFixed(1) : 0}%
                        </span>
                      </td>
                      <td className="py-3 px-4 text-blue-900 text-[11px]">
                        라운드별 시세 변동 및 배당 수익
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="py-3 px-4 text-center text-xs text-[#1a1a1a]/40 italic">
                      현재 보유 중인 주식이 없습니다. 모의투자 탭에서 주식을 매수해보세요!
                    </td>
                  </tr>
                )}

                {/* Debt row if any */}
                {studentDebt > 0 && (
                  <tr className="bg-rose-50/70 hover:bg-rose-50/90 transition-colors border-t-2 border-rose-300">
                    <td className="py-3 px-4 font-bold text-rose-950 flex items-center gap-2">
                      <span className="text-base">🚨</span> 학급 부채 (DEBT / 미납 빚)
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-rose-800">
                      -{studentDebt.toLocaleString()}원
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-rose-700 text-[11px]">
                      벌금 미납 누적
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-rose-900">
                      -{studentDebt.toLocaleString()}원
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className="px-2 py-0.5 rounded-2xs font-mono font-bold text-[11px] bg-rose-200 text-rose-950 border border-rose-300">
                        부채 (차감)
                      </span>
                    </td>
                    <td className="py-3 px-4 text-rose-900 text-[11px] font-medium">
                      벌금 부과 시 자산 부족으로 발생 (현금으로 상환 필요)
                    </td>
                  </tr>
                )}
              </tbody>
              <tfoot className="bg-[#faf8f5] border-t-2 border-[#1a1a1a]/20 font-bold">
                <tr>
                  <td className="py-3 px-4 text-[#1a1a1a]">순자산 종합 합계</td>
                  <td colSpan={2} className="py-3 px-4 text-right text-xs text-[#1a1a1a]/60">
                    (현금 + 예금 + 주식) - 부채
                  </td>
                  <td className="py-3 px-4 text-right font-mono text-base text-[#1a1a1a]">
                    {totalAssets.toLocaleString()}원
                  </td>
                  <td className="py-3 px-4 text-center font-mono text-xs text-[#1a1a1a]">100%</td>
                  <td className="py-3 px-4 text-[11px] text-[#1a1a1a]/70">
                    {studentDebt > 0 ? `부채 ${studentDebt.toLocaleString()}원 반영됨` : '정상 자산 건전성'}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* 3. 자산 변동 내역 테이블 (Transaction Ledger Table) */}
      <div className="bg-white rounded-sm shadow-2xs border border-[#1a1a1a]/15 overflow-hidden">
        {/* Header with Title & Export button */}
        <div className="p-4 md:p-5 border-b border-[#1a1a1a]/10 bg-white flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <span className="material-symbols-outlined text-[22px] text-[#1a1a1a]">receipt_long</span>
              <h3 className="font-editorial text-xl font-bold text-[#1a1a1a]">
                학생 자산 변동 현황 원장 (Transaction Ledger)
              </h3>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#faf8f5] text-[#1a1a1a]/70 border border-[#1a1a1a]/15">
                총 {studentTransactions.length}건
              </span>
            </div>
            <p className="text-xs text-[#1a1a1a]/60 mt-1">
              저축 입출금, 주식 매수/매도, 상점 결제, 보상 및 송금 등 모든 자산 증감 기록입니다.
            </p>
          </div>

          <div className="flex items-center gap-2">
            {role === 'teacher' && (
              <button
                onClick={async () => {
                  if (filteredTransactions.length === 0) return;
                  if (
                    confirm(
                      `현재 조회된 ${targetStudent.name} 학생의 ${filteredTransactions.length}건 변동 내역을 모두 삭제하시겠습니까?\n삭제된 내역은 복구할 수 없습니다.`
                    )
                  ) {
                    setIsDeleting(true);
                    const ids = filteredTransactions.map(t => t.id).filter(Boolean);
                    setSelectedTxIds([]);
                    await deleteMultipleTransactions(ids);
                    setIsDeleting(false);
                    alert(`${ids.length}건의 자산 변동 내역이 삭제되었습니다.`);
                  }
                }}
                disabled={isDeleting || filteredTransactions.length === 0}
                className="h-9 px-3 bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-800 rounded-2xs font-bold text-xs flex items-center gap-1.5 shadow-2xs transition-all disabled:opacity-40"
                title="현재 조회된 내역 일괄 삭제"
              >
                <span className="material-symbols-outlined text-[17px]">delete_sweep</span>
                <span>내역 정리 ({filteredTransactions.length}건)</span>
              </button>
            )}
            <button
              onClick={handleExportCSV}
              disabled={filteredTransactions.length === 0}
              className="h-9 px-3.5 bg-white hover:bg-stone-50 border border-[#1a1a1a]/20 text-[#1a1a1a] rounded-2xs font-bold text-xs flex items-center gap-1.5 shadow-2xs transition-all disabled:opacity-40"
              title="현재 자산 변동 내역을 CSV 파일로 다운로드합니다"
            >
              <span className="material-symbols-outlined text-[17px]">download</span>
              <span>CSV 내보내기</span>
            </button>
          </div>
        </div>

        {/* Filters and Search Bar */}
        <div className="p-4 bg-[#faf8f5] border-b border-[#1a1a1a]/10 flex flex-wrap items-center justify-between gap-3">
          {/* Category Filter Pills */}
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              onClick={() => setCategoryFilter('all')}
              className={`px-3 py-1.5 rounded-2xs text-xs font-bold transition-all ${
                categoryFilter === 'all'
                  ? 'bg-[#1a1a1a] text-white shadow-2xs'
                  : 'bg-white text-[#1a1a1a]/70 hover:bg-stone-200 border border-[#1a1a1a]/15'
              }`}
            >
              전체 ({studentTransactions.length})
            </button>
            <button
              onClick={() => setCategoryFilter('savings')}
              className={`px-3 py-1.5 rounded-2xs text-xs font-bold transition-all ${
                categoryFilter === 'savings'
                  ? 'bg-emerald-800 text-white shadow-2xs'
                  : 'bg-white text-[#1a1a1a]/70 hover:bg-emerald-50 border border-[#1a1a1a]/15'
              }`}
            >
              🏦 저축
            </button>
            <button
              onClick={() => setCategoryFilter('stocks')}
              className={`px-3 py-1.5 rounded-2xs text-xs font-bold transition-all ${
                categoryFilter === 'stocks'
                  ? 'bg-blue-800 text-white shadow-2xs'
                  : 'bg-white text-[#1a1a1a]/70 hover:bg-blue-50 border border-[#1a1a1a]/15'
              }`}
            >
              📈 주식 매매
            </button>
            <button
              onClick={() => setCategoryFilter('shop')}
              className={`px-3 py-1.5 rounded-2xs text-xs font-bold transition-all ${
                categoryFilter === 'shop'
                  ? 'bg-orange-800 text-white shadow-2xs'
                  : 'bg-white text-[#1a1a1a]/70 hover:bg-orange-50 border border-[#1a1a1a]/15'
              }`}
            >
              🛍️ 상점 구매
            </button>
            <button
              onClick={() => setCategoryFilter('transfer')}
              className={`px-3 py-1.5 rounded-2xs text-xs font-bold transition-all ${
                categoryFilter === 'transfer'
                  ? 'bg-cyan-800 text-white shadow-2xs'
                  : 'bg-white text-[#1a1a1a]/70 hover:bg-cyan-50 border border-[#1a1a1a]/15'
              }`}
            >
              💸 송금
            </button>
            <button
              onClick={() => setCategoryFilter('reward_fine')}
              className={`px-3 py-1.5 rounded-2xs text-xs font-bold transition-all ${
                categoryFilter === 'reward_fine'
                  ? 'bg-yellow-800 text-white shadow-2xs'
                  : 'bg-white text-[#1a1a1a]/70 hover:bg-yellow-50 border border-[#1a1a1a]/15'
              }`}
            >
              🏆 보상·벌금
            </button>
          </div>

          {/* Search Box */}
          <div className="relative">
            <span className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-stone-400 text-[18px]">
              search
            </span>
            <input
              type="text"
              placeholder="변동 내역 검색..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="pl-8 pr-3 py-1.5 bg-white border border-[#1a1a1a]/20 rounded-2xs text-xs font-medium focus:border-[#1a1a1a] focus:ring-0 w-44 md:w-56"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-700 text-xs"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {/* Selected Items Action Bar (Teacher only) */}
        {role === 'teacher' && selectedTxIds.length > 0 && (
          <div className="bg-amber-50 border-b border-amber-300 px-4 py-3 flex flex-wrap items-center justify-between gap-3 text-xs shadow-2xs">
            <div className="flex items-center gap-2 text-amber-950 font-bold">
              <span className="material-symbols-outlined text-amber-800 text-[18px]">check_box</span>
              <span>
                선택한 내역: <span className="underline font-mono text-sm">{selectedTxIds.length}</span>건
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setSelectedTxIds([])}
                className="px-3 py-1 bg-white hover:bg-stone-100 text-stone-700 border border-stone-300 rounded-2xs font-bold text-xs"
              >
                선택 해제
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={async () => {
                  if (
                    confirm(
                      `선택한 ${selectedTxIds.length}건의 자산 변동 내역을 삭제하시겠습니까?\n삭제된 내역은 복구되지 않습니다.`
                    )
                  ) {
                    setIsDeleting(true);
                    const toDelete = [...selectedTxIds];
                    setSelectedTxIds([]);
                    await deleteMultipleTransactions(toDelete);
                    setIsDeleting(false);
                    alert('선택한 자산 변동 내역이 삭제되었습니다.');
                  }
                }}
                className="px-3 py-1 bg-rose-700 hover:bg-rose-800 text-white rounded-2xs font-bold text-xs flex items-center gap-1 shadow-2xs"
              >
                <span className="material-symbols-outlined text-[15px]">delete</span>
                <span>선택 {selectedTxIds.length}건 삭제</span>
              </button>
            </div>
          </div>
        )}

        {/* 4. Main Transaction Ledger Table */}
        <div className="overflow-x-auto max-h-[600px]">
          <table className="w-full text-left border-collapse min-w-[720px]">
            <thead className="bg-[#faf8f5] border-b border-[#1a1a1a]/15 sticky top-0 z-10 text-[11px] font-bold uppercase tracking-wider text-[#1a1a1a]/60">
              <tr>
                {role === 'teacher' && (
                  <th className="py-3 px-3 w-10 text-center">
                    <input
                      type="checkbox"
                      checked={filteredTransactions.length > 0 && filteredTransactions.every(t => selectedTxIds.includes(t.id))}
                      onChange={(e) => {
                        if (e.target.checked) {
                          const allIds = Array.from(new Set([...selectedTxIds, ...filteredTransactions.map(t => t.id).filter(Boolean)]));
                          setSelectedTxIds(allIds);
                        } else {
                          const filteredSet = new Set(filteredTransactions.map(t => t.id));
                          setSelectedTxIds(prev => prev.filter(id => !filteredSet.has(id)));
                        }
                      }}
                      className="rounded-2xs border-stone-300 text-[#1a1a1a] focus:ring-0 w-4 h-4 cursor-pointer"
                      title="전체 선택/해제"
                    />
                  </th>
                )}
                <th className="py-3 px-4 w-16 text-center">No.</th>
                <th className="py-3 px-4 w-28">일시</th>
                <th className="py-3 px-4 w-32">거래 구분</th>
                <th className="py-3 px-4">상세 변동 내역</th>
                <th className="py-3 px-4 w-36 text-right">변동 금액</th>
                <th className="py-3 px-4 w-32 text-center">영향 자산</th>
                {role === 'teacher' && (
                  <th className="py-3 px-3 w-16 text-center">삭제</th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1a1a1a]/10 text-xs font-medium">
              {filteredTransactions.length > 0 ? (
                filteredTransactions.map((tx, index) => {
                  const impactAsset =
                    tx.type === 'deposit'
                      ? '현금 ➔ 예금'
                      : tx.type === 'withdraw'
                      ? '예금 ➔ 현금'
                      : tx.type === 'stock_buy'
                      ? '현금 ➔ 주식'
                      : tx.type === 'stock_sell'
                      ? '주식 ➔ 현금'
                      : tx.type === 'shop_buy'
                      ? '현금 ➔ 쿠폰'
                      : tx.type === 'reward'
                      ? '현금 증가'
                      : tx.type === 'fine'
                      ? '현금 차감'
                      : '현금 변동';

                  return (
                    <tr
                      key={tx.id || index}
                      className={`hover:bg-[#faf8f5] transition-colors ${
                        selectedTxIds.includes(tx.id) ? 'bg-amber-50/50' : ''
                      }`}
                    >
                      {role === 'teacher' && (
                        <td className="py-3.5 px-3 text-center">
                          <input
                            type="checkbox"
                            checked={selectedTxIds.includes(tx.id)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedTxIds(prev => [...prev, tx.id]);
                              } else {
                                setSelectedTxIds(prev => prev.filter(id => id !== tx.id));
                              }
                            }}
                            className="rounded-2xs border-stone-300 text-[#1a1a1a] focus:ring-0 w-4 h-4 cursor-pointer"
                          />
                        </td>
                      )}
                      <td className="py-3.5 px-4 text-center font-mono text-[#1a1a1a]/40 text-[11px]">
                        {index + 1}
                      </td>
                      <td className="py-3.5 px-4 text-[#1a1a1a]/70 font-mono text-[11px] whitespace-nowrap">
                        {tx.timestamp || '오늘'}
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        {renderTypeBadge(tx)}
                      </td>
                      <td className="py-3.5 px-4 font-medium text-[#1a1a1a]">
                        {tx.description}
                      </td>
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        {renderAmount(tx)}
                      </td>
                      <td className="py-3.5 px-4 text-center whitespace-nowrap">
                        <span className="px-2 py-0.5 rounded-2xs text-[10px] font-bold bg-[#faf8f5] text-[#1a1a1a]/60 border border-[#1a1a1a]/10">
                          {impactAsset}
                        </span>
                      </td>
                      {role === 'teacher' && (
                        <td className="py-3.5 px-3 text-center whitespace-nowrap">
                          <button
                            type="button"
                            onClick={async () => {
                              if (
                                confirm(
                                  `이 변동 내역("${tx.description || '-'}", ${(tx.amount || 0).toLocaleString()}원)을 삭제하시겠습니까?`
                                )
                              ) {
                                setSelectedTxIds(prev => prev.filter(id => id !== tx.id));
                                await deleteTransaction(tx.id);
                                alert('자산 변동 내역이 삭제되었습니다.');
                              }
                            }}
                            className="p-1 text-stone-400 hover:text-rose-700 hover:bg-rose-50 rounded-2xs transition-colors"
                            title="이 내역 삭제"
                          >
                            <span className="material-symbols-outlined text-[18px]">delete</span>
                          </button>
                        </td>
                      )}
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={role === 'teacher' ? 8 : 6} className="py-12 px-4 text-center">
                    <div className="max-w-sm mx-auto flex flex-col items-center">
                      <span className="text-3xl mb-2">📜</span>
                      <h4 className="font-bold text-sm text-[#1a1a1a] mb-1">
                        {searchTerm ? '검색된 자산 변동 내역이 없습니다.' : '아직 자산 변동 내역이 없습니다.'}
                      </h4>
                      <p className="text-xs text-[#1a1a1a]/50">
                        {searchTerm
                          ? '검색어를 변경하거나 필터를 초기화해 보세요.'
                          : '저축 예금에 돈을 넣거나, 주식을 사고팔면 실시간으로 거래 원장에 기록됩니다.'}
                      </p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Footer Summary Stats */}
        <div className="p-4 bg-[#faf8f5] border-t border-[#1a1a1a]/10 flex flex-wrap items-center justify-between gap-4 text-xs">
          <div className="flex items-center gap-4 text-[#1a1a1a]/70">
            <span>
              표시 중인 거래: <strong className="text-[#1a1a1a] font-mono">{filteredTransactions.length}</strong>건
            </span>
            <span>
              학급 코드: <strong className="text-[#1a1a1a] font-mono">{state.classCode}</strong>
            </span>
          </div>

          <div className="text-[11px] text-[#1a1a1a]/50">
            * 모든 자산 변동 내역은 클라우드 데이터베이스와 실시간으로 동기화됩니다.
          </div>
        </div>
      </div>
    </div>
  );
};
