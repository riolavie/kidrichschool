import React, { useState } from 'react';
import { useClassEconomy } from '../context/ClassEconomyContext';

interface RepayDebtModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const RepayDebtModal: React.FC<RepayDebtModalProps> = ({ isOpen, onClose }) => {
  const { currentStudent, repayDebt, state, lastActionError, clearLastActionError } = useClassEconomy();

  const currentDebt = Math.max(0, currentStudent?.debt || 0);
  const currentCash = Math.max(0, currentStudent?.cash || 0);
  const maxRepayable = Math.min(currentCash, currentDebt);

  const [amountStr, setAmountStr] = useState<string>(String(maxRepayable > 0 ? maxRepayable : 0));
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen || !currentStudent) return null;

  const numericAmount = Math.max(0, parseInt(amountStr.replace(/[^0-9]/g, ''), 10) || 0);

  const handleAdd = (val: number) => {
    const nextVal = Math.min(maxRepayable, numericAmount + val);
    setAmountStr(String(nextVal));
    setError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setError('');
    clearLastActionError();

    if (state.isTradingFrozen) {
      setError('현재 거래 정지 상태입니다.');
      return;
    }

    if (currentDebt <= 0) {
      setError('상환할 학급 부채(빚)가 없습니다.');
      return;
    }

    if (numericAmount < 1) {
      setError('1원 이상의 상환 금액을 입력해 주세요.');
      return;
    }

    if (numericAmount > currentCash) {
      setError(`보유 현금(${currentCash.toLocaleString()}원)보다 큰 금액은 상환할 수 없습니다.`);
      return;
    }

    if (numericAmount > currentDebt) {
      setError(`현재 남은 빚(${currentDebt.toLocaleString()}원)보다 큰 금액은 상환할 수 없습니다.`);
      return;
    }

    setIsSubmitting(true);
    try {
      const ok = await repayDebt(numericAmount);
      if (ok) {
        setSuccess(true);
        setTimeout(() => {
          setSuccess(false);
          onClose();
        }, 1200);
      } else {
        setError(lastActionError || '부채 상환 처리에 실패했습니다.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#1a1a1a]/40 backdrop-blur-2xs p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-sm max-w-md w-full p-6 shadow-2xl border border-[#1a1a1a]/15 relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-[#1a1a1a]/50 hover:text-[#1a1a1a] w-8 h-8 flex items-center justify-center rounded-2xs hover:bg-[#faf8f5]"
        >
          <span className="material-symbols-outlined text-[18px]">close</span>
        </button>

        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-2xs bg-rose-100 border border-rose-300 flex items-center justify-center font-bold text-xl text-rose-900">
            💸
          </div>
          <div>
            <h3 className="font-editorial text-xl font-bold text-[#1a1a1a]">학급 부채(빚) 상환</h3>
            <p className="text-[11px] font-mono font-bold text-rose-900 bg-rose-50 px-2 py-0.5 rounded-2xs inline-block border border-rose-200 mt-0.5">
              남은 빚: {currentDebt.toLocaleString()}원
            </p>
          </div>
        </div>

        <div className="bg-[#faf8f5] rounded-2xs p-4 mb-4 border border-[#1a1a1a]/15 text-xs space-y-2 font-medium">
          <div className="flex justify-between items-center">
            <span className="text-[#1a1a1a]/60">현재 보유 현금:</span>
            <span className="font-mono font-bold text-[#1a1a1a]">{currentCash.toLocaleString()}원</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-[#1a1a1a]/60">현재 남은 빚(부채):</span>
            <span className="font-mono font-bold text-rose-800">{currentDebt.toLocaleString()}원</span>
          </div>
          <div className="flex justify-between items-center pt-2 border-t border-[#1a1a1a]/10 text-[11px]">
            <span className="text-[#1a1a1a]/70">상환 후 남은 빚:</span>
            <span className="font-mono font-bold text-emerald-800">
              {Math.max(0, currentDebt - numericAmount).toLocaleString()}원
            </span>
          </div>
        </div>

        {currentCash <= 0 && currentDebt > 0 && (
          <div className="p-3 bg-amber-50 text-amber-900 rounded-2xs text-xs mb-4 border border-amber-300">
            <p className="font-bold mb-0.5">💡 보유 현금이 0원입니다</p>
            <p className="text-[11px] text-amber-800">
              저축 예금을 출금하거나, 주식을 매각하여 현금을 마련한 후 빚을 갚을 수 있습니다.
            </p>
          </div>
        )}

        {success ? (
          <div className="py-8 text-center bg-[#faf8f5] rounded-2xs border border-[#1a1a1a]/15">
            <span className="material-symbols-outlined text-4xl text-emerald-700 mb-2">check_circle</span>
            <p className="font-editorial font-bold text-[#1a1a1a] text-lg">
              부채 상환 완료!
            </p>
            <p className="text-xs text-[#1a1a1a]/70 mt-1">
              {numericAmount.toLocaleString()}원의 빚이 정상적으로 갚아졌습니다.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="p-3 bg-rose-50 text-rose-900 rounded-2xs text-xs font-medium border border-rose-300 flex items-center gap-2">
                <span className="material-symbols-outlined text-base">error</span>
                {error}
              </div>
            )}

            <div>
              <div className="flex justify-between items-center text-xs font-bold uppercase tracking-wider text-[#1a1a1a]/70 mb-1">
                <span>상환할 금액 (1원 단위)</span>
                <span className="text-[11px] font-mono text-[#1a1a1a]/60">
                  최대 가능: {maxRepayable.toLocaleString()}원
                </span>
              </div>
              <div className="relative">
                <input
                  type="text"
                  inputMode="numeric"
                  placeholder="금액을 입력하세요 (1원 단위)"
                  value={amountStr ? Number(numericAmount).toLocaleString() : ''}
                  onChange={e => {
                    const clean = e.target.value.replace(/[^0-9]/g, '');
                    setAmountStr(clean);
                    setError('');
                  }}
                  className="w-full px-3 py-2.5 rounded-2xs border border-[#1a1a1a]/20 focus:border-[#1a1a1a] focus:ring-0 font-mono font-bold text-lg text-[#1a1a1a] bg-[#faf8f5] pr-10"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 font-mono font-bold text-sm text-[#1a1a1a]/50">
                  원
                </span>
              </div>

              {/* Quick increment buttons */}
              <div className="grid grid-cols-6 gap-1.5 mt-2">
                {[100, 500, 1000, 5000, 10000].map(val => (
                  <button
                    key={val}
                    type="button"
                    disabled={maxRepayable <= 0}
                    onClick={() => handleAdd(val)}
                    className="py-1 text-[11px] font-mono font-bold bg-[#faf8f5] hover:bg-stone-200 text-[#1a1a1a] border border-[#1a1a1a]/15 rounded-2xs transition-colors disabled:opacity-50"
                  >
                    +{val >= 1000 ? `${val / 1000}천` : `${val}원`}
                  </button>
                ))}
                <button
                  type="button"
                  disabled={maxRepayable <= 0}
                  onClick={() => {
                    setAmountStr(String(maxRepayable));
                    setError('');
                  }}
                  className="py-1 text-[11px] font-mono font-bold bg-[#1a1a1a]/10 hover:bg-[#1a1a1a]/20 text-[#1a1a1a] border border-[#1a1a1a]/20 rounded-2xs disabled:opacity-50"
                >
                  최대
                </button>
              </div>
            </div>

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
                disabled={maxRepayable <= 0 || numericAmount <= 0 || isSubmitting}
                className={`flex-1 py-2.5 rounded-2xs font-bold text-xs uppercase tracking-wider text-white transition-all shadow-2xs btn-press flex items-center justify-center gap-1 ${
                  maxRepayable <= 0 || numericAmount <= 0 || isSubmitting
                    ? 'bg-stone-400 cursor-not-allowed'
                    : 'bg-rose-900 hover:bg-rose-950'
                }`}
              >
                <span className="material-symbols-outlined text-[16px]">
                  {isSubmitting ? 'sync' : 'payments'}
                </span>
                {isSubmitting
                  ? '상환 처리 중...'
                  : (numericAmount > 0 ? `${numericAmount.toLocaleString()}원 상환 확정` : '상환 확정')}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
