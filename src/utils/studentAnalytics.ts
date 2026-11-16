import { Student, Transaction, StockInfo, StudentRoundSnapshot } from '../types';

/**
 * Flexible matcher that links any transaction to a student regardless of whether
 * it was logged with student.id, student.username, student.name, or student.number.
 */
export function matchStudentTransaction(tx: Transaction, student: Student): boolean {
  if (!tx || !student) return false;

  const normalize = (val?: string | number | null) => {
    if (val === undefined || val === null) return '';
    return String(val).toLowerCase().replace(/[-_\s]/g, '');
  };

  const normStudentId = normalize(student.id);
  const normUsername = normalize(student.username);
  const normName = normalize(student.name);
  const sNum = Number(student.number ?? 0);

  const normTxStudentId = normalize(tx.studentId);
  const normTxStudentName = normalize(tx.studentName);

  // 1. If transaction has a specific student name (1342 out of 1372 txs have exact student name!)
  if (normTxStudentName && normTxStudentName !== '학생') {
    return normTxStudentName === normName;
  }

  // 2. Direct or normalized ID match
  if (normTxStudentId) {
    if (normTxStudentId === normStudentId || normTxStudentId === normUsername) return true;
    if (sNum > 0) {
      if (
        normTxStudentId === `student${sNum}` ||
        normTxStudentId === `student0${sNum}` ||
        normTxStudentId === `student${String(sNum).padStart(2, '0')}` ||
        normTxStudentId.endsWith(`_${sNum - 1}_${sNum}`) ||
        normTxStudentId === String(sNum)
      ) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Enriches transactions for a student so that all ledger records are collected,
 * with any missing coupon actions properly reflected.
 */
export function getEnrichedStudentTransactions(
  student: Student,
  allTransactions: Transaction[],
  stocks: StockInfo[],
  currentRound: number,
  depositRate: number
): Transaction[] {
  if (!student) return [];

  const matched = (allTransactions || []).filter(tx => matchStudentTransaction(tx, student));
  const result: Transaction[] = [...matched];

  // If student has coupons in couponsOwned that were bought outside the ledger, add them
  (student.couponsOwned || []).forEach((c, idx) => {
    const alreadyExists = result.some(
      t => t.type === 'shop_buy' && (t.description?.includes(c.name) || (c.price > 0 && t.amount === c.price))
    );
    if (!alreadyExists && c.price > 0) {
      result.push({
        id: `coupon-${student.id}-${c.id || idx}`,
        studentId: student.id,
        studentName: student.name,
        type: 'shop_buy',
        amount: c.price,
        description: `학급 상점: ${c.name} 결제`,
        timestamp: c.purchasedAt || '쿠폰 구매'
      });
    }
  });

  // Sort by timestamp descending
  result.sort((a, b) => {
    const timeA = a.timestamp || '';
    const timeB = b.timestamp || '';
    if (timeA && timeB && timeA !== timeB) {
      return timeB.localeCompare(timeA);
    }
    return (b.id || '').localeCompare(a.id || '');
  });

  return result;
}

/**
 * Reconstructs a full, continuous, mathematically accurate round-by-round asset history
 * (from Round 1 to currentRound) using the student's actual chronological ledger transactions,
 * interest payments, stock portfolio valuation, and exact live balances.
 */
export function reconstructStudentRoundHistory(
  student: Student,
  currentRound: number,
  allTransactions: Transaction[],
  stocks: StockInfo[],
  depositRate: number
): {
  roundHistory: StudentRoundSnapshot[];
  totalIncome: number;
  totalExpense: number;
  initialBaseAsset: number;
  incomeBreakdown: { reward: number; interest: number; stockSell: number; transferIn: number; other: number };
  expenseBreakdown: { shop: number; stockBuy: number; fine: number; transferOut: number; other: number };
} {
  const effectiveRound = Math.max(1, currentRound);
  const studentTxs = (allTransactions || []).filter(tx => matchStudentTransaction(tx, student));

  // Determine student initial starting capital
  let initialBaseAsset = 30000;
  if (student.number === 26 || student.username === 'test') {
    initialBaseAsset = 10000;
  }
  const initTx = studentTxs.find(t => t.description?.includes('잔액 지급') || t.description?.includes('초기'));
  if (initTx && initTx.amount === 40000) {
    initialBaseAsset = 40000;
  }

  // Income vs Expense breakdowns across all time
  let rewardTotal = 0;
  let interestTotal = 0;
  let stockSellTotal = 0;
  let transferInTotal = 0;
  let otherInTotal = 0;

  let shopTotal = 0;
  let stockBuyTotal = 0;
  let fineTotal = 0;
  let transferOutTotal = 0;
  let otherOutTotal = 0;

  studentTxs.forEach(t => {
    const d = t.description || '';
    const amt = Number(t.amount || 0);

    // Disregard internal portfolio rebalancing transactions
    if (d.includes('리밸런싱') || d.includes('비중')) return;

    if (t.type === 'deposit') {
      if (d.includes('이자')) {
        interestTotal += amt;
      }
      return;
    }
    if (t.type === 'withdraw') {
      return;
    }

    if (t.type === 'reward') {
      rewardTotal += amt;
    } else if (d.includes('이자')) {
      interestTotal += amt;
    } else if (t.type === 'stock_sell') {
      stockSellTotal += amt;
    } else if (t.type === 'shop_buy') {
      shopTotal += amt;
    } else if (t.type === 'stock_buy') {
      stockBuyTotal += amt;
    } else if (t.type === 'fine') {
      fineTotal += amt;
    } else if (t.type === 'transfer') {
      if (d.includes('수령') || d.includes('받음') || d.includes('입금')) {
        transferInTotal += amt;
      } else {
        transferOutTotal += amt;
      }
    } else {
      if (amt > 0) otherInTotal += amt;
    }
  });

  const totalIncome = rewardTotal + interestTotal + stockSellTotal + transferInTotal + otherInTotal;
  const totalExpense = shopTotal + stockBuyTotal + fineTotal + transferOutTotal + otherOutTotal;

  // Live round 4 assets
  const sharesMap = student.stockShares || {};
  const currentStockVal = (stocks || []).reduce((sum, st) => {
    return sum + (Number(sharesMap[st.id]) || 0) * (Number(st.currentPrice) || 0);
  }, 0);
  const currentLiveCash = Number(student.cash) || 0;
  const currentLiveSavings = Number(student.savings) || 0;
  const currentLiveDebt = Math.max(0, Number(student.debt) || 0);
  const currentLiveTotal = Math.round(currentLiveCash + currentLiveSavings + currentStockVal - currentLiveDebt);

  // Historical Round milestones & stock prices
  const round1Cutoff = '2026-09-08 12:50';
  const round2Cutoff = '2026-09-16 11:37';
  const round3Cutoff = '2026-09-28 12:51';

  const pricesR1: Record<string, number> = {
    '삼송전자': 10000, '미래 IT': 10000, '에코 에너지': 5000, '미래자동차': 5000,
    'KB시민은행': 4500, '농신식품': 2400
  };
  const pricesR2: Record<string, number> = {
    '삼송전자': 9500, '농신식품': 2100, 'KB시민은행': 5500, '셀트리안 바이오': 3000,
    '미래 IT': 10000, '에코 에너지': 5000, '미래자동차': 5000
  };
  const pricesR3: Record<string, number> = {
    '엔디비아': 17000, '셀트리안 바이오': 3000, '현제자동차': 5000, '한와솔루션': 3500,
    '삼송전자': 10000, '태슬라': 8000, '코코아': 3000, 'KB시민은행': 5000, '농신식품': 2000, '구골': 15500
  };

  const calculateStockVal = (holdingShares: Record<string, number>, priceMap: Record<string, number>) => {
    let sum = 0;
    for (const [stName, count] of Object.entries(holdingShares)) {
      if (count > 0) {
        let p = priceMap[stName];
        if (!p) {
          for (const [k, v] of Object.entries(priceMap)) {
            if (stName.includes(k) || k.includes(stName)) {
              p = v;
              break;
            }
          }
        }
        sum += count * (p || 5000);
      }
    }
    return sum;
  };

  // Sort student transactions chronologically
  const chronologicalTxs = [...studentTxs].sort((a, b) => {
    const timeA = a.timestamp || '';
    const timeB = b.timestamp || '';
    if (timeA.startsWith('2026') && timeB.startsWith('2026') && timeA !== timeB) {
      return timeA.localeCompare(timeB);
    }
    if (timeA.includes('오전 11:35') && timeB.startsWith('2026')) return '2026-09-16 11:35'.localeCompare(timeB);
    if (timeB.includes('오전 11:35') && timeA.startsWith('2026')) return timeA.localeCompare('2026-09-16 11:35');
    return (a.id || '').localeCompare(b.id || '');
  });

  let runningCash = initialBaseAsset;
  let runningSavings = 0;
  let runningShares: Record<string, number> = {};

  const snapshots: StudentRoundSnapshot[] = [];
  let prevTotal = initialBaseAsset;

  const processSlice = (cutoff: string, roundNum: number, priceMap: Record<string, number>, defaultNote: string) => {
    const prevCutoff = roundNum === 1 ? '2026-08-01' : roundNum === 2 ? round1Cutoff : round2Cutoff;
    const txsInRound = chronologicalTxs.filter(t => {
      const time = t.timestamp || '';
      if (time.includes('오전 11:35')) return roundNum === 2;
      return time >= prevCutoff && time < cutoff;
    });

    let roundReward = 0;
    let roundInterest = 0;
    let roundFine = 0;
    let roundShop = 0;
    let hasRebal = false;

    txsInRound.forEach(t => {
      const d = t.description || '';
      const amt = Number(t.amount || 0);

      if (d.includes('리밸런싱')) {
        const match = d.match(/현금:\s*([\d,]+)원,\s*저축:\s*([\d,]+)원,\s*주식:\s*([\d,]+)원/);
        if (match) {
          runningCash = parseInt(match[1].replace(/,/g, ''), 10);
          runningSavings = parseInt(match[2].replace(/,/g, ''), 10);
          hasRebal = true;
        }
      } else if (t.type === 'reward') {
        runningCash += amt;
        roundReward += amt;
      } else if (t.type === 'fine') {
        runningCash = Math.max(0, runningCash - amt);
        roundFine += amt;
      } else if (t.type === 'deposit') {
        if (d.includes('이자')) {
          runningSavings += amt;
          roundInterest += amt;
        } else {
          runningCash = Math.max(0, runningCash - amt);
          runningSavings += amt;
        }
      } else if (t.type === 'withdraw') {
        runningSavings = Math.max(0, runningSavings - amt);
        runningCash += amt;
      } else if (t.type === 'shop_buy') {
        runningCash = Math.max(0, runningCash - amt);
        roundShop += amt;
      } else if (t.type === 'stock_buy') {
        runningCash = Math.max(0, runningCash - amt);
        const stockMatch = d.match(/(.*?)\s*(\d+)주\s*매수/);
        if (stockMatch) {
          const sName = stockMatch[1].trim();
          const sCount = parseInt(stockMatch[2], 10);
          runningShares[sName] = (runningShares[sName] || 0) + sCount;
        }
      } else if (t.type === 'stock_sell') {
        runningCash += amt;
        const stockMatch = d.match(/(.*?)\s*(\d+)주\s*매도/);
        if (stockMatch) {
          const sName = stockMatch[1].trim();
          const sCount = parseInt(stockMatch[2], 10);
          runningShares[sName] = Math.max(0, (runningShares[sName] || 0) - sCount);
        }
      } else if (t.type === 'transfer') {
        if (d.includes('수령') || d.includes('받음')) {
          runningCash += amt;
        } else {
          runningCash = Math.max(0, runningCash - amt);
        }
      }
    });

    const stockVal = calculateStockVal(runningShares, priceMap);
    const roundTotal = runningCash + runningSavings + stockVal;
    const changeAmount = roundTotal - prevTotal;
    const changeRate = prevTotal > 0 ? parseFloat(((changeAmount / prevTotal) * 100).toFixed(1)) : 0;

    let dynamicNote = defaultNote;
    if (roundInterest > 0) {
      dynamicNote = `예금 이자(+${roundInterest.toLocaleString()}원) 수령`;
    } else if (hasRebal) {
      dynamicNote = '포트폴리오 비중 리밸런싱';
    } else if (roundReward > 0 && roundShop > 0) {
      dynamicNote = `급여·상금(+${roundReward.toLocaleString()}원) 및 상점 결제`;
    } else if (roundReward > 0) {
      dynamicNote = `급여·상금(+${roundReward.toLocaleString()}원) 수령`;
    } else if (roundFine > 0) {
      dynamicNote = `학급 벌금(-${roundFine.toLocaleString()}원) 차감`;
    }

    snapshots.push({
      round: roundNum,
      cash: runningCash,
      savings: runningSavings,
      stockValue: stockVal,
      totalAssets: roundTotal,
      changeAmount,
      changeRate,
      timestamp: roundNum === 1 ? '2026-09-08' : roundNum === 2 ? '2026-09-16' : '2026-09-28',
      notes: dynamicNote
    });

    prevTotal = roundTotal;
  };

  // Build rounds 1, 2, 3
  if (effectiveRound >= 1) {
    processSlice(round1Cutoff, 1, pricesR1, 'Round 1 모의 증권시장 개장 및 투자');
  }
  if (effectiveRound >= 2) {
    processSlice(round2Cutoff, 2, pricesR2, 'Round 2 예금 이자(+3.0%) 및 시세 변동 반영');
  }
  if (effectiveRound >= 3) {
    processSlice(round3Cutoff, 3, pricesR3, 'Round 3 종목 거래 및 자산 정산');
  }

  // Current Live Round (Round 4) strictly reflects live database values
  if (effectiveRound >= 4) {
    const liveChangeAmount = currentLiveTotal - prevTotal;
    const liveChangeRate = prevTotal > 0 ? parseFloat(((liveChangeAmount / prevTotal) * 100).toFixed(1)) : 0;

    snapshots.push({
      round: 4,
      cash: currentLiveCash,
      savings: currentLiveSavings,
      stockValue: currentStockVal,
      debt: currentLiveDebt,
      totalAssets: currentLiveTotal,
      changeAmount: liveChangeAmount,
      changeRate: liveChangeRate,
      timestamp: new Date().toISOString().replace('T', ' ').substring(0, 16),
      notes: 'Round 4 현재 진행 중 (실시간)'
    });
  }

  return {
    roundHistory: snapshots,
    totalIncome,
    totalExpense,
    initialBaseAsset,
    incomeBreakdown: {
      reward: rewardTotal,
      interest: interestTotal,
      stockSell: stockSellTotal,
      transferIn: transferInTotal,
      other: otherInTotal
    },
    expenseBreakdown: {
      shop: shopTotal,
      stockBuy: stockBuyTotal,
      fine: fineTotal,
      transferOut: transferOutTotal,
      other: otherOutTotal
    }
  };
}
