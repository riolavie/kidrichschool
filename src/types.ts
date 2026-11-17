export type UserRole = 'student' | 'teacher' | 'super_admin' | 'guest';

export interface TeacherAccount {
  teacherId: string;
  name: string;
  email: string;
  password?: string;
  schoolName?: string;
  grade?: string;
  classNum?: string;
  classCode: string;
  className: string;
  createdAt: string;
}

export interface StudentRoundSnapshot {
  round: number;
  cash: number;
  savings: number;
  stockValue: number;
  debt?: number; // 빚 / 학급 부채
  totalAssets: number; // 순자산 (cash + savings + stockValue - debt)
  changeAmount?: number;
  changeRate?: number;
  timestamp?: string;
  notes?: string;
}

export interface Student {
  id: string;
  number: number;
  name: string;
  username: string;
  pin: string;
  isPinChanged?: boolean;
  showPin?: boolean;
  cash: number;
  savings: number;
  debt?: number; // 빚 / 학급 부채 (미납 벌금 등)
  stockShares: Record<string, number>;
  lastActive: string;
  isOnline?: boolean;
  lastSeen?: number; // epoch ms
  pinResetRequested: boolean;
  recentActivity: string;
  couponsOwned: Coupon[];
  roundHistory?: StudentRoundSnapshot[];
  balanceVersion?: number;
  updatedAtMs?: number;
}

export interface Coupon {
  id: string;
  name: string;
  icon: string;
  price: number;
  purchasedAt: string;
  used: boolean;
  requestedUse?: boolean;
  requestedAt?: string;
  usedAt?: string;
  teacherConfirmed?: boolean;
  teacherConfirmedAt?: string;
}

export interface ShopItem {
  id: string;
  name: string;
  price: number;
  icon: string;
  description: string;
  stock?: number;
}

export interface StockInfo {
  id: string;
  name: string;
  category: string;
  currentPrice: number;
  previousPrice: number;
  changeRate: number; // percentage
}

export interface Transaction {
  id: string;
  studentId: string;
  studentName: string;
  type: 'deposit' | 'withdraw' | 'stock_buy' | 'stock_sell' | 'shop_buy' | 'transfer' | 'reward' | 'fine';
  amount: number;
  description: string;
  timestamp: string;
  round?: number;
}

export interface NewsArticle {
  id: string;
  title: string;
  content: string;
  summary?: string;
  category: 'economy' | 'stock' | 'policy' | 'special' | 'class'; // 거시경제, 증시/종목, 금융/금리정책, 속보/특종, 학급소식
  relatedStockId?: string;
  relatedStockName?: string;
  impact?: 'positive' | 'negative' | 'neutral'; // 호재(▲), 악재(▼), 중립(─)
  publishedRound: number;
  publishedAt: string;
  author?: string;
  isBreaking?: boolean;
}

export interface ScheduledRoundScenario {
  id: string;
  targetRound: number; // 대상 라운드 (현재 라운드+1 ~ 최대 +5)
  scheduledAt: string; // datetime-local 형식 (YYYY-MM-DDTHH:mm)
  scheduledAtMs: number; // UTC epoch milliseconds
  depositRate: number;
  stockPrices: Record<string, number>;
  newsMessage: string;
  newsArticleTitle?: string;
  executeSettlementOnTrigger: boolean; // true: 예금 이자 정산 + 스냅샷 + 라운드 전진, false: 시나리오 반영 후 라운드 이동
  status: 'pending' | 'executing' | 'executed' | 'cancelled';
  createdAt: string;
  updatedAt: string;
  executedAt?: string;
}

export interface ClassEconomyState {
  classCode: string;
  className: string;
  teacherName?: string;
  teacherEmail?: string;
  currencyUnit?: string; // 화폐 단위 (기본: '원')
  language?: string;     // 기본 언어 (기본: 'ko')
  currentRound: number;
  totalRounds: number;
  isTradingFrozen: boolean;
  isLeaderboardPublic?: boolean; // 학급 랭킹(리더보드) 학생 공개 여부 (기본: true)
  depositInterestRate: number; // e.g. 5.0%
  newsMessage: string;
  newsArticles?: NewsArticle[]; // 학급 경제 뉴스레터 목록
  scheduledScenarios?: ScheduledRoundScenario[]; // 예약된 다음 라운드 시나리오 (최대 5개)
  stocks: StockInfo[];
  shopItems: ShopItem[];
  students: Student[];
  transactions: Transaction[];
  undoAvailableUntil: number | null; // timestamp
}

export interface LiquidatedStockItem {
  stockId: string;
  stockName: string;
  shares: number;
  amount: number;
}

export interface StudentFineRewardRecord {
  studentId: string;
  studentName: string;
  studentNumber?: number;
  type: 'fine' | 'reward';
  amount: number;
  cashDeducted: number;
  savingsDeducted: number;
  stockLiquidatedAmt: number;
  liquidatedStocks: LiquidatedStockItem[];
  newDebtIncurred: number;
  debtRepaid: number;
  finalDebt: number;
  finalCash: number;
  finalSavings: number;
}

export interface FineRewardResultSummary {
  type: 'fine' | 'reward';
  amount: number;
  reason: string;
  targetCount: number;
  totalCashDeducted: number;
  totalSavingsDeducted: number;
  totalStockLiquidated: number;
  totalNewDebt: number;
  totalDebtRepaid: number;
  records: StudentFineRewardRecord[];
}
