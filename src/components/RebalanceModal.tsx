import React, { useState } from 'react';
import { useClassEconomy } from '../context/ClassEconomyContext';

interface RebalanceModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const RebalanceModal: React.FC<RebalanceModalProps> = ({ isOpen, onClose }) => {
  const { currentStudent, calculateTotalAssets, state, rebalancePortfolio, lastActionError, clearLastActionError } = useClassEconomy();

  const [cashPct, setCashPct] = useState<number>(30);
  const [savingsPct, setSavingsPct] = useState<number>(40);
  const [stockPct, setStockPct] = useState<number>(30);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen || !currentStudent) return null;

  const totalAssets = calculateTotalAssets(currentStudent);

  // Current Values
  const currentStockVal = (state.stocks || []).reduce(
    (sum, st) => sum + ((currentStudent.stockShares || {})[st.id] || 0) * (st.currentPrice || 0),
    0
  );

  const currentCashPct = totalAssets > 0 ? Math.round(((currentStudent.cash || 0) / totalAssets) * 100) : 0;
  const currentSavingsPct = totalAssets > 0 ? Math.round(((currentStudent.savings || 0) / totalAssets) * 100) : 0;
  const currentStockPct = totalAssets > 0 ? Math.round((currentStockVal / totalAssets) * 100) : 0;

  // Projected Target Values
  const totalPctSum = cashPct + savingsPct + stockPct;
  const isSum100 = totalPctSum === 100;

  const targetCashAmt = Math.round(totalAssets * (cashPct / 100));
  const targetSavingsAmt = Math.round(totalAssets * (savingsPct / 100));
  const targetStockAmt = totalAssets - targetCashAmt - targetSavingsAmt;

  const diffCash = targetCashAmt - (currentStudent.cash || 0);
  const diffSavings = targetSavingsAmt - (currentStudent.savings || 0);
  const diffStock = targetStockAmt - currentStockVal;

  const applyPreset = (c: number, s: number, st: number) => {
    setCashPct(c);
    setSavingsPct(s);
    setStockPct(st);
    setError('');
  };

  const handleExecute = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    if (!isSum100) {
      setError(`자산 비중의 합계는 반드시 100%이어야 합니다. (현재: ${totalPctSum}%)`);
      return;
    }
    setError('');
    clearLastActionError();
    setIsSubmitting(true);
    try {
      const ok = await rebalancePortfolio(cashPct, savingsPct, stockPct);
      if (ok) {
        setSuccess(true);
        setTimeout(() => {
          setSuccess(false);
          onClose();
        }, 1500);
      } else {
        setError(lastActionError || '리밸런싱 실행에 실패했습니다. (거래 정지 상태를 확인하세요)');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#1a1a1a]/40 backdrop-blur-2xs p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-sm max-w-lg w-full p-6 shadow-2xl border border-[#1a1a1a]/15 relative max-h-[90vh] overflow-y-auto">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-[#1a1a1a]/50 hover:text-[#1a1a1a] w-8 h-8 flex items-center justify-center rounded-2xs hover:bg-[#faf8f5]"
        >
          <span className="material-symbols-outlined text-[18px]">close</span>
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-2xs bg-[#faf8f5] border border-[#1a1a1a]/15 flex items-center justify-center font-bold text-xl text-[#1a1a1a]">
            ⚖️
          </div>
          <div>
            <h3 className="font-editorial text-xl font-bold text-[#1a1a1a]">자산 보유 비중 설정 & 리밸런싱</h3>
            <p className="text-[11px] text-[#1a1a1a]/60 mt-0.5">
              목표 비율을 조정하면 현금, 저축, 주식이 자동으로 조정됩니다.
            </p>
          </div>
        </div>

        {/* Total Assets Summary Banner */}
        <div className="p-3.5 bg-[#faf8f5] rounded-2xs border border-[#1a1a1a]/15 mb-5 flex justify-between items-center">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-[#1a1a1a]/50">TOTAL PORTFOLIO</span>
            <div className="font-editorial font-bold text-lg text-[#1a1a1a]">
              {totalAssets.toLocaleString()}원
            </div>
          </div>
          <div className="text-right">
            <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-[#1a1a1a]/50">비중 합계</span>
            <div>
              <span className={`font-mono font-bold text-sm px-2 py-0.5 rounded-2xs border ${
                isSum100 ? 'bg-emerald-100 text-emerald-900 border-emerald-300' : 'bg-rose-100 text-rose-900 border-rose-300'
              }`}>
                {totalPctSum}% {isSum100 ? '✓ ok' : '⚠️ 100% 필요'}
              </span>
            </div>
          </div>
        </div>

        {/* Quick Strategy Presets */}
        <div className="mb-5">
          <label className="block text-xs font-bold uppercase tracking-wider text-[#1a1a1a]/70 mb-2">
            추천 포트폴리오 스타일
          </label>
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => applyPreset(50, 40, 10)}
              className="p-2 bg-[#faf8f5] hover:bg-stone-200 border border-[#1a1a1a]/15 rounded-2xs text-left transition-colors"
            >
              <div className="font-bold text-xs text-[#1a1a1a]">🛡️ 안정형</div>
              <div className="text-[10px] font-mono text-[#1a1a1a]/60 mt-0.5">50 / 40 / 10</div>
            </button>
            <button
              type="button"
              onClick={() => applyPreset(30, 40, 30)}
              className="p-2 bg-[#faf8f5] hover:bg-stone-200 border border-[#1a1a1a]/15 rounded-2xs text-left transition-colors"
            >
              <div className="font-bold text-xs text-[#1a1a1a]">⚖️ 균형형</div>
              <div className="text-[10px] font-mono text-[#1a1a1a]/60 mt-0.5">30 / 40 / 30</div>
            </button>
            <button
              type="button"
              onClick={() => applyPreset(10, 20, 70)}
              className="p-2 bg-[#faf8f5] hover:bg-stone-200 border border-[#1a1a1a]/15 rounded-2xs text-left transition-colors"
            >
              <div className="font-bold text-xs text-[#1a1a1a]">🚀 공격형</div>
              <div className="text-[10px] font-mono text-[#1a1a1a]/60 mt-0.5">10 / 20 / 70</div>
            </button>
          </div>
        </div>

        {/* Interactive Sliders */}
        <div className="space-y-4 mb-6">
          {/* Cash Slider */}
          <div>
            <div className="flex justify-between items-center mb-1">
              <span className="text-xs font-bold text-[#1a1a1a] uppercase tracking-wider flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-full bg-[#1a1a1a]"></span> 현금 보유 비중
              </span>
              <span className="font-mono font-bold text-xs text-[#1a1a1a]">{cashPct}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              step="5"
              value={cashPct}
              onChange={e => setCashPct(Number(e.target.value))}
              className="w-full h-2 bg-stone-200 rounded-2xs appearance-none cursor-pointer accent-[#1a1a1a]"
            />
          </div>

          {/* Savings Slider */}
          <div>
            <div className="flex justify-between items-center mb-1">
              <span className="text-xs font-bold text-[#1a1a1a] uppercase tracking-wider flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-full bg-[#5c5b57]"></span> 은행 예금 비중
              </span>
              <span className="font-mono font-bold text-xs text-[#1a1a1a]">{savingsPct}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              step="5"
              value={savingsPct}
              onChange={e => setSavingsPct(Number(e.target.value))}
              className="w-full h-2 bg-stone-200 rounded-2xs appearance-none cursor-pointer accent-[#1a1a1a]"
            />
          </div>

          {/* Stock Slider */}
          <div>
            <div className="flex justify-between items-center mb-1">
              <span className="text-xs font-bold text-[#1a1a1a] uppercase tracking-wider flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-full bg-[#a8a49c]"></span> 주식 투자 비중
              </span>
              <span className="font-mono font-bold text-xs text-[#1a1a1a]">{stockPct}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              step="5"
              value={stockPct}
              onChange={e => setStockPct(Number(e.target.value))}
              className="w-full h-2 bg-stone-200 rounded-2xs appearance-none cursor-pointer accent-[#1a1a1a]"
            />
          </div>
        </div>

        {/* Real-time Adjustment Projection Table */}
        <div className="border border-[#1a1a1a]/15 rounded-2xs overflow-hidden mb-5">
          <div className="bg-[#faf8f5] px-3 py-2 border-b border-[#1a1a1a]/15 text-[11px] font-bold uppercase tracking-wider text-[#1a1a1a]">
            리밸런싱 전/후 자산 금액 변동 예측
          </div>
          <table className="w-full text-xs text-left">
            <thead className="bg-[#faf8f5] text-[10px] font-bold text-[#1a1a1a]/60 uppercase border-b border-[#1a1a1a]/10">
              <tr>
                <th className="py-2 px-3">자산 종류</th>
                <th className="py-2 px-3 text-right">현재 금액</th>
                <th className="py-2 px-3 text-right">목표 금액</th>
                <th className="py-2 px-3 text-right">조정 필요액</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1a1a1a]/10 font-medium">
              <tr>
                <td className="py-2 px-3 font-bold text-[#1a1a1a]">현금</td>
                <td className="py-2 px-3 text-right font-mono">{currentStudent.cash.toLocaleString()}원</td>
                <td className="py-2 px-3 text-right font-mono font-bold">{targetCashAmt.toLocaleString()}원</td>
                <td className={`py-2 px-3 text-right font-mono font-bold ${
                  diffCash > 0 ? 'text-emerald-800' : diffCash < 0 ? 'text-rose-800' : 'text-stone-500'
                }`}>
                  {diffCash > 0 ? `+${diffCash.toLocaleString()}` : diffCash.toLocaleString()}원
                </td>
              </tr>
              <tr>
                <td className="py-2 px-3 font-bold text-[#1a1a1a]">예금</td>
                <td className="py-2 px-3 text-right font-mono">{currentStudent.savings.toLocaleString()}원</td>
                <td className="py-2 px-3 text-right font-mono font-bold">{targetSavingsAmt.toLocaleString()}원</td>
                <td className={`py-2 px-3 text-right font-mono font-bold ${
                  diffSavings > 0 ? 'text-emerald-800' : diffSavings < 0 ? 'text-rose-800' : 'text-stone-500'
                }`}>
                  {diffSavings > 0 ? `+${diffSavings.toLocaleString()}` : diffSavings.toLocaleString()}원
                </td>
              </tr>
              <tr>
                <td className="py-2 px-3 font-bold text-[#1a1a1a]">주식</td>
                <td className="py-2 px-3 text-right font-mono">{currentStockVal.toLocaleString()}원</td>
                <td className="py-2 px-3 text-right font-mono font-bold">{targetStockAmt.toLocaleString()}원</td>
                <td className={`py-2 px-3 text-right font-mono font-bold ${
                  diffStock > 0 ? 'text-emerald-800' : diffStock < 0 ? 'text-rose-800' : 'text-stone-500'
                }`}>
                  {diffStock > 0 ? `+${diffStock.toLocaleString()}` : diffStock.toLocaleString()}원
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {success ? (
          <div className="py-6 text-center bg-[#faf8f5] rounded-2xs border border-[#1a1a1a]/15">
            <span className="material-symbols-outlined text-4xl text-[#1a1a1a] mb-1">check_circle</span>
            <p className="font-editorial font-bold text-[#1a1a1a] text-base">자산 비중 리밸런싱 완료!</p>
            <p className="text-xs text-[#1a1a1a]/60 mt-1">
              목표 비율대로 현금, 예금, 주식 비중이 자동 조정되었습니다.
            </p>
          </div>
        ) : (
          <form onSubmit={handleExecute} className="space-y-4">
            {error && (
              <div className="p-3 bg-rose-50 text-rose-900 rounded-2xs text-xs font-medium border border-rose-300 flex items-center gap-2">
                <span className="material-symbols-outlined text-base">error</span>
                {error}
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-2.5 rounded-2xs font-bold text-xs uppercase tracking-wider text-[#1a1a1a]/70 hover:bg-[#faf8f5] transition-colors"
              >
                취소
              </button>
              <button
                type="submit"
                disabled={!isSum100 || isSubmitting}
                className={`flex-1 py-2.5 rounded-2xs font-bold text-xs uppercase tracking-wider text-white transition-all shadow-2xs btn-press flex items-center justify-center gap-1.5 ${
                  isSum100 && !isSubmitting ? 'bg-[#1a1a1a] hover:bg-stone-800' : 'bg-stone-300 cursor-not-allowed'
                }`}
              >
                <span className="material-symbols-outlined text-[16px]">
                  {isSubmitting ? 'sync' : 'tune'}
                </span>
                {isSubmitting ? '리밸런싱 적용 중...' : '자산 비중 자동 조정 실행'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
