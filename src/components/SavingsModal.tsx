import React, { useState } from 'react';
import { useClassEconomy } from '../context/ClassEconomyContext';

interface SavingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultMode?: 'deposit' | 'withdraw';
}

export const SavingsModal: React.FC<SavingsModalProps> = ({ isOpen, onClose, defaultMode = 'deposit' }) => {
  const { currentStudent, depositSavings, withdrawSavings, state, lastActionError, clearLastActionError } = useClassEconomy();
  const [mode, setMode] = useState<'deposit' | 'withdraw'>(defaultMode);
  const [amountStr, setAmountStr] = useState<string>('1000');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen || !currentStudent) return null;

  const currentCash = currentStudent.cash || 0;
  const currentSavings = currentStudent.savings || 0;
  const maxAmount = mode === 'deposit' ? currentCash : currentSavings;

  const numericAmount = Math.max(0, parseInt(amountStr.replace(/[^0-9]/g, ''), 10) || 0);

  const handleAmountChange = (val: string) => {
    // Only allow numbers
    const clean = val.replace(/[^0-9]/g, '');
    setAmountStr(clean);
    setError('');
  };

  const handleAddAmount = (addVal: number) => {
    const nextVal = Math.min(maxAmount, numericAmount + addVal);
    setAmountStr(String(nextVal));
    setError('');
  };

  const handleSetRatio = (ratio: number) => {
    const target = Math.floor(maxAmount * ratio);
    setAmountStr(String(target));
    setError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setError('');
    clearLastActionError();

    if (numericAmount < 1) {
      setError('1원 이상의 금액을 입력해 주세요.');
      return;
    }

    if (mode === 'deposit') {
      if (numericAmount > currentCash) {
        setError(`보유 현금(${currentCash.toLocaleString()}원)보다 큰 금액은 입금할 수 없습니다.`);
        return;
      }
      setIsSubmitting(true);
      try {
        const ok = await depositSavings(numericAmount);
        if (ok) {
          setSuccess(true);
          setTimeout(() => {
            setSuccess(false);
            onClose();
          }, 1200);
        } else {
          setError(lastActionError || '입금 처리에 실패했습니다. (보유 현금 또는 거래 정지 상태 확인)');
        }
      } finally {
        setIsSubmitting(false);
      }
    } else {
      if (numericAmount > currentSavings) {
        setError(`예금 잔액(${currentSavings.toLocaleString()}원)보다 큰 금액은 출금할 수 없습니다.`);
        return;
      }
      setIsSubmitting(true);
      try {
        const ok = await withdrawSavings(numericAmount);
        if (ok) {
          setSuccess(true);
          setTimeout(() => {
            setSuccess(false);
            onClose();
          }, 1200);
        } else {
          setError(lastActionError || '출금 처리에 실패했습니다. (예금 잔액 또는 거래 정지 상태 확인)');
        }
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  const projectedSavingsAfter = mode === 'deposit'
    ? currentSavings + numericAmount
    : Math.max(0, currentSavings - numericAmount);

  const projectedInterest = Math.round(projectedSavingsAfter * ((state.depositInterestRate || 5) / 100));

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
          <div className="w-10 h-10 rounded-2xs bg-[#faf8f5] border border-[#1a1a1a]/15 flex items-center justify-center font-bold text-xl text-[#1a1a1a]">
            🏦
          </div>
          <div>
            <h3 className="font-editorial text-xl font-bold text-[#1a1a1a]">키즈 은행 예금 서비스</h3>
            <p className="text-[11px] font-mono font-bold text-[#1a1a1a]/70 bg-[#faf8f5] px-2 py-0.5 rounded-2xs inline-block border border-[#1a1a1a]/12 mt-0.5">
              현재 예금 이자율: 연 {(state.depositInterestRate || 5).toFixed(1)}% (1원 단위 입·출금 가능)
            </p>
          </div>
        </div>

        {/* Tab switcher for Deposit vs Withdraw */}
        <div className="flex bg-[#faf8f5] p-1 rounded-2xs border border-[#1a1a1a]/15 mb-4">
          <button
            type="button"
            onClick={() => { setMode('deposit'); setError(''); }}
            className={`flex-1 py-2 rounded-2xs text-xs font-bold uppercase tracking-wider transition-all ${
              mode === 'deposit'
                ? 'bg-[#1a1a1a] text-white shadow-2xs'
                : 'text-[#1a1a1a]/70 hover:text-[#1a1a1a]'
            }`}
          >
            🐷 예금 입금하기 (저축)
          </button>
          <button
            type="button"
            onClick={() => { setMode('withdraw'); setError(''); }}
            className={`flex-1 py-2 rounded-2xs text-xs font-bold uppercase tracking-wider transition-all ${
              mode === 'withdraw'
                ? 'bg-[#1a1a1a] text-white shadow-2xs'
                : 'text-[#1a1a1a]/70 hover:text-[#1a1a1a]'
            }`}
          >
            💸 예금 출금하기 (찾기)
          </button>
        </div>

        <div className="bg-[#faf8f5] rounded-2xs p-4 mb-4 border border-[#1a1a1a]/15 text-xs space-y-1.5 font-medium">
          <div className="flex justify-between">
            <span className="text-[#1a1a1a]/60">현재 보유 현금:</span>
            <span className="font-mono font-bold text-[#1a1a1a]">{currentCash.toLocaleString()}원</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[#1a1a1a]/60">현재 예금 잔액:</span>
            <span className="font-mono font-bold text-[#1a1a1a]">{currentSavings.toLocaleString()}원</span>
          </div>
          <div className="flex justify-between pt-1.5 border-t border-[#1a1a1a]/10 text-[11px]">
            <span className="text-[#1a1a1a]/60">거래 후 예상 다음 라운드 이자:</span>
            <span className="font-mono font-bold text-emerald-800">
              +{projectedInterest.toLocaleString()}원
            </span>
          </div>
        </div>

        {success ? (
          <div className="py-8 text-center bg-[#faf8f5] rounded-2xs border border-[#1a1a1a]/15">
            <span className="material-symbols-outlined text-4xl text-[#1a1a1a] mb-2">check_circle</span>
            <p className="font-editorial font-bold text-[#1a1a1a] text-lg">
              {mode === 'deposit' ? '저축 입금 완료!' : '저축 출금 완료!'}
            </p>
            <p className="text-xs text-[#1a1a1a]/70 mt-1">
              {numericAmount.toLocaleString()}원이 성공적으로 {mode === 'deposit' ? '입금' : '출금'}되었습니다.
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
                <span>{mode === 'deposit' ? '입금할 금액 (1원 단위)' : '출금할 금액 (1원 단위)'}</span>
                <span className="text-[11px] font-mono text-[#1a1a1a]/60 font-semibold">
                  가능: {maxAmount.toLocaleString()}원
                </span>
              </div>
              <div className="relative">
                <input
                  type="text"
                  inputMode="numeric"
                  placeholder="금액을 1원 단위로 입력하세요"
                  value={amountStr ? Number(numericAmount).toLocaleString() : ''}
                  onChange={e => handleAmountChange(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-2xs border border-[#1a1a1a]/20 focus:border-[#1a1a1a] focus:ring-0 font-mono font-bold text-lg text-[#1a1a1a] bg-[#faf8f5] pr-12"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 font-mono font-bold text-sm text-[#1a1a1a]/50">
                  원
                </span>
              </div>

              {/* Quick increment buttons */}
              <div className="grid grid-cols-5 gap-1.5 mt-2">
                {[100, 500, 1000, 5000, 10000].map(val => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => handleAddAmount(val)}
                    className="py-1 text-[11px] font-mono font-bold bg-[#faf8f5] hover:bg-stone-200 text-[#1a1a1a] border border-[#1a1a1a]/15 rounded-2xs transition-colors"
                  >
                    +{val >= 1000 ? `${val / 1000}천` : `${val}원`}
                  </button>
                ))}
              </div>

              {/* Ratio & preset buttons */}
              <div className="grid grid-cols-4 gap-1.5 mt-1.5">
                <button
                  type="button"
                  onClick={() => handleSetRatio(0.25)}
                  className="py-1 text-[11px] font-mono font-bold bg-white hover:bg-[#faf8f5] text-[#1a1a1a]/80 border border-[#1a1a1a]/15 rounded-2xs"
                >
                  25%
                </button>
                <button
                  type="button"
                  onClick={() => handleSetRatio(0.5)}
                  className="py-1 text-[11px] font-mono font-bold bg-white hover:bg-[#faf8f5] text-[#1a1a1a]/80 border border-[#1a1a1a]/15 rounded-2xs"
                >
                  50%
                </button>
                <button
                  type="button"
                  onClick={() => handleSetRatio(1.0)}
                  className="py-1 text-[11px] font-mono font-bold bg-[#1a1a1a]/10 hover:bg-[#1a1a1a]/20 text-[#1a1a1a] border border-[#1a1a1a]/20 rounded-2xs"
                >
                  전액 ({maxAmount.toLocaleString()}원)
                </button>
                <button
                  type="button"
                  onClick={() => { setAmountStr(''); setError(''); }}
                  className="py-1 text-[11px] font-bold bg-stone-100 hover:bg-stone-200 text-[#1a1a1a]/60 border border-[#1a1a1a]/15 rounded-2xs"
                >
                  초기화
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
                disabled={isSubmitting}
                className="flex-1 py-2.5 rounded-2xs font-bold text-xs uppercase tracking-wider text-white bg-[#1a1a1a] hover:bg-stone-800 disabled:bg-stone-400 disabled:cursor-not-allowed transition-all shadow-2xs btn-press flex items-center justify-center gap-1"
              >
                <span className="material-symbols-outlined text-[16px]">
                  {isSubmitting ? 'sync' : (mode === 'deposit' ? 'savings' : 'payments')}
                </span>
                {isSubmitting
                  ? '처리 중...'
                  : (mode === 'deposit' ? `${numericAmount.toLocaleString()}원 입금 확정` : `${numericAmount.toLocaleString()}원 출금 확정`)}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
