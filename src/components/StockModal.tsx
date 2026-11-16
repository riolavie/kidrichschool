import React, { useState, useEffect } from 'react';
import { useClassEconomy } from '../context/ClassEconomyContext';

interface StockModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultStockId?: string;
}

export const StockModal: React.FC<StockModalProps> = ({ isOpen, onClose, defaultStockId }) => {
  const { currentStudent, buyStock, sellStock, state, lastActionError, clearLastActionError } = useClassEconomy();

  const initialStockId = defaultStockId && state.stocks.some(s => s.id === defaultStockId)
    ? defaultStockId
    : (state.stocks[0]?.id || '');

  const [selectedStockId, setSelectedStockId] = useState<string>(initialStockId);
  const [tradeType, setTradeType] = useState<'buy' | 'sell'>('buy');
  // Trading mode: 'amount' (1원 단위 금액 매매) vs 'shares' (주 수량 매매)
  const [orderMode, setOrderMode] = useState<'amount' | 'shares'>('amount');
  
  // Amount mode input (in Won, 1원 unit)
  const [amountStr, setAmountStr] = useState<string>('1000');
  // Shares mode input (in Shares)
  const [sharesStr, setSharesStr] = useState<string>('1');

  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Sync selectedStockId if defaultStockId changes
  useEffect(() => {
    if (defaultStockId && state.stocks.some(s => s.id === defaultStockId)) {
      setSelectedStockId(defaultStockId);
    } else if (state.stocks.length > 0 && (!selectedStockId || !state.stocks.some(s => s.id === selectedStockId))) {
      setSelectedStockId(state.stocks[0].id);
    }
  }, [defaultStockId, state.stocks, selectedStockId]);

  if (!isOpen || !currentStudent || state.stocks.length === 0) return null;

  const stock = state.stocks.find(s => s.id === selectedStockId) || state.stocks[0];
  const stockPrice = stock.currentPrice || 0;
  const currentCash = currentStudent.cash || 0;
  const ownedShares = (currentStudent.stockShares || {})[stock.id] || 0;
  const ownedWonValue = Math.round(ownedShares * stockPrice);

  const numericAmount = Math.max(0, parseInt(amountStr.replace(/[^0-9]/g, ''), 10) || 0);
  const numericShares = Math.max(0, parseFloat(sharesStr) || 0);

  // Calculate costs and shares based on active orderMode
  let tradeCost = 0;
  let tradeShares = 0;

  if (orderMode === 'amount') {
    tradeCost = numericAmount;
    tradeShares = stockPrice > 0 ? (numericAmount / stockPrice) : 0;
  } else {
    tradeShares = numericShares;
    tradeCost = Math.round(numericShares * stockPrice);
  }

  // Quick amount buttons helpers
  const maxAvailableWon = tradeType === 'buy' ? currentCash : ownedWonValue;

  const handleAddAmount = (addVal: number) => {
    const nextVal = Math.min(maxAvailableWon, numericAmount + addVal);
    setAmountStr(String(nextVal));
    setError('');
  };

  const handleSetAmountRatio = (ratio: number) => {
    const target = Math.floor(maxAvailableWon * ratio);
    setAmountStr(String(target));
    setError('');
  };

  const handleAddShares = (addVal: number) => {
    const nextVal = parseFloat((numericShares + addVal).toFixed(4));
    setSharesStr(String(Math.max(0, nextVal)));
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

    if (orderMode === 'amount') {
      if (numericAmount < 1) {
        setError('1원 이상의 금액을 입력해주세요.');
        return;
      }
    } else {
      if (numericShares <= 0) {
        setError('0주보다 큰 수량을 입력해주세요.');
        return;
      }
    }

    if (tradeType === 'buy') {
      if (tradeCost > currentCash) {
        setError(`보유 현금(${currentCash.toLocaleString()}원)이 부족합니다.`);
        return;
      }

      setIsSubmitting(true);
      try {
        const ok = orderMode === 'amount'
          ? await buyStock(stock.id, 0, numericAmount)
          : await buyStock(stock.id, numericShares);

        if (ok) {
          setSuccessMsg(`${stock.name} ${tradeCost.toLocaleString()}원 매수 완료!`);
          setSuccess(true);
          setTimeout(() => {
            setSuccess(false);
            onClose();
          }, 1200);
        } else {
          setError(lastActionError || '매수 처리에 실패했습니다. (잔액 또는 거래 상태 확인)');
        }
      } finally {
        setIsSubmitting(false);
      }
    } else {
      // Sell
      if (ownedShares <= 0) {
        setError(`보유 중인 ${stock.name} 주식이 없습니다.`);
        return;
      }

      if (orderMode === 'amount') {
        if (numericAmount > ownedWonValue) {
          setError(`보유 주식 평가액(${ownedWonValue.toLocaleString()}원)보다 많이 매도할 수 없습니다.`);
          return;
        }
      } else {
        if (numericShares > ownedShares) {
          setError(`보유 주식 수량(${ownedShares.toLocaleString()}주)보다 많이 매도할 수 없습니다.`);
          return;
        }
      }

      setIsSubmitting(true);
      try {
        const ok = orderMode === 'amount'
          ? await sellStock(stock.id, 0, numericAmount)
          : await sellStock(stock.id, numericShares);

        if (ok) {
          setSuccessMsg(`${stock.name} ${tradeCost.toLocaleString()}원 매도 완료!`);
          setSuccess(true);
          setTimeout(() => {
            setSuccess(false);
            onClose();
          }, 1200);
        } else {
          setError(lastActionError || '매도 처리에 실패했습니다. (보유량 또는 거래 상태 확인)');
        }
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  const projectedCashAfter = tradeType === 'buy'
    ? Math.max(0, currentCash - tradeCost)
    : currentCash + tradeCost;

  const projectedSharesAfter = tradeType === 'buy'
    ? ownedShares + tradeShares
    : Math.max(0, ownedShares - tradeShares);

  const formatShares = (val: number) => {
    if (val <= 0) return '0주';
    if (Number.isInteger(val)) return `${val.toLocaleString()}주`;
    return `${parseFloat(val.toFixed(4))}주`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#1a1a1a]/40 backdrop-blur-2xs p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-sm max-w-lg w-full p-6 shadow-2xl border border-[#1a1a1a]/15 relative max-h-[92vh] overflow-y-auto">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-[#1a1a1a]/50 hover:text-[#1a1a1a] w-8 h-8 flex items-center justify-center rounded-2xs hover:bg-[#faf8f5]"
        >
          <span className="material-symbols-outlined text-[18px]">close</span>
        </button>

        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-2xs bg-[#faf8f5] border border-[#1a1a1a]/15 flex items-center justify-center font-bold text-xl text-[#1a1a1a]">
            📈
          </div>
          <div>
            <h3 className="font-editorial text-xl font-bold text-[#1a1a1a]">모의 주식 거래소</h3>
            <p className="text-[11px] font-mono font-bold text-[#1a1a1a]/70 bg-[#faf8f5] px-2 py-0.5 rounded-2xs inline-block border border-[#1a1a1a]/12 mt-0.5">
              1원 단위 금액 매매 & 소수점 주식 투자 지원
            </p>
          </div>
        </div>

        {state.isTradingFrozen && (
          <div className="p-3 bg-rose-50 text-rose-900 font-bold text-xs rounded-2xs mb-4 flex items-center gap-2 border border-rose-300">
            <span className="material-symbols-outlined text-base">lock</span>
            선생님이 [거래 정지]를 설정해 두었습니다. 매수/매도가 일시 정지되었습니다.
          </div>
        )}

        {/* Stock Selection Grid */}
        <div className="mb-4">
          <label className="block text-[11px] font-bold uppercase tracking-wider text-[#1a1a1a]/60 mb-1.5">
            거래할 종목 선택 ({state.stocks.length}개 종목)
          </label>
          <div className="grid grid-cols-2 gap-2 max-h-56 overflow-y-auto pr-1">
            {state.stocks.map(st => {
              const isSelected = st.id === selectedStockId;
              const userShares = (currentStudent.stockShares || {})[st.id] || 0;
              return (
                <button
                  key={st.id}
                  type="button"
                  onClick={() => { setSelectedStockId(st.id); setError(''); }}
                  className={`p-2.5 rounded-2xs text-left border transition-all ${
                    isSelected
                      ? 'border-[#1a1a1a] bg-[#faf8f5] ring-1 ring-[#1a1a1a] shadow-2xs'
                      : 'border-[#1a1a1a]/15 bg-white hover:bg-[#faf8f5]'
                  }`}
                >
                  <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-wider text-[#1a1a1a]/50">
                    <span className="truncate max-w-[85px]">{st.category}</span>
                    {userShares > 0 && (
                      <span className="bg-[#1a1a1a]/10 text-[#1a1a1a] px-1 rounded-2xs text-[9px] font-mono font-bold">
                        {formatShares(userShares)}
                      </span>
                    )}
                  </div>
                  <div className="font-bold text-xs text-[#1a1a1a] truncate mt-0.5">{st.name}</div>
                  <div className="flex items-baseline justify-between mt-1">
                    <span className="font-mono font-bold text-xs text-[#1a1a1a]">{st.currentPrice.toLocaleString()}원</span>
                    <span className={`text-[10px] font-mono font-bold ${st.changeRate >= 0 ? 'text-emerald-800' : 'text-rose-800'}`}>
                      {st.changeRate >= 0 ? `▲+${st.changeRate}%` : `▼${st.changeRate}%`}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Buy / Sell mode selector */}
        <div className="flex bg-[#faf8f5] p-1 rounded-2xs border border-[#1a1a1a]/15 mb-3">
          <button
            type="button"
            onClick={() => { setTradeType('buy'); setError(''); }}
            className={`flex-1 py-1.5 rounded-2xs text-xs font-bold uppercase tracking-wider transition-all ${
              tradeType === 'buy' ? 'bg-[#1a1a1a] text-white shadow-2xs' : 'text-[#1a1a1a]/70 hover:text-[#1a1a1a]'
            }`}
          >
            🛒 매수 (사기)
          </button>
          <button
            type="button"
            onClick={() => { setTradeType('sell'); setError(''); }}
            className={`flex-1 py-1.5 rounded-2xs text-xs font-bold uppercase tracking-wider transition-all ${
              tradeType === 'sell' ? 'bg-[#1a1a1a] text-white shadow-2xs' : 'text-[#1a1a1a]/70 hover:text-[#1a1a1a]'
            }`}
          >
            💰 매도 (팔기)
          </button>
        </div>

        {/* Current holdings info banner */}
        <div className="bg-[#faf8f5] rounded-2xs p-3 mb-3 border border-[#1a1a1a]/15 text-xs space-y-1 font-medium">
          <div className="flex justify-between">
            <span className="text-[#1a1a1a]/60">내 보유 현금:</span>
            <span className="font-mono font-bold text-[#1a1a1a]">{currentCash.toLocaleString()}원</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[#1a1a1a]/60">현재 보유 {stock.name}:</span>
            <span className="font-mono font-bold text-[#1a1a1a]">
              {formatShares(ownedShares)} ({ownedWonValue.toLocaleString()}원)
            </span>
          </div>
        </div>

        {/* Debt warning if buying while in debt */}
        {tradeType === 'buy' && (currentStudent?.debt || 0) > 0 && (
          <div className="bg-rose-50 border border-rose-300 rounded-2xs p-2.5 mb-3 text-[11px] text-rose-950 flex items-center gap-2">
            <span className="text-base">🚨</span>
            <div>
              <strong>학급 부채 {(currentStudent?.debt || 0).toLocaleString()}원 보유 중</strong>
              <p className="text-rose-800 text-[10px]">새로운 주식 매수 전 학급 부채(빚)를 먼저 상환하는 것을 권장합니다.</p>
            </div>
          </div>
        )}

        {/* Trading Mode Switcher: 1원 단위 금액 vs 주 수량 */}
        <div className="flex items-center justify-between mb-3 bg-stone-100/70 p-1 rounded-2xs border border-stone-200">
          <button
            type="button"
            onClick={() => { setOrderMode('amount'); setError(''); }}
            className={`flex-1 py-1.5 rounded-2xs text-[11px] font-bold transition-all flex items-center justify-center gap-1 ${
              orderMode === 'amount'
                ? 'bg-white text-[#1a1a1a] shadow-xs border border-[#1a1a1a]/10'
                : 'text-[#1a1a1a]/60 hover:text-[#1a1a1a]'
            }`}
          >
            <span className="material-symbols-outlined text-[15px]">payments</span>
            금액으로 주문 (1원 단위)
          </button>
          <button
            type="button"
            onClick={() => { setOrderMode('shares'); setError(''); }}
            className={`flex-1 py-1.5 rounded-2xs text-[11px] font-bold transition-all flex items-center justify-center gap-1 ${
              orderMode === 'shares'
                ? 'bg-white text-[#1a1a1a] shadow-xs border border-[#1a1a1a]/10'
                : 'text-[#1a1a1a]/60 hover:text-[#1a1a1a]'
            }`}
          >
            <span className="material-symbols-outlined text-[15px]">tag</span>
            수량으로 주문 (주 단위)
          </button>
        </div>

        {success ? (
          <div className="py-8 text-center bg-[#faf8f5] rounded-2xs border border-[#1a1a1a]/15">
            <span className="material-symbols-outlined text-4xl text-[#1a1a1a] mb-2">check_circle</span>
            <p className="font-editorial font-bold text-[#1a1a1a] text-lg">
              {tradeType === 'buy' ? '주식 매수 완료!' : '주식 매도 완료!'}
            </p>
            <p className="text-xs text-[#1a1a1a]/70 mt-1">{successMsg}</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="p-3 bg-rose-50 text-rose-900 rounded-2xs text-xs font-medium border border-rose-300 flex items-center gap-2">
                <span className="material-symbols-outlined text-base">error</span>
                {error}
              </div>
            )}

            {/* Amount Mode Form */}
            {orderMode === 'amount' ? (
              <div>
                <div className="flex justify-between items-center text-xs font-bold uppercase tracking-wider text-[#1a1a1a]/70 mb-1">
                  <span>
                    {tradeType === 'buy' ? '매수할 금액 (1원 단위)' : '매도할 금액 (1원 단위)'}
                  </span>
                  <span className="text-[11px] font-mono text-[#1a1a1a]/60">
                    최대: {maxAvailableWon.toLocaleString()}원
                  </span>
                </div>
                <div className="relative">
                  <input
                    type="text"
                    inputMode="numeric"
                    placeholder="금액을 1원 단위로 입력"
                    value={amountStr ? Number(numericAmount).toLocaleString() : ''}
                    onChange={e => {
                      const clean = e.target.value.replace(/[^0-9]/g, '');
                      setAmountStr(clean);
                      setError('');
                    }}
                    className="w-full px-3 py-2.5 rounded-2xs border border-[#1a1a1a]/20 focus:border-[#1a1a1a] focus:ring-0 font-mono font-bold text-lg text-[#1a1a1a] bg-[#faf8f5] pr-12"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 font-mono font-bold text-sm text-[#1a1a1a]/50">
                    원
                  </span>
                </div>

                <div className="mt-1 text-[11px] text-[#1a1a1a]/70 font-mono flex justify-between">
                  <span>환산 주문 수량:</span>
                  <span className="font-bold text-[#1a1a1a]">
                    약 {tradeShares > 0 ? (tradeShares >= 1 ? tradeShares.toFixed(4) : tradeShares.toFixed(6)) : 0}주
                  </span>
                </div>

                {/* Won increment buttons */}
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

                {/* Ratio presets */}
                <div className="grid grid-cols-4 gap-1.5 mt-1.5">
                  <button
                    type="button"
                    onClick={() => handleSetAmountRatio(0.25)}
                    className="py-1 text-[11px] font-mono font-bold bg-white hover:bg-[#faf8f5] text-[#1a1a1a]/80 border border-[#1a1a1a]/15 rounded-2xs"
                  >
                    25%
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSetAmountRatio(0.5)}
                    className="py-1 text-[11px] font-mono font-bold bg-white hover:bg-[#faf8f5] text-[#1a1a1a]/80 border border-[#1a1a1a]/15 rounded-2xs"
                  >
                    50%
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSetAmountRatio(1.0)}
                    className="py-1 text-[11px] font-mono font-bold bg-[#1a1a1a]/10 hover:bg-[#1a1a1a]/20 text-[#1a1a1a] border border-[#1a1a1a]/20 rounded-2xs"
                  >
                    전액 ({maxAvailableWon.toLocaleString()}원)
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
            ) : (
              /* Shares Mode Form */
              <div>
                <div className="flex justify-between items-center text-xs font-bold uppercase tracking-wider text-[#1a1a1a]/70 mb-1">
                  <span>{tradeType === 'buy' ? '매수할 수량 (주)' : '매도할 수량 (주)'}</span>
                  {tradeType === 'sell' && (
                    <span className="text-[11px] font-mono text-[#1a1a1a]/60">
                      보유: {formatShares(ownedShares)}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleAddShares(-1)}
                    className="w-10 h-10 rounded-2xs bg-[#faf8f5] border border-[#1a1a1a]/20 font-bold text-base flex items-center justify-center text-[#1a1a1a] hover:bg-stone-200"
                  >
                    -
                  </button>
                  <div className="relative flex-1">
                    <input
                      type="number"
                      step="any"
                      min="0.0001"
                      value={sharesStr}
                      onChange={e => {
                        setSharesStr(e.target.value);
                        setError('');
                      }}
                      className="w-full text-center py-2 rounded-2xs border border-[#1a1a1a]/20 font-mono font-bold text-base text-[#1a1a1a] bg-[#faf8f5]"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => handleAddShares(1)}
                    className="w-10 h-10 rounded-2xs bg-[#faf8f5] border border-[#1a1a1a]/20 font-bold text-base flex items-center justify-center text-[#1a1a1a] hover:bg-stone-200"
                  >
                    +
                  </button>
                </div>

                <div className="mt-1 text-[11px] text-[#1a1a1a]/70 font-mono flex justify-between">
                  <span>환산 결제 예정액:</span>
                  <span className="font-bold text-[#1a1a1a]">{tradeCost.toLocaleString()}원</span>
                </div>

                {/* Quick share buttons */}
                <div className="grid grid-cols-4 gap-1.5 mt-2">
                  <button
                    type="button"
                    onClick={() => handleAddShares(1)}
                    className="py-1 text-[11px] font-mono font-bold bg-[#faf8f5] hover:bg-stone-200 text-[#1a1a1a] border border-[#1a1a1a]/15 rounded-2xs"
                  >
                    +1주
                  </button>
                  <button
                    type="button"
                    onClick={() => handleAddShares(5)}
                    className="py-1 text-[11px] font-mono font-bold bg-[#faf8f5] hover:bg-stone-200 text-[#1a1a1a] border border-[#1a1a1a]/15 rounded-2xs"
                  >
                    +5주
                  </button>
                  <button
                    type="button"
                    onClick={() => handleAddShares(10)}
                    className="py-1 text-[11px] font-mono font-bold bg-[#faf8f5] hover:bg-stone-200 text-[#1a1a1a] border border-[#1a1a1a]/15 rounded-2xs"
                  >
                    +10주
                  </button>
                  {tradeType === 'sell' ? (
                    <button
                      type="button"
                      onClick={() => { setSharesStr(String(ownedShares)); setError(''); }}
                      className="py-1 text-[11px] font-mono font-bold bg-[#1a1a1a]/10 hover:bg-[#1a1a1a]/20 text-[#1a1a1a] border border-[#1a1a1a]/20 rounded-2xs"
                    >
                      전량 매도
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        const maxBuyShares = stockPrice > 0 ? (currentCash / stockPrice) : 0;
                        setSharesStr(String(parseFloat(maxBuyShares.toFixed(4))));
                        setError('');
                      }}
                      className="py-1 text-[11px] font-mono font-bold bg-[#1a1a1a]/10 hover:bg-[#1a1a1a]/20 text-[#1a1a1a] border border-[#1a1a1a]/20 rounded-2xs"
                    >
                      최대 매수
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Order Summary Box */}
            <div className="p-3.5 bg-[#faf8f5] rounded-2xs border border-[#1a1a1a]/15 text-xs space-y-1.5">
              <div className="flex justify-between items-center font-bold">
                <span className="text-[#1a1a1a]/60 uppercase tracking-wider">
                  {tradeType === 'buy' ? '총 결제 금액 (현금 차감):' : '총 입금 예정액 (현금 증가):'}
                </span>
                <span className={`text-base font-mono ${tradeType === 'buy' ? 'text-rose-700' : 'text-emerald-800'}`}>
                  {tradeType === 'buy' ? '-' : '+'}{tradeCost.toLocaleString()}원
                </span>
              </div>
              <div className="pt-1.5 border-t border-[#1a1a1a]/10 flex justify-between text-[11px] text-[#1a1a1a]/70">
                <span>거래 후 예상 현금:</span>
                <span className="font-mono font-bold text-[#1a1a1a]">
                  {projectedCashAfter.toLocaleString()}원
                </span>
              </div>
              <div className="flex justify-between text-[11px] text-[#1a1a1a]/70">
                <span>거래 후 예상 {stock.name} 보유량:</span>
                <span className="font-mono font-bold text-[#1a1a1a]">
                  {formatShares(projectedSharesAfter)} ({Math.round(projectedSharesAfter * stockPrice).toLocaleString()}원)
                </span>
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
                disabled={state.isTradingFrozen || isSubmitting}
                className={`flex-1 py-2.5 rounded-2xs font-bold text-xs uppercase tracking-wider text-white transition-all shadow-2xs btn-press flex items-center justify-center gap-1 ${
                  state.isTradingFrozen || isSubmitting
                    ? 'bg-stone-400 cursor-not-allowed'
                    : 'bg-[#1a1a1a] hover:bg-stone-800'
                }`}
              >
                <span className="material-symbols-outlined text-[16px]">
                  {isSubmitting ? 'sync' : 'candlestick_chart'}
                </span>
                {isSubmitting
                  ? '주문 처리 중...'
                  : (tradeType === 'buy'
                    ? `${tradeCost.toLocaleString()}원 매수 확정`
                    : `${tradeCost.toLocaleString()}원 매도 확정`)}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
