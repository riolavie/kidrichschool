import React, { useState } from 'react';
import { useClassEconomy } from '../context/ClassEconomyContext';

interface SettlementModalProps {
  isOpen: boolean;
  onClose: () => void;
  pendingDepositRate?: number;
  pendingStockPrices?: Record<string, number>;
  pendingNewsMessage?: string;
}

export const SettlementModal: React.FC<SettlementModalProps> = ({
  isOpen,
  onClose,
  pendingDepositRate,
  pendingStockPrices,
  pendingNewsMessage
}) => {
  const { state, executeSettlement } = useClassEconomy();
  const [check1, setCheck1] = useState(true);
  const [check2, setCheck2] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const effectiveDepositRate = pendingDepositRate !== undefined ? pendingDepositRate : state.depositInterestRate;
  const effectiveStocks = state.stocks.map(st => {
    const newPrice = pendingStockPrices && pendingStockPrices[st.id] !== undefined ? pendingStockPrices[st.id] : st.currentPrice;
    const prevPrice = st.currentPrice;
    const changeRate = prevPrice > 0 ? parseFloat((((newPrice - prevPrice) / prevPrice) * 100).toFixed(1)) : 0;
    return {
      ...st,
      newPrice,
      changeRate
    };
  });

  const studentsWithSavings = state.students.filter(s => s.savings > 0);
  const totalInterestToPay = state.students.reduce((sum, s) => {
    return sum + Math.round(s.savings * (effectiveDepositRate / 100));
  }, 0);

  const nextRound = Math.min(state.totalRounds, state.currentRound + 1);

  const handleConfirm = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      await executeSettlement({
        depositRate: effectiveDepositRate,
        stockPrices: pendingStockPrices,
        newsMessage: pendingNewsMessage
      });
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#1a1a1a]/40 backdrop-blur-2xs p-4 animate-in fade-in duration-200">
      <div className="bg-white max-w-[560px] w-full rounded-sm overflow-hidden shadow-2xl border border-[#1a1a1a]/15 border-t-4 border-t-red-900 flex flex-col">
        <div className="p-6 pb-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xs bg-red-50 border border-red-200 text-red-900 flex items-center justify-center font-bold">
                <span className="material-symbols-outlined text-[22px]">account_balance</span>
              </div>
              <div>
                <h2 className="font-editorial text-xl font-bold text-[#1a1a1a]">
                  Round {state.currentRound} 라운드 정산 및 종료
                </h2>
                <p className="text-[11px] text-[#1a1a1a]/60">
                  정산 실행 시 <strong className="text-red-900">Round {nextRound}</strong>(으)로 진행되며 이자와 주가가 일괄 갱신됩니다.
                </p>
              </div>
            </div>
            <span className="text-xs font-mono font-bold bg-[#1a1a1a] text-white px-2.5 py-1 rounded-2xs">
              R{state.currentRound} → R{nextRound}
            </span>
          </div>

          <div className="bg-[#faf8f5] rounded-2xs p-4 space-y-3.5 border border-[#1a1a1a]/15 text-xs">
            {/* 1. Interest rate settlement */}
            <label className="flex items-start gap-3 cursor-pointer group">
              <input
                type="checkbox"
                checked={check1}
                onChange={e => setCheck1(e.target.checked)}
                className="mt-0.5 w-4 h-4 rounded-2xs border-[#1a1a1a]/30 text-[#1a1a1a] focus:ring-[#1a1a1a]"
              />
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <p className="font-bold text-[#1a1a1a]">
                    예금 이자율 {effectiveDepositRate.toFixed(1)}% 일괄 지급
                  </p>
                  <span className="font-mono font-bold text-emerald-900 bg-emerald-50 border border-emerald-300 px-2 py-0.5 rounded-2xs text-[11px]">
                    총 +{totalInterestToPay.toLocaleString()}{state.currencyUnit || '원'}
                  </span>
                </div>
                <p className="text-[11px] text-[#1a1a1a]/60 mt-0.5">
                  저축 보유 학생 {studentsWithSavings.length}명 / 전체 {state.students.length}명의 예금 계좌에 이자가 즉시 입금됩니다.
                </p>
              </div>
            </label>

            {/* 2. Stock price updates preview */}
            <label className="flex items-start gap-3 cursor-pointer group">
              <input
                type="checkbox"
                checked={check2}
                onChange={e => setCheck2(e.target.checked)}
                className="mt-0.5 w-4 h-4 rounded-2xs border-[#1a1a1a]/30 text-[#1a1a1a] focus:ring-[#1a1a1a]"
              />
              <div className="flex-1">
                <p className="font-bold text-[#1a1a1a]">주식 시장 가격 변동 및 속보 반영</p>
                <div className="mt-1.5 grid grid-cols-1 sm:grid-cols-2 gap-1.5 bg-white p-2.5 rounded-2xs border border-[#1a1a1a]/10">
                  {effectiveStocks.map(st => (
                    <div key={st.id} className="flex justify-between items-center text-[11px] font-mono">
                      <span className="truncate max-w-[120px] font-medium text-stone-700">{st.name}:</span>
                      <span className="font-bold text-[#1a1a1a]">
                        {st.newPrice.toLocaleString()}원{' '}
                        <span className={st.changeRate >= 0 ? 'text-emerald-800' : 'text-rose-800'}>
                          ({st.changeRate >= 0 ? `+${st.changeRate}%` : `${st.changeRate}%`})
                        </span>
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </label>

            {/* 3. Sync note */}
            <div className="pt-2 border-t border-[#1a1a1a]/10 flex items-center justify-between text-[11px] text-[#1a1a1a]/70">
              <span className="flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[15px] text-emerald-800">sync</span>
                정산 대상: <strong>전체 학생 {state.students.length}명</strong>
              </span>
              <span>모든 학생 자산 실시간 일괄 정산</span>
            </div>
          </div>
        </div>

        <div className="p-4 px-6 flex justify-end gap-3 bg-[#faf8f5] border-t border-[#1a1a1a]/15 mt-2">
          <button
            onClick={onClose}
            className="h-10 px-4 rounded-2xs font-bold text-xs uppercase tracking-wider text-[#1a1a1a]/70 hover:bg-stone-200 transition-colors"
          >
            취소
          </button>
          <button
            onClick={handleConfirm}
            disabled={isSubmitting}
            className="h-10 px-5 rounded-2xs bg-red-900 hover:bg-red-950 disabled:bg-stone-400 disabled:cursor-not-allowed text-white font-bold text-xs uppercase tracking-wider transition-all btn-press flex items-center gap-1.5 shadow-2xs"
          >
            <span className="material-symbols-outlined text-[16px]">
              {isSubmitting ? 'sync' : 'check_circle'}
            </span>
            {isSubmitting ? '전체 정산 실행 중...' : `정산 실행 및 Round ${nextRound} 진행`}
          </button>
        </div>
      </div>
    </div>
  );
};
