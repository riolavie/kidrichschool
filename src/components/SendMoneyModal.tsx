import React, { useState } from 'react';
import { useClassEconomy } from '../context/ClassEconomyContext';

interface SendMoneyModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultTarget?: string;
}

export const SendMoneyModal: React.FC<SendMoneyModalProps> = ({ isOpen, onClose, defaultTarget }) => {
  const { currentStudent, currentTeacher, transferMoney, state, lastActionError, clearLastActionError } = useClassEconomy();
  const teacherDisplayName = state.teacherName
    ? `${state.teacherName} 선생님`
    : (currentTeacher?.name ? `${currentTeacher.name} 선생님` : '선생님');

  const [targetName, setTargetName] = useState(defaultTarget || teacherDisplayName);
  const [amount, setAmount] = useState<number>(5000);
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  React.useEffect(() => {
    if (defaultTarget) {
      setTargetName(defaultTarget);
    } else {
      setTargetName(teacherDisplayName);
    }
  }, [defaultTarget, teacherDisplayName]);

  if (!isOpen || !currentStudent) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setError('');
    clearLastActionError();
    if (amount <= 0) {
      setError('송금 금액을 입력해 주세요.');
      return;
    }
    if (amount > currentStudent.cash) {
      setError(`보유 현금(${currentStudent.cash.toLocaleString()}원)보다 많은 금액은 송금할 수 없습니다.`);
      return;
    }

    setIsSubmitting(true);
    try {
      const ok = await transferMoney(targetName, amount, note);
      if (ok) {
        setSuccess(true);
        setTimeout(() => {
          setSuccess(false);
          onClose();
        }, 1200);
      } else {
        setError(lastActionError || '송금에 실패했습니다. (보유 현금 또는 거래 상태 확인)');
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
          <div className="w-10 h-10 rounded-2xs bg-[#faf8f5] border border-[#1a1a1a]/15 text-[#1a1a1a] flex items-center justify-center font-bold text-xl">
            💸
          </div>
          <div>
            <h3 className="font-editorial text-xl font-bold text-[#1a1a1a]">선생님 / 친구에게 송금</h3>
            <p className="text-[11px] text-[#1a1a1a]/60">내 보유 현금: <span className="font-mono font-bold text-[#1a1a1a]">{currentStudent.cash.toLocaleString()}원</span></p>
          </div>
        </div>

        {success ? (
          <div className="py-8 text-center bg-[#faf8f5] rounded-2xs border border-[#1a1a1a]/15">
            <span className="material-symbols-outlined text-4xl text-[#1a1a1a] mb-2">check_circle</span>
            <p className="font-editorial font-bold text-[#1a1a1a] text-lg">{targetName}님께 {amount.toLocaleString()}원 송금 완료!</p>
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
              <label className="block text-xs font-bold uppercase tracking-wider text-[#1a1a1a]/70 mb-1">받는 사람</label>
              <select
                value={targetName}
                onChange={e => setTargetName(e.target.value)}
                className="w-full px-3 py-2 rounded-2xs border border-[#1a1a1a]/20 focus:border-[#1a1a1a] focus:ring-0 font-medium text-xs text-[#1a1a1a] bg-[#faf8f5]"
              >
                <option value={teacherDisplayName}>👨‍🏫 {teacherDisplayName} (담임교사)</option>
                {state.students
                  .filter(s => s.id !== currentStudent.id)
                  .map(s => (
                    <option key={s.id} value={s.name}>
                      🧒 {s.number}번 {s.name}
                    </option>
                  ))}
              </select>
            </div>

            <div>
              <div className="flex justify-between items-center text-xs font-bold uppercase tracking-wider text-[#1a1a1a]/70 mb-1">
                <span>송금 금액 (1원 단위)</span>
                <span className="text-[11px] font-mono text-[#1a1a1a]/60">
                  보유: {currentStudent.cash.toLocaleString()}원
                </span>
              </div>
              <div className="relative">
                <input
                  type="number"
                  step="1"
                  min="1"
                  max={currentStudent.cash}
                  value={amount}
                  onChange={e => setAmount(Math.max(0, parseInt(e.target.value, 10) || 0))}
                  className="w-full px-3 py-2.5 rounded-2xs border border-[#1a1a1a]/20 focus:border-[#1a1a1a] focus:ring-0 font-mono font-bold text-lg text-[#1a1a1a] bg-[#faf8f5] pr-10"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 font-mono font-bold text-sm text-[#1a1a1a]/50">
                  원
                </span>
              </div>
              <div className="grid grid-cols-5 gap-1.5 mt-2">
                {[100, 500, 1000, 5000, 10000].map(val => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => setAmount(prev => Math.min(currentStudent.cash, prev + val))}
                    className="py-1 text-[11px] font-mono font-bold bg-[#faf8f5] hover:bg-stone-200 text-[#1a1a1a] border border-[#1a1a1a]/15 rounded-2xs transition-colors"
                  >
                    +{val >= 1000 ? `${val / 1000}천` : `${val}원`}
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-1.5 mt-1.5">
                <button
                  type="button"
                  onClick={() => setAmount(currentStudent.cash)}
                  className="py-1 text-[11px] font-mono font-bold bg-[#1a1a1a]/10 hover:bg-[#1a1a1a]/20 text-[#1a1a1a] border border-[#1a1a1a]/20 rounded-2xs"
                >
                  전액 ({currentStudent.cash.toLocaleString()}원)
                </button>
                <button
                  type="button"
                  onClick={() => setAmount(0)}
                  className="py-1 text-[11px] font-bold bg-stone-100 hover:bg-stone-200 text-[#1a1a1a]/60 border border-[#1a1a1a]/15 rounded-2xs"
                >
                  초기화
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-[#1a1a1a]/70 mb-1">메모 (선택사항)</label>
              <input
                type="text"
                placeholder="예: 학급 상점 결제 / 모둠비 / 우정 선물"
                value={note}
                onChange={e => setNote(e.target.value)}
                className="w-full px-3 py-2 rounded-2xs border border-[#1a1a1a]/20 focus:border-[#1a1a1a] focus:ring-0 text-xs text-[#1a1a1a] bg-[#faf8f5]"
              />
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-2 rounded-2xs font-bold text-xs uppercase tracking-wider text-[#1a1a1a]/70 hover:bg-[#faf8f5] transition-colors"
              >
                취소
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="flex-1 py-2 rounded-2xs bg-[#1a1a1a] text-white font-bold text-xs uppercase tracking-wider hover:bg-stone-800 disabled:bg-stone-400 disabled:cursor-not-allowed transition-all shadow-2xs btn-press flex items-center justify-center gap-1"
              >
                <span className="material-symbols-outlined text-[16px]">
                  {isSubmitting ? 'sync' : 'send'}
                </span>
                {isSubmitting ? '송금 처리 중...' : '송금하기'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
