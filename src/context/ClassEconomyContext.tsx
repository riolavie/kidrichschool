import React, { createContext, useContext, useState, useEffect, useRef, useMemo } from 'react';
import { ClassEconomyState, Student, UserRole, ShopItem, Transaction, StockInfo, TeacherAccount, NewsArticle, Coupon, StudentRoundSnapshot, LiquidatedStockItem, StudentFineRewardRecord, FineRewardResultSummary, ScheduledRoundScenario } from '../types';
import { initialClassState, initialStudents, initialNewsArticles } from '../data/initialData';
import { reconstructStudentRoundHistory } from '../utils/studentAnalytics';
import { deduplicateStudents } from '../lib/studentDeduplication';
import {
  syncClassToFirestore,
  syncStudentToFirestore,
  syncStudentProfileFromTeacher,
  syncStudentNonBalanceFieldsFromTeacher,
  syncMultipleStudentProfilesFromTeacher,
  syncMultipleStudentNonBalanceFieldsFromTeacher,
  saveMultipleStudentsToFirestore,
  getStudentsFromFirestore,
  getClassFromFirestore,
  getTransactionsFromFirestore,
  deleteStudentFromFirestore,
  deleteMultipleStudentsFromFirestore,
  clearAllStudentsFromFirestore,
  deleteTransactionFromFirestore,
  deleteMultipleTransactionsFromFirestore,
  clearAllTransactionsFromFirestore,
  logTransactionToFirestore,
  saveTeacherToFirestore,
  getTeacherFromFirestore,
  updateTeacherPasswordInFirestore,
  isClassCodeTakenInFirestore,
  subscribeToClass,
  subscribeToStudents,
  subscribeToSingleStudent,
  getSingleStudentFromFirestore,
  subscribeToTransactions,
  isFirestoreQuotaExceeded,
  toSafeInt,
  toSafeShares,
  sanitizeStockSharesMap,
  calcBuySharesFromAmount,
  calcBuyCostFromShares,
  calcSellReturnFromShares,
  calcSellSharesFromAmount,
  runAtomicDeposit,
  runAtomicWithdraw,
  runAtomicBuyStock,
  runAtomicSellStock,
  runAtomicBuyShopItem,
  runAtomicTransferMoney,
  runAtomicRebalance,
  runAtomicRepayDebt,
  runAtomicForgiveStudentDebt,
  runAtomicTeacherSettlement,
  runAtomicFineOrReward,
  claimScheduledScenarioExecution,
  resetScheduledScenarioToPending
} from '../lib/firebase';

export const MAX_STOCKS = 15;
export const MAX_SCHEDULED_SCENARIOS = 5;

interface ClassEconomyContextType {
  state: ClassEconomyState;
  role: UserRole;
  currentStudentId: string;
  currentStudent: Student | undefined;
  currentTeacher: TeacherAccount | null;
  isCloudConnected: boolean;
  isSyncing: boolean;
  lastSyncedAt: Date | null;
  initialUrlClassCode: string;
  lastActionError: string | null;
  clearLastActionError: () => void;
  refreshClassData: () => Promise<boolean>;
  setRole: (role: UserRole) => void;
  setCurrentStudentId: (id: string) => void;
  setCurrentTeacher: (teacher: TeacherAccount | null) => void;
  updateTeacherProfile: (profile: {
    name: string;
    email?: string;
    schoolName?: string;
    grade?: string;
    classNum?: string;
    password?: string;
  }) => Promise<{ success: boolean; message?: string }>;
  loginTeacher: (emailOrId: string, password?: string) => Promise<{ success: boolean; message?: string }>;
  signupTeacher: (
    name: string,
    email: string,
    password?: string,
    className?: string,
    classCode?: string,
    schoolName?: string,
    grade?: string,
    classNum?: string
  ) => Promise<{ success: boolean; message?: string }>;
  verifyTeacherForPasswordReset: (
    teacherIdOrEmail: string,
    schoolName: string,
    grade: string,
    classNum: string
  ) => Promise<{ success: boolean; teacher?: TeacherAccount; message?: string }>;
  resetTeacherPassword: (
    teacherIdOrEmail: string,
    newPassword: string
  ) => Promise<{ success: boolean; message?: string }>;
  loginStudent: (identifier: string, pin?: string, targetClassCode?: string) => Promise<{ success: boolean; message?: string }>;
  getAvailableStudentsForClass: (targetClassCode?: string) => Promise<Student[]>;
  getSavedTeacherAccounts: () => TeacherAccount[];
  quickLoginTeacher: (teacher: TeacherAccount) => Promise<void>;
  quickLoginStudent: (studentId: string, targetClassCode?: string) => Promise<void>;
  isSuperAdminSession: boolean;
  loginSuperAdmin: (email: string, password: string) => Promise<{ success: boolean; message?: string }>;
  impersonateClassAsTeacher: (target: {
    classCode: string;
    className?: string;
    name?: string;
    email?: string;
    teacherId?: string;
    schoolName?: string;
    grade?: string;
    classNum?: string;
    password?: string;
    createdAt?: string;
  }) => Promise<void>;
  returnToSuperAdmin: () => void;
  logout: () => void;
  // Student Actions (Atomic Firestore + Safe Integer Local Fallback)
  depositSavings: (amount: number) => Promise<boolean>;
  withdrawSavings: (amount: number) => Promise<boolean>;
  buyStock: (stockId: string, shares: number, customAmount?: number) => Promise<boolean>;
  sellStock: (stockId: string, shares: number, customAmount?: number) => Promise<boolean>;
  buyShopItem: (item: ShopItem) => Promise<boolean>;
  transferMoney: (targetName: string, amount: number, note: string) => Promise<boolean>;
  rebalancePortfolio: (targetCashPct: number, targetSavingsPct: number, targetStockPct: number) => Promise<boolean>;
  useCoupon: (couponId: string) => void;
  cancelCouponRequest: (couponId: string) => void;
  toggleCouponTeacherConfirm: (studentId: string, couponId: string, forceStatus?: boolean) => void;
  batchSetCouponsTeacherConfirm: (items: { studentId: string; couponId: string }[], confirmed: boolean) => void;
  changeStudentPin: (studentId: string, newPin: string) => { success: boolean; message?: string };
  // Teacher Actions
  updateStudentPinByTeacher: (studentId: string, newPin: string) => { success: boolean; message?: string };
  updateMultipleStudentsPinByTeacher: (studentIds: string[], newPin: string) => { success: boolean; message?: string };
  requestPinReset: (studentIdentifier: string, classCode?: string) => Promise<{ success: boolean; message?: string }>;
  updateClassSettings: (settings: {
    className?: string;
    classCode?: string;
    teacherName?: string;
    teacherEmail?: string;
    currencyUnit?: string;
    totalRounds?: number;
    currentRound?: number;
    language?: string;
    isLeaderboardPublic?: boolean;
  }) => void;
  toggleTradingFreeze: () => void;
  toggleLeaderboardPublic: () => void;
  setLeaderboardPublic: (isPublic: boolean) => void;
  setInterestRates: (depositRate: number, loanRate?: number) => void;
  updateStockPrice: (stockId: string, newPrice: number) => void;
  applyRoundScenario: (scenario: {
    depositRate?: number;
    stockPrices?: Record<string, number>;
    newsMessage?: string;
  }) => void;
  // Scheduled Round Scenarios (up to 5 rounds, auto-saved & time-triggered)
  upsertScheduledScenario: (scenarioInput: {
    id?: string;
    targetRound: number;
    scheduledAt: string;
    depositRate: number;
    stockPrices: Record<string, number>;
    newsMessage: string;
    newsArticleTitle?: string;
    executeSettlementOnTrigger: boolean;
    status?: ScheduledRoundScenario['status'];
  }) => { success: boolean; message?: string; scenario?: ScheduledRoundScenario };
  deleteScheduledScenario: (scenarioId: string) => void;
  triggerScheduledScenarioNow: (scenarioId: string) => Promise<boolean>;
  addStock: (name: string, category: string, initialPrice: number) => boolean;
  deleteStock: (stockId: string) => boolean;
  publishNews: (message: string) => void;
  publishNewsArticle: (article: Omit<NewsArticle, 'id' | 'publishedAt'> & { id?: string; publishedAt?: string }) => void;
  updateNewsArticle: (article: NewsArticle) => void;
  deleteNewsArticle: (articleId: string) => void;
  setRound: (round: number) => void;
  executeSettlement: (scenarioOptions?: {
    depositRate?: number;
    stockPrices?: Record<string, number>;
    newsMessage?: string;
  }) => Promise<boolean>;
  restorePreviousState: () => void;
  applyFineOrReward: (type: 'fine' | 'reward', amount: number, reason: string, targetStudentIds: string[]) => Promise<FineRewardResultSummary | null>;
  lastFineRewardSummary: FineRewardResultSummary | null;
  setLastFineRewardSummary: (summary: FineRewardResultSummary | null) => void;
  approvePinReset: (studentId: string, customPin?: string) => void;
  resetAllPins: (defaultPin?: string) => void;
  addStudent: (name: string, username?: string, pin?: string, initialCash?: number) => void;
  addBulkStudents: (names: string[], initialCash?: number) => void;
  createNumberedStudents: (count: number, initialCash?: number) => void;
  deleteStudent: (studentId: string) => Promise<boolean>;
  deleteMultipleStudents: (studentIds: string[]) => Promise<boolean>;
  removeDuplicateStudents: () => Promise<{ removedCount: number; removedNames: string[] }>;
  repairAllStudentBalancesConsistency: () => Promise<{ fixedCount: number; details: string[] }>;
  deleteTransaction: (txId: string) => Promise<boolean>;
  deleteMultipleTransactions: (txIds: string[]) => Promise<boolean>;
  clearAllTransactions: () => Promise<boolean>;
  addShopItem: (item: Omit<ShopItem, 'id'>) => void;
  deleteShopItem: (itemId: string) => void;
  repayDebt: (amount: number) => Promise<boolean>;
  forgiveStudentDebt: (studentId: string, amount?: number) => Promise<boolean>;
  calculateTotalAssets: (student: Student) => number;
  resetAllData: () => void;
  exportFullBackupJSON: () => string;
  importFullBackupJSON: (jsonString: string) => Promise<{ success: boolean; message: string; count?: number }>;
}

const ClassEconomyContext = createContext<ClassEconomyContextType | undefined>(undefined);

const LOCAL_STORAGE_KEY = 'kidsrich_school_state_v2';

export function normalizeFullWidthDigits(str: string): string {
  if (!str) return '';
  return String(str).replace(/[０-９]/g, (s) => String.fromCharCode(s.charCodeAt(0) - 0xFEE0));
}

export function normalizeClassCode(code?: string): string {
  if (!code) return '';
  let trimmed = normalizeFullWidthDigits(String(code)).trim().toUpperCase().replace(/\s+/g, '');
  trimmed = trimmed.replace(/^(CLASS|반|학급)[-_]?/i, 'C-');
  if (/^C\d{4,6}$/.test(trimmed)) {
    return 'C-' + trimmed.slice(1);
  }
  if (/^\d{4,6}$/.test(trimmed)) {
    return `C-${trimmed}`;
  }
  return trimmed;
}

export function matchStudentIdentifier(candidateList: Student[], rawQuery: string): Student | undefined {
  const cleanId = normalizeFullWidthDigits(String(rawQuery || '')).trim();
  if (!cleanId) return undefined;

  const cleanLower = cleanId.toLowerCase().replace(/\s+/g, '');
  const digitsOnly = cleanId.replace(/[^0-9]/g, '');
  const parsedNum = digitsOnly ? parseInt(digitsOnly, 10) : null;
  const alphaNumOnly = cleanLower.replace(/[^a-z0-9가-힣]/g, '');

  return candidateList.find(s => {
    if (!s) return false;
    const sName = String(s.name || '').trim().toLowerCase().replace(/\s+/g, '');
    const sUsername = String(s.username || '').trim().toLowerCase().replace(/\s+/g, '');
    const sNum = Number(s.number);
    const sId = String(s.id || '').trim().toLowerCase();

    // 1. Direct exact matches
    if (sName === cleanLower || sUsername === cleanLower || sId === cleanLower) return true;

    // 2. Alpha-numeric clean matches (e.g. student01 vs student_01, student-01)
    const sUserAlpha = sUsername.replace(/[^a-z0-9]/g, '');
    const sIdAlpha = sId.replace(/[^a-z0-9]/g, '');
    if (alphaNumOnly && (alphaNumOnly === sUserAlpha || alphaNumOnly === sIdAlpha)) return true;

    // 3. Korean name variations: e.g. '1번 김민준' or '김민준(1)' or '김민준 1번'
    if (cleanLower.includes(sName) || sName.includes(cleanLower)) {
      if (parsedNum !== null && !isNaN(parsedNum)) {
        if (sNum === parsedNum) return true;
      } else {
        return true;
      }
    }

    // 4. Number-based query: e.g. '1', '01', '1번', '01번', '1번 학생', '학생 1', 'student1', 'student_1'
    if (parsedNum !== null && !isNaN(parsedNum) && sNum === parsedNum) {
      if (
        cleanLower === String(parsedNum) ||
        cleanLower === digitsOnly ||
        cleanLower === parsedNum + '번' ||
        cleanLower === digitsOnly + '번' ||
        cleanLower === parsedNum + '번학생' ||
        cleanLower === digitsOnly + '번학생' ||
        cleanLower === '학생' + parsedNum ||
        cleanLower === 'student' + parsedNum ||
        cleanLower === 'student' + digitsOnly ||
        cleanLower === 'student_' + parsedNum ||
        cleanLower === 'student_' + digitsOnly ||
        cleanLower === 'student-' + parsedNum ||
        cleanLower === 'student-' + digitsOnly
      ) {
        return true;
      }
    }

    return false;
  });
}

export function sanitizeStudent(s: any): Student {
  const num = Number(s?.number ?? 1);
  const rawCash = s?.cash;
  const parsedCash = rawCash !== undefined && rawCash !== null && Number.isFinite(Number(rawCash))
    ? toSafeInt(rawCash, 30000)
    : 30000;

  const rawSavings = s?.savings;
  const parsedSavings = rawSavings !== undefined && rawSavings !== null && Number.isFinite(Number(rawSavings))
    ? toSafeInt(rawSavings, 0)
    : 0;

  const rawDebt = s?.debt;
  const parsedDebt = rawDebt !== undefined && rawDebt !== null && Number.isFinite(Number(rawDebt))
    ? toSafeInt(rawDebt, 0)
    : 0;

  const sanitizedShares = sanitizeStockSharesMap(s?.stockShares);

  return {
    id: String(s?.id || `student-${isNaN(num) ? 1 : num}`),
    number: isNaN(num) ? 1 : num,
    name: String(s?.name || '학생'),
    username: s?.username || `student_${String(isNaN(num) ? 1 : num).padStart(2, '0')}`,
    pin: s?.pin !== undefined && s?.pin !== null && String(s?.pin).trim() !== '' ? String(s?.pin).trim() : '1234',
    cash: parsedCash,
    savings: parsedSavings,
    debt: parsedDebt,
    stockShares: sanitizedShares,
    couponsOwned: Array.isArray(s?.couponsOwned)
      ? s.couponsOwned.map((c: any) => {
          const item: any = {
            id: String(c.id || `coupon-${Date.now()}`),
            name: String(c.name || '쿠폰'),
            price: toSafeInt(c.price || 0, 0),
            teacherConfirmed: Boolean(c.teacherConfirmed || c.used),
            used: Boolean(c.used || c.teacherConfirmed),
            requestedUse: Boolean(c.requestedUse)
          };
          if (c.icon) item.icon = String(c.icon);
          if (c.itemId) item.itemId = String(c.itemId);
          if (c.purchasedAt) item.purchasedAt = String(c.purchasedAt);
          if (c.usedAt) item.usedAt = String(c.usedAt);
          if (c.requestedAt) item.requestedAt = String(c.requestedAt);
          if (c.teacherConfirmedAt) item.teacherConfirmedAt = String(c.teacherConfirmedAt);
          return item;
        })
      : [],
    isPinChanged: Boolean(s?.isPinChanged),
    isOnline: Boolean(s?.isOnline || false),
    pinResetRequested: Boolean(s?.pinResetRequested),
    recentActivity: String(s?.recentActivity || '계정 준비됨'),
    lastActive: String(s?.lastActive || '최근 접속'),
    roundHistory: Array.isArray(s?.roundHistory)
      ? s.roundHistory
      : (s?.roundHistory && typeof s?.roundHistory === 'object' ? Object.values(s.roundHistory) : undefined),
    balanceVersion: typeof s?.balanceVersion === 'number' ? s.balanceVersion : 0,
    updatedAtMs: typeof s?.updatedAtMs === 'number' ? s.updatedAtMs : undefined
  };
}

/**
 * Monotonic merge guard: protects newer committed balance versions against stale snapshots
 * while preserving legitimate non-balance profile edits (PIN/coupon confirmations).
 */
function mergeStudentKeepingNewerBalance(existing: Student | undefined, incomingRaw: Student): Student {
  const incoming = sanitizeStudent(incomingRaw);
  if (!existing) return incoming;

  const existingVer = existing.balanceVersion || 0;
  const incomingVer = incoming.balanceVersion || 0;
  const existingHistLen = existing.roundHistory?.length || 0;
  const incomingHistLen = incoming.roundHistory?.length || 0;

  // Keep existing financial balances if incoming version is strictly older and doesn't introduce new round history
  if (incomingVer < existingVer && incomingHistLen <= existingHistLen) {
    return {
      ...incoming,
      cash: toSafeInt(existing.cash),
      savings: toSafeInt(existing.savings),
      debt: toSafeInt(existing.debt),
      stockShares: sanitizeStockSharesMap(existing.stockShares),
      roundHistory: existing.roundHistory,
      balanceVersion: existingVer,
      updatedAtMs: existing.updatedAtMs
    };
  }
  return incoming;
}

export const ClassEconomyProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const initialUrlClassCode = useMemo(() => {
    if (typeof window === 'undefined') return '';
    try {
      const params = new URLSearchParams(window.location.search);
      const raw = params.get('class') || params.get('code') || '';
      return normalizeClassCode(raw);
    } catch {
      return '';
    }
  }, []);

  const [state, setState] = useState<ClassEconomyState>(() => {
    localStorage.removeItem('kidsrich_school_state');
    const urlParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
    const urlCode = urlParams ? normalizeClassCode(urlParams.get('class') || urlParams.get('code') || '') : '';
    const savedRole = (sessionStorage.getItem('kidsrich_auth_role') || localStorage.getItem('kidsrich_auth_role')) as UserRole;

    const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.stocks && !Array.isArray(parsed.stocks)) {
          parsed.stocks = Object.values(parsed.stocks);
        }
        if (!parsed.currencyUnit) parsed.currencyUnit = '원';
        if (!parsed.language) parsed.language = 'ko';
        if (!parsed.newsArticles || !Array.isArray(parsed.newsArticles) || parsed.newsArticles.length === 0) {
          parsed.newsArticles = initialNewsArticles;
        }
        if (!Array.isArray(parsed.scheduledScenarios)) {
          parsed.scheduledScenarios = [];
        }
        if (parsed.students && Array.isArray(parsed.students)) {
          const { unique } = deduplicateStudents(parsed.students.map(sanitizeStudent));
          parsed.students = unique;
        }
        if (urlCode && (!savedRole || savedRole === 'guest')) {
          parsed.classCode = urlCode;
        }
        return parsed;
      } catch (e) {
        console.error('Failed to parse saved state', e);
      }
    }
    return {
      ...initialClassState,
      classCode: urlCode || initialClassState.classCode,
      scheduledScenarios: []
    };
  });

  const [previousStateBackup, setPreviousStateBackup] = useState<ClassEconomyState | null>(null);
  const [role, setRole] = useState<UserRole>(() => {
    const savedRole = (sessionStorage.getItem('kidsrich_auth_role') || localStorage.getItem('kidsrich_auth_role')) as UserRole;
    return savedRole || 'guest';
  });
  const [currentStudentId, setCurrentStudentId] = useState<string>(() => {
    return sessionStorage.getItem('kidsrich_auth_student_id') || localStorage.getItem('kidsrich_auth_student_id') || '';
  });
  const [currentTeacher, setCurrentTeacher] = useState<TeacherAccount | null>(() => {
    const savedTeacher = sessionStorage.getItem('kidsrich_auth_teacher') || localStorage.getItem('kidsrich_auth_teacher');
    if (savedTeacher) {
      try {
        return JSON.parse(savedTeacher);
      } catch (e) {
        return null;
      }
    }
    return null;
  });
  const [isSuperAdminSession, setIsSuperAdminSession] = useState<boolean>(() => {
    try {
      return (
        sessionStorage.getItem('kidsrich_super_admin_session') === 'true' ||
        sessionStorage.getItem('kidsrich_auth_role') === 'super_admin' ||
        localStorage.getItem('kidsrich_auth_role') === 'super_admin'
      );
    } catch {
      return false;
    }
  });
  const [isCloudConnected, setIsCloudConnected] = useState<boolean>(true);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(new Date());
  const [lastFineRewardSummary, setLastFineRewardSummary] = useState<FineRewardResultSummary | null>(null);
  const [lastActionError, setLastActionError] = useState<string | null>(null);
  const clearLastActionError = () => setLastActionError(null);

  const inFlightStudentTxRef = useRef<Set<string>>(new Set());
  const schedulerLockRef = useRef<boolean>(false);

  const stateRef = useRef(state);
  stateRef.current = state;

  const refreshClassData = async (forceFullRoster?: boolean): Promise<boolean> => {
    const classCode = stateRef.current.classCode;
    if (!classCode) return false;
    setIsSyncing(true);
    try {
      // Lightweight Student Mode: If a student is logged in and not explicitly requesting full leaderboard ranking,
      // only fetch 2 documents (class settings + their own student record). Saves 93% server reads & eliminates quota bottlenecks!
      if (role === 'student' && currentStudentId && !forceFullRoster) {
        const [remoteClass, singleStudent] = await Promise.all([
          getClassFromFirestore(classCode),
          getSingleStudentFromFirestore(classCode, currentStudentId)
        ]);

        setState(prev => {
          let updatedStudents = [...prev.students];
          if (singleStudent) {
            const idx = updatedStudents.findIndex(s => s.id === singleStudent.id);
            if (idx !== -1) {
              updatedStudents[idx] = mergeStudentKeepingNewerBalance(updatedStudents[idx], singleStudent);
            } else {
              updatedStudents.push(sanitizeStudent(singleStudent));
            }
          }

          const newState: ClassEconomyState = {
            ...prev,
            className: remoteClass?.className ?? prev.className,
            teacherName: remoteClass?.teacherName ?? prev.teacherName,
            teacherEmail: remoteClass?.teacherEmail ?? prev.teacherEmail,
            currencyUnit: remoteClass?.currencyUnit ?? prev.currencyUnit,
            language: remoteClass?.language ?? prev.language,
            currentRound: remoteClass?.currentRound ?? prev.currentRound,
            totalRounds: remoteClass?.totalRounds ?? prev.totalRounds,
            isTradingFrozen: remoteClass?.isTradingFrozen ?? prev.isTradingFrozen,
            isLeaderboardPublic: remoteClass?.isLeaderboardPublic !== undefined ? remoteClass.isLeaderboardPublic : (prev.isLeaderboardPublic !== undefined ? prev.isLeaderboardPublic : true),
            depositInterestRate: remoteClass?.depositInterestRate ?? prev.depositInterestRate,
            newsMessage: remoteClass?.newsMessage ?? prev.newsMessage,
            newsArticles: remoteClass?.newsArticles && remoteClass.newsArticles.length > 0 ? remoteClass.newsArticles : (prev.newsArticles || initialNewsArticles),
            scheduledScenarios: Array.isArray(remoteClass?.scheduledScenarios) ? remoteClass!.scheduledScenarios : (prev.scheduledScenarios || []),
            stocks: remoteClass?.stocks && remoteClass.stocks.length > 0 ? remoteClass.stocks : prev.stocks,
            shopItems: remoteClass?.shopItems && remoteClass.shopItems.length > 0 ? remoteClass.shopItems : prev.shopItems,
            students: updatedStudents,
            transactions: prev.transactions
          };
          try {
            localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(newState));
          } catch (e) {
            console.warn('LocalStorage save error:', e);
          }
          return newState;
        });

        setLastSyncedAt(new Date());
        setIsCloudConnected(true);
        return true;
      }

      // Teacher Mode or Full Leaderboard Refresh:
      const [remoteClass, remoteStudents] = await Promise.all([
        getClassFromFirestore(classCode),
        getStudentsFromFirestore(classCode)
      ]);

      setState(prev => {
        const existingMap = new Map<string, Student>(prev.students.map(s => [s.id, s]));
        const rawNextStudents = Array.isArray(remoteStudents) && remoteStudents.length > 0
          ? remoteStudents.map(rs => mergeStudentKeepingNewerBalance(existingMap.get(rs.id), rs))
          : prev.students;

        // Deduplicate students (cleans up any duplicate entries)
        const { unique: dedupedStudents, duplicateIds } = deduplicateStudents(rawNextStudents);

        if (duplicateIds.length > 0 && classCode) {
          console.info(`[KidsRich] Found ${duplicateIds.length} duplicate student documents during refresh. Removing...`);
          deleteMultipleStudentsFromFirestore(classCode, duplicateIds).catch(err => {
            console.warn('Background cleanup of duplicate students in refresh failed:', err);
          });
        }

        const newState: ClassEconomyState = {
          ...prev,
          className: remoteClass?.className ?? prev.className,
          teacherName: remoteClass?.teacherName ?? prev.teacherName,
          teacherEmail: remoteClass?.teacherEmail ?? prev.teacherEmail,
          currencyUnit: remoteClass?.currencyUnit ?? prev.currencyUnit,
          language: remoteClass?.language ?? prev.language,
          currentRound: remoteClass?.currentRound ?? prev.currentRound,
          totalRounds: remoteClass?.totalRounds ?? prev.totalRounds,
          isTradingFrozen: remoteClass?.isTradingFrozen ?? prev.isTradingFrozen,
          isLeaderboardPublic: remoteClass?.isLeaderboardPublic !== undefined ? remoteClass.isLeaderboardPublic : (prev.isLeaderboardPublic !== undefined ? prev.isLeaderboardPublic : true),
          depositInterestRate: remoteClass?.depositInterestRate ?? prev.depositInterestRate,
          newsMessage: remoteClass?.newsMessage ?? prev.newsMessage,
          newsArticles: remoteClass?.newsArticles && remoteClass.newsArticles.length > 0 ? remoteClass.newsArticles : (prev.newsArticles || initialNewsArticles),
          scheduledScenarios: Array.isArray(remoteClass?.scheduledScenarios) ? remoteClass!.scheduledScenarios : (prev.scheduledScenarios || []),
          stocks: remoteClass?.stocks && remoteClass.stocks.length > 0 ? remoteClass.stocks : prev.stocks,
          shopItems: remoteClass?.shopItems && remoteClass.shopItems.length > 0 ? remoteClass.shopItems : prev.shopItems,
          students: dedupedStudents,
          // Plan A: Transactions are safely maintained in local storage (0 Firestore read quota)
          transactions: prev.transactions
        };
        try {
          localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(newState));
        } catch (e) {
          console.warn('LocalStorage save error:', e);
        }
        return newState;
      });
      setLastSyncedAt(new Date());
      setIsCloudConnected(true);
      return true;
    } catch (err) {
      console.warn('Manual refresh error:', err);
      return false;
    } finally {
      setIsSyncing(false);
    }
  };

  // Persistent authentication across both sessionStorage and localStorage
  useEffect(() => {
    sessionStorage.setItem('kidsrich_auth_role', role);
    localStorage.setItem('kidsrich_auth_role', role);

    if (currentStudentId) {
      sessionStorage.setItem('kidsrich_auth_student_id', currentStudentId);
      localStorage.setItem('kidsrich_auth_student_id', currentStudentId);
    } else {
      sessionStorage.removeItem('kidsrich_auth_student_id');
      localStorage.removeItem('kidsrich_auth_student_id');
    }

    if (currentTeacher) {
      const teacherStr = JSON.stringify(currentTeacher);
      sessionStorage.setItem('kidsrich_auth_teacher', teacherStr);
      localStorage.setItem('kidsrich_auth_teacher', teacherStr);
    } else {
      sessionStorage.removeItem('kidsrich_auth_teacher');
      localStorage.removeItem('kidsrich_auth_teacher');
    }
  }, [role, currentStudentId, currentTeacher]);

  // Return all detected saved teacher accounts on this device for one-click recovery
  const getSavedTeacherAccounts = (): TeacherAccount[] => {
    const list: TeacherAccount[] = [];
    const seen = new Set<string>();

    const addAccount = (acc: any) => {
      if (!acc) return;
      const key = `${acc.email || ''}_${acc.teacherId || ''}_${acc.classCode || ''}`.toLowerCase();
      if (seen.has(key)) return;
      seen.add(key);
      list.push({
        teacherId: acc.teacherId || (acc.email ? acc.email.replace(/[@.]/g, '_') : 'teacher_main'),
        name: acc.name || '담당 선생님',
        email: acc.email || 'teacher@school.kr',
        password: acc.password || '',
        schoolName: acc.schoolName || '',
        grade: acc.grade || '',
        classNum: acc.classNum || '',
        classCode: acc.classCode || state.classCode || 'C-10001',
        className: acc.className || state.className || '우리반',
        createdAt: acc.createdAt || new Date().toISOString()
      });
    };

    // 1. Check local registered teachers
    try {
      const savedTeachersStr = localStorage.getItem('kidsrich_teachers');
      if (savedTeachersStr) {
        const parsed = JSON.parse(savedTeachersStr);
        if (Array.isArray(parsed)) {
          parsed.forEach(addAccount);
        }
      }
    } catch (e) {}

    // 2. Check current/last auth teacher
    try {
      const authStr = localStorage.getItem('kidsrich_auth_teacher') || sessionStorage.getItem('kidsrich_auth_teacher');
      if (authStr) {
        addAccount(JSON.parse(authStr));
      }
    } catch (e) {}

    // 3. Check current state teacher info
    if (state.teacherName || state.teacherEmail) {
      addAccount({
        teacherId: (state.teacherEmail || 'teacher').replace(/[@.]/g, '_'),
        name: state.teacherName || '담당 선생님',
        email: state.teacherEmail || 'teacher@school.kr',
        classCode: state.classCode || 'C-10001',
        className: state.className || '우리반'
      });
    }

    // 4. Default fallback teacher account if list is empty
    if (list.length === 0) {
      addAccount({
        teacherId: 'teacher_main',
        name: '선생님',
        email: 'teacher@school.kr',
        classCode: state.classCode || 'C-10001',
        className: state.className || '우리반'
      });
    }

    return list;
  };

  // Instant one-click teacher login with strict class isolation
  const quickLoginTeacher = async (teacher: TeacherAccount) => {
    const targetCode = normalizeClassCode(teacher.classCode) || stateRef.current.classCode || 'C-10001';
    const switchedClass = normalizeClassCode(stateRef.current.classCode) !== targetCode;

    setCurrentTeacher(teacher);
    sessionStorage.setItem('kidsrich_auth_teacher', JSON.stringify(teacher));
    localStorage.setItem('kidsrich_auth_teacher', JSON.stringify(teacher));
    sessionStorage.setItem('kidsrich_auth_role', 'teacher');
    localStorage.setItem('kidsrich_auth_role', 'teacher');

    // Fetch isolated remote data for this teacher's classCode before/while switching
    let remoteClass: Partial<ClassEconomyState> | null = null;
    let remoteStudents: Student[] | null = null;
    try {
      [remoteClass, remoteStudents] = await Promise.all([
        getClassFromFirestore(targetCode),
        getStudentsFromFirestore(targetCode)
      ]);
    } catch (e) {
      console.warn('quickLoginTeacher remote fetch warning:', e);
    }

    setState(prev => {
      const base = switchedClass
        ? {
            ...initialClassState,
            students: [],
            transactions: [],
            scheduledScenarios: []
          }
        : prev;

      const resolvedStudents = (remoteStudents && remoteStudents.length > 0)
        ? deduplicateStudents(remoteStudents.map(sanitizeStudent)).unique
        : (switchedClass ? [] : prev.students);

      const newState: ClassEconomyState = {
        ...base,
        classCode: targetCode,
        className: remoteClass?.className ?? teacher.className ?? base.className,
        teacherName: remoteClass?.teacherName ?? teacher.name ?? base.teacherName,
        teacherEmail: remoteClass?.teacherEmail ?? teacher.email ?? base.teacherEmail,
        currencyUnit: remoteClass?.currencyUnit ?? base.currencyUnit,
        language: remoteClass?.language ?? base.language,
        currentRound: remoteClass?.currentRound ?? base.currentRound,
        totalRounds: remoteClass?.totalRounds ?? base.totalRounds,
        isTradingFrozen: remoteClass?.isTradingFrozen ?? base.isTradingFrozen,
        isLeaderboardPublic: remoteClass?.isLeaderboardPublic !== undefined ? remoteClass.isLeaderboardPublic : base.isLeaderboardPublic,
        depositInterestRate: remoteClass?.depositInterestRate ?? base.depositInterestRate,
        newsMessage: remoteClass?.newsMessage ?? base.newsMessage,
        newsArticles: (remoteClass?.newsArticles && remoteClass.newsArticles.length > 0) ? remoteClass.newsArticles : base.newsArticles,
        scheduledScenarios: Array.isArray(remoteClass?.scheduledScenarios) ? remoteClass!.scheduledScenarios : (base.scheduledScenarios || []),
        stocks: (remoteClass?.stocks && remoteClass.stocks.length > 0) ? remoteClass.stocks : base.stocks,
        shopItems: (remoteClass?.shopItems && remoteClass.shopItems.length > 0) ? remoteClass.shopItems : base.shopItems,
        students: resolvedStudents,
        transactions: switchedClass ? [] : prev.transactions
      };
      try {
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(newState));
        if (resolvedStudents.length > 0) {
          localStorage.setItem('kidsrich_students_' + targetCode, JSON.stringify(resolvedStudents));
        }
      } catch (e) {}
      return newState;
    });
    setRole('teacher');
  };

  // Instant one-click student login
  const quickLoginStudent = async (studentId: string, targetClassCode?: string) => {
    const effectiveCode = normalizeClassCode(targetClassCode) || normalizeClassCode(state.classCode) || 'C-10001';
    let candidateList = await getAvailableStudentsForClass(effectiveCode);
    let matched = candidateList.find(s => s.id === studentId || String(s.number) === studentId);
    if (!matched) {
      matched = candidateList[0] || initialStudents[0];
    }
    const safeMatched = sanitizeStudent(matched);
    setCurrentStudentId(safeMatched.id);
    sessionStorage.setItem('kidsrich_auth_student_id', safeMatched.id);
    localStorage.setItem('kidsrich_auth_student_id', safeMatched.id);
    sessionStorage.setItem('kidsrich_auth_student_account', JSON.stringify(safeMatched));
    localStorage.setItem('kidsrich_auth_student_account', JSON.stringify(safeMatched));
    sessionStorage.setItem('kidsrich_auth_role', 'student');
    localStorage.setItem('kidsrich_auth_role', 'student');
    setRole('student');
  };

  const SUPER_ADMIN_EMAIL = 'skyhwg0516@gmail.com';
  const SUPER_ADMIN_PASSWORD = 'dnjsrb0516!!@';

  const loginSuperAdmin = async (email: string, password: string): Promise<{ success: boolean; message?: string }> => {
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !password) {
      return { success: false, message: '통합 관리자 아이디(이메일)와 비밀번호를 모두 입력해 주세요.' };
    }
    if (cleanEmail !== SUPER_ADMIN_EMAIL || password !== SUPER_ADMIN_PASSWORD) {
      return { success: false, message: '통합 관리자 아이디 또는 비밀번호가 일치하지 않습니다.' };
    }
    setIsSuperAdminSession(true);
    try {
      sessionStorage.setItem('kidsrich_super_admin_session', 'true');
      sessionStorage.setItem('kidsrich_auth_role', 'super_admin');
      localStorage.setItem('kidsrich_auth_role', 'super_admin');
    } catch (e) {}
    setRole('super_admin');
    return { success: true };
  };

  const impersonateClassAsTeacher = async (target: {
    classCode: string;
    className?: string;
    name?: string;
    email?: string;
    teacherId?: string;
    schoolName?: string;
    grade?: string;
    classNum?: string;
    password?: string;
    createdAt?: string;
  }) => {
    setIsSuperAdminSession(true);
    try {
      sessionStorage.setItem('kidsrich_super_admin_session', 'true');
    } catch (e) {}
    const teacherObj: TeacherAccount = {
      teacherId: target.teacherId || (target.email || `admin_${target.classCode}`).replace(/[@.]/g, '_'),
      name: target.name || '선생님',
      email: target.email || 'teacher@school.kr',
      schoolName: target.schoolName || '',
      grade: target.grade || '',
      classNum: target.classNum || '',
      password: target.password || '',
      classCode: normalizeClassCode(target.classCode) || 'C-10001',
      className: target.className || '우리반',
      createdAt: target.createdAt || new Date().toISOString()
    };
    await quickLoginTeacher(teacherObj);
  };

  const returnToSuperAdmin = () => {
    if (!isSuperAdminSession && sessionStorage.getItem('kidsrich_super_admin_session') !== 'true') return;
    setIsSuperAdminSession(true);
    try {
      sessionStorage.setItem('kidsrich_auth_role', 'super_admin');
      localStorage.setItem('kidsrich_auth_role', 'super_admin');
    } catch (e) {}
    setRole('super_admin');
  };

  const loginTeacher = async (emailOrId: string, password?: string): Promise<{ success: boolean; message?: string }> => {
    if (!emailOrId.trim()) {
      return { success: false, message: '교사 아이디, 이메일, 성함 또는 학급 코드를 입력해 주세요.' };
    }
    const cleanId = emailOrId.trim();
    const lowerCleanId = cleanId.toLowerCase();

    // Super Admin fast login if using Super Admin credentials
    if (lowerCleanId === SUPER_ADMIN_EMAIL) {
      if (password === SUPER_ADMIN_PASSWORD) {
        return await loginSuperAdmin(cleanId, password);
      }
      return { success: false, message: '통합 관리자 비밀번호가 일치하지 않습니다.' };
    }

    // 1. Check cloud firestore first (if quota allows)
    let teacherDoc: TeacherAccount | null = null;
    try {
      teacherDoc = await getTeacherFromFirestore(cleanId);
      if (!teacherDoc && cleanId !== lowerCleanId) {
        teacherDoc = await getTeacherFromFirestore(lowerCleanId);
      }
    } catch (e) {
      console.warn('Firestore getTeacher error:', e);
    }

    if (teacherDoc) {
      if (password && teacherDoc.password && teacherDoc.password !== password) {
        return { success: false, message: '비밀번호가 일치하지 않습니다. [비밀번호 찾기]를 이용해 주세요.' };
      }
      await quickLoginTeacher(teacherDoc);
      return { success: true };
    }

    // 2. Check local registered teachers
    const savedTeachersStr = localStorage.getItem('kidsrich_teachers');
    const localTeachers: TeacherAccount[] = savedTeachersStr ? JSON.parse(savedTeachersStr) : [];
    
    let localTeacher = localTeachers.find(t => 
      (t.email && t.email.toLowerCase() === lowerCleanId) ||
      (t.teacherId && t.teacherId.toLowerCase() === lowerCleanId) ||
      (t.name && t.name.trim().toLowerCase() === lowerCleanId) ||
      (t.classCode && t.classCode.toLowerCase() === lowerCleanId) ||
      (t.name && lowerCleanId.includes(t.name.trim().toLowerCase()))
    );

    // 3. Fallback to state teacher info (e.g. from kids_economy_v1)
    if (!localTeacher && (
      (state.teacherEmail && state.teacherEmail.toLowerCase() === lowerCleanId) ||
      (state.teacherName && state.teacherName.toLowerCase() === lowerCleanId) ||
      (state.classCode && state.classCode.toLowerCase() === lowerCleanId) ||
      lowerCleanId === 'admin' ||
      lowerCleanId === 'teacher' ||
      lowerCleanId === '선생님' ||
      lowerCleanId === '교사'
    )) {
      localTeacher = {
        teacherId: (state.teacherEmail || 'teacher').replace(/[@.]/g, '_'),
        name: state.teacherName || '선생님',
        email: state.teacherEmail || 'teacher@school.kr',
        className: state.className || '우리반',
        classCode: state.classCode || 'C-10001',
        schoolName: '',
        grade: '',
        classNum: '',
        password: password || '',
        createdAt: new Date().toISOString()
      };
      localTeachers.push(localTeacher);
      try {
        localStorage.setItem('kidsrich_teachers', JSON.stringify(localTeachers));
      } catch (e) {}
    }

    // 4. If single teacher exists on this device and user typed something close
    if (!localTeacher && localTeachers.length === 1) {
      const onlyTeacher = localTeachers[0];
      if (!password || !onlyTeacher.password || onlyTeacher.password === password) {
        localTeacher = onlyTeacher;
      }
    }

    if (localTeacher) {
      if (password && localTeacher.password && localTeacher.password !== password) {
        return { success: false, message: '비밀번호가 일치하지 않습니다. [비밀번호 찾기]를 이용해 주세요.' };
      }
      await quickLoginTeacher(localTeacher);
      return { success: true };
    }

    return { 
      success: false, 
      message: '등록된 교사 계정을 찾을 수 없습니다. 아이디, 성함 또는 학급 코드를 확인하시거나 아래 [내 계정 찾기]를 확인해 주세요.' 
    };
  };

  const updateTeacherProfile = async (profile: {
    name: string;
    email?: string;
    schoolName?: string;
    grade?: string;
    classNum?: string;
    password?: string;
  }): Promise<{ success: boolean; message?: string }> => {
    if (!profile.name.trim()) {
      return { success: false, message: '선생님 성함은 필수 입력 항목입니다.' };
    }
    const cleanName = profile.name.trim();
    const cleanEmail = profile.email?.trim() || currentTeacher?.email || state.teacherEmail || '';

    const updatedTeacher: TeacherAccount = {
      teacherId: currentTeacher?.teacherId || cleanEmail.replace(/[@.]/g, '_') || 'teacher_main',
      name: cleanName,
      email: cleanEmail,
      schoolName: profile.schoolName !== undefined ? profile.schoolName.trim() : currentTeacher?.schoolName,
      grade: profile.grade !== undefined ? profile.grade.trim() : currentTeacher?.grade,
      classNum: profile.classNum !== undefined ? profile.classNum.trim() : currentTeacher?.classNum,
      password: profile.password !== undefined ? profile.password : currentTeacher?.password,
      classCode: currentTeacher?.classCode || state.classCode,
      className: currentTeacher?.className || state.className,
      createdAt: currentTeacher?.createdAt || new Date().toISOString()
    };

    setCurrentTeacher(updatedTeacher);
    sessionStorage.setItem('kidsrich_auth_teacher', JSON.stringify(updatedTeacher));

    // Save to Firestore teachers collection
    await saveTeacherToFirestore(updatedTeacher);

    // Save to local teachers
    const savedTeachersStr = localStorage.getItem('kidsrich_teachers');
    const localTeachers: TeacherAccount[] = savedTeachersStr ? JSON.parse(savedTeachersStr) : [];
    const idx = localTeachers.findIndex(t => t.teacherId === updatedTeacher.teacherId || t.email === cleanEmail);
    if (idx >= 0) {
      localTeachers[idx] = updatedTeacher;
    } else {
      localTeachers.push(updatedTeacher);
    }
    localStorage.setItem('kidsrich_teachers', JSON.stringify(localTeachers));

    // Update state and class in Firestore
    setState(prev => {
      const newState: ClassEconomyState = {
        ...prev,
        teacherName: cleanName,
        teacherEmail: cleanEmail
      };
      syncClassToFirestore(newState);
      return newState;
    });

    return { success: true };
  };

  const signupTeacher = async (
    name: string,
    email: string,
    password?: string,
    className?: string,
    classCode?: string,
    schoolName?: string,
    grade?: string,
    classNum?: string
  ): Promise<{ success: boolean; message?: string }> => {
    if (!name.trim() || !email.trim()) {
      return { success: false, message: '성함과 이메일은 필수 입력 항목입니다.' };
    }
    const cleanEmail = email.trim();
    const existing = await getTeacherFromFirestore(cleanEmail);
    if (existing) {
      return { success: false, message: '이미 등록된 이메일/아이디입니다. 로그인해 주세요.' };
    }

    // Ensure unique classCode so another teacher's class data cannot be overwritten or leaked
    let assignedCode = normalizeClassCode(classCode);
    const hasCustomCode = Boolean(assignedCode);
    if (!assignedCode) {
      assignedCode = `C-${Math.floor(10000 + Math.random() * 90000)}`;
    }

    try {
      const taken = await isClassCodeTakenInFirestore(assignedCode);
      if (taken) {
        if (hasCustomCode) {
          return {
            success: false,
            message: `학급 코드 [${assignedCode}]는 이미 다른 선생님께서 사용 중입니다. [새 코드 생성]을 누르거나 다른 코드를 입력해 주세요.`
          };
        }
        // Regenerate random code until unique
        for (let attempt = 0; attempt < 5; attempt++) {
          const candidate = `C-${Math.floor(10000 + Math.random() * 90000)}`;
          const candidateTaken = await isClassCodeTakenInFirestore(candidate);
          if (!candidateTaken) {
            assignedCode = candidate;
            break;
          }
        }
      }
    } catch (e) {
      console.warn('Class code uniqueness check skipped:', e);
    }

    const assignedClassName = className?.trim() || '우리반';

    const newTeacher: TeacherAccount = {
      teacherId: cleanEmail.replace(/[@.]/g, '_'),
      name: name.trim(),
      email: cleanEmail,
      password: password || '',
      schoolName: schoolName?.trim() || '',
      grade: grade?.trim() || '',
      classNum: classNum?.trim() || '',
      classCode: assignedCode,
      className: assignedClassName,
      createdAt: new Date().toISOString()
    };

    // Save to Firestore & LocalStorage
    await saveTeacherToFirestore(newTeacher);
    const savedTeachersStr = localStorage.getItem('kidsrich_teachers');
    const localTeachers: TeacherAccount[] = savedTeachersStr ? JSON.parse(savedTeachersStr) : [];
    localTeachers.push(newTeacher);
    localStorage.setItem('kidsrich_teachers', JSON.stringify(localTeachers));

    // Seed clean initial students for the brand-new isolated class
    const safePrefix = assignedCode.replace(/[^a-zA-Z0-9]/g, '_');
    const initialSeedStudents: Student[] = initialStudents.map((s, idx) => sanitizeStudent({
      ...s,
      id: `student_${safePrefix}_${idx + 1}`,
      number: idx + 1,
      name: s.name,
      username: s.username,
      pin: '1234',
      cash: 30000,
      savings: 0,
      debt: 0,
      stockShares: {},
      couponsOwned: [],
      roundHistory: [],
      balanceVersion: 1,
      updatedAtMs: Date.now()
    }));

    try {
      localStorage.setItem('kidsrich_students_' + assignedCode, JSON.stringify(initialSeedStudents));
    } catch (e) {}
    saveMultipleStudentsToFirestore(assignedCode, initialSeedStudents).catch(console.warn);

    // Initialize strictly isolated class state from initialClassState (never inherit previous teacher's rounds/transactions)
    const freshIsolatedState: ClassEconomyState = {
      ...initialClassState,
      classCode: assignedCode,
      className: assignedClassName,
      teacherName: name.trim(),
      teacherEmail: cleanEmail,
      currentRound: 1,
      scheduledScenarios: [],
      transactions: [],
      students: initialSeedStudents,
      undoAvailableUntil: null
    };

    try {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(freshIsolatedState));
    } catch (e) {}
    syncClassToFirestore(freshIsolatedState).catch(console.warn);
    setState(freshIsolatedState);

    setCurrentTeacher(newTeacher);
    setRole('teacher');
    return { success: true };
  };

  const verifyTeacherForPasswordReset = async (
    teacherIdOrEmail: string,
    schoolName: string,
    grade: string,
    classNum: string
  ): Promise<{ success: boolean; teacher?: TeacherAccount; message?: string }> => {
    if (!teacherIdOrEmail.trim()) {
      return { success: false, message: '선생님 아이디 또는 이메일을 입력해주세요.' };
    }
    if (!schoolName.trim()) {
      return { success: false, message: '소속 학교명을 입력해주세요.' };
    }
    if (!grade.trim()) {
      return { success: false, message: '학년을 입력해주세요.' };
    }
    if (!classNum.trim()) {
      return { success: false, message: '반을 입력해주세요.' };
    }

    const cleanId = teacherIdOrEmail.trim();
    // 1. Fetch from Firestore
    let teacher: TeacherAccount | null = await getTeacherFromFirestore(cleanId);

    // 2. If not found in Firestore, check LocalStorage
    if (!teacher) {
      const savedTeachersStr = localStorage.getItem('kidsrich_teachers');
      const localTeachers: TeacherAccount[] = savedTeachersStr ? JSON.parse(savedTeachersStr) : [];
      teacher = localTeachers.find(t =>
        (t.email && t.email.toLowerCase() === cleanId.toLowerCase()) ||
        (t.teacherId && t.teacherId.toLowerCase() === cleanId.toLowerCase())
      ) || null;
    }

    if (!teacher) {
      return { success: false, message: '일치하는 교사 아이디(또는 이메일)를 찾을 수 없습니다.' };
    }

    // 3. Verification check:
    // 3-1. School Name check (flexible match: ignore spaces and common suffixes)
    const normInputSchool = schoolName.replace(/\s+/g, '').replace(/(초등학교|초등|학교|초)$/, '').toLowerCase();
    const normSavedSchool = (teacher.schoolName || '').replace(/\s+/g, '').replace(/(초등학교|초등|학교|초)$/, '').toLowerCase();

    // If teacher hasn't set schoolName yet or input matches
    const schoolMatched = !normSavedSchool ||
      normSavedSchool === normInputSchool ||
      normSavedSchool.includes(normInputSchool) ||
      normInputSchool.includes(normSavedSchool);

    if (!schoolMatched) {
      return { success: false, message: '등록된 소속 학교 정보와 일치하지 않습니다.' };
    }

    // 3-2. Grade check (numeric match, falls back to className e.g. "6학년 1반")
    const normInputGrade = grade.replace(/[^0-9]/g, '');
    const normSavedGrade = (teacher.grade || '').replace(/[^0-9]/g, '') ||
      ((teacher.className || '').match(/(\d+)\s*학년/)?.[1] || '');

    if (normSavedGrade && normInputGrade && normSavedGrade !== normInputGrade) {
      return { success: false, message: '등록된 담당 학년 정보와 일치하지 않습니다.' };
    }

    // 3-3. Class number check (numeric match, falls back to className e.g. "6학년 1반")
    const normInputClass = classNum.replace(/[^0-9]/g, '');
    const normSavedClass = (teacher.classNum || '').replace(/[^0-9]/g, '') ||
      ((teacher.className || '').match(/(\d+)\s*반/)?.[1] || '');

    if (normSavedClass && normInputClass && normSavedClass !== normInputClass) {
      return { success: false, message: '등록된 담당 반 정보와 일치하지 않습니다.' };
    }

    return {
      success: true,
      teacher: teacher,
      message: '교사 본인 확인이 성공적으로 완료되었습니다.'
    };
  };

  const resetTeacherPassword = async (
    teacherIdOrEmail: string,
    newPassword: string
  ): Promise<{ success: boolean; message?: string }> => {
    if (!teacherIdOrEmail.trim()) {
      return { success: false, message: '교사 아이디 정보가 누락되었습니다.' };
    }
    if (!newPassword.trim()) {
      return { success: false, message: '새로 설정할 비밀번호를 입력해주세요.' };
    }

    const cleanId = teacherIdOrEmail.trim();
    const cleanPass = newPassword.trim();

    // 1. Update in Firestore
    await updateTeacherPasswordInFirestore(cleanId, cleanPass);

    // 2. Update in LocalStorage
    const savedTeachersStr = localStorage.getItem('kidsrich_teachers');
    const localTeachers: TeacherAccount[] = savedTeachersStr ? JSON.parse(savedTeachersStr) : [];
    const idx = localTeachers.findIndex(t =>
      (t.email && t.email.toLowerCase() === cleanId.toLowerCase()) ||
      (t.teacherId && t.teacherId.toLowerCase() === cleanId.toLowerCase())
    );

    if (idx >= 0) {
      localTeachers[idx].password = cleanPass;
      localStorage.setItem('kidsrich_teachers', JSON.stringify(localTeachers));
    }

    // 3. Update currentTeacher if active
    if (currentTeacher && (
      (currentTeacher.email && currentTeacher.email.toLowerCase() === cleanId.toLowerCase()) ||
      (currentTeacher.teacherId && currentTeacher.teacherId.toLowerCase() === cleanId.toLowerCase())
    )) {
      const updated = { ...currentTeacher, password: cleanPass };
      setCurrentTeacher(updated);
      sessionStorage.setItem('kidsrich_auth_teacher', JSON.stringify(updated));
    }

    return {
      success: true,
      message: '비밀번호가 성공적으로 변경되었습니다. 새 비밀번호로 로그인해 주세요.'
    };
  };

  // Helper to get all students for a class with multi-tier storage fallback
  const getAvailableStudentsForClass = async (targetClassCode?: string): Promise<Student[]> => {
    const inputClassCode = normalizeClassCode(targetClassCode);
    const effectiveClassCode = inputClassCode || normalizeClassCode(state.classCode) || 'C-10001';

    let candidateList: Student[] = [];

    // Tier 1: Live Firestore (only if quota is not exceeded)
    try {
      const remoteStudents = await getStudentsFromFirestore(effectiveClassCode);
      if (remoteStudents && Array.isArray(remoteStudents) && remoteStudents.length > 0) {
        candidateList = deduplicateStudents(remoteStudents.map(sanitizeStudent)).unique;
        try {
          localStorage.setItem('kidsrich_students_' + effectiveClassCode, JSON.stringify(candidateList));
        } catch (e) {}
        return candidateList;
      }
    } catch (e) {
      console.warn('getStudentsFromFirestore error (falling back to local cache):', e);
    }

    // Tier 2: Class-specific LocalStorage cache
    try {
      const cached = localStorage.getItem('kidsrich_students_' + effectiveClassCode);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) {
          candidateList = deduplicateStudents(parsed.map(sanitizeStudent)).unique;
          return candidateList;
        }
      }
    } catch (e) {}

    // Tier 3: In-memory state if classCode matches or if state.students has records
    if (Array.isArray(state.students) && state.students.length > 0) {
      if (effectiveClassCode === normalizeClassCode(state.classCode) || effectiveClassCode === 'C-10001') {
        candidateList = deduplicateStudents(state.students.map(sanitizeStudent)).unique;
        try {
          localStorage.setItem('kidsrich_students_' + effectiveClassCode, JSON.stringify(candidateList));
        } catch (e) {}
        return candidateList;
      }
    }

    // Tier 4: Initial default students (30 students roster)
    if (initialStudents && initialStudents.length > 0) {
      candidateList = deduplicateStudents(initialStudents.map(s => sanitizeStudent({
        ...s,
        id: `student_${effectiveClassCode.replace(/[^a-zA-Z0-9]/g, '_')}_${s.number}`
      }))).unique;
      try {
        localStorage.setItem('kidsrich_students_' + effectiveClassCode, JSON.stringify(candidateList));
      } catch (e) {}
      // Do NOT trigger side-effect batch writes in read helper
      return candidateList;
    }

    return [];
  };

  const loginStudent = async (
    identifier: string,
    pin?: string,
    targetClassCode?: string
  ): Promise<{ success: boolean; message?: string }> => {
    const rawCleanId = normalizeFullWidthDigits(String(identifier || '')).trim();
    if (!rawCleanId) {
      return { success: false, message: '학생 이름 또는 번호를 입력해 주세요.' };
    }

    const inputClassCode = normalizeClassCode(targetClassCode);
    const effectiveClassCode = inputClassCode || normalizeClassCode(state.classCode) || 'C-10001';

    try {
      let candidateList = await getAvailableStudentsForClass(effectiveClassCode);

      let matchedRaw = matchStudentIdentifier(candidateList, rawCleanId);

      // Automatic numbered student fallback:
      // If student enters student number (e.g. 1 to 50, like '1', '01', '1번', '20번')
      // and this number is not yet in candidateList (e.g. offline mode, quota exceeded, or custom class size):
      const digitsOnly = rawCleanId.replace(/[^0-9]/g, '');
      const parsedNum = digitsOnly ? parseInt(digitsOnly, 10) : null;
      if (!matchedRaw && parsedNum !== null && !isNaN(parsedNum) && parsedNum >= 1 && parsedNum <= 50) {
        const numStr = String(parsedNum).padStart(2, '0');
        const autoStudent: Student = {
          id: `student_${effectiveClassCode.replace(/[^a-zA-Z0-9]/g, '_')}_${parsedNum}`,
          number: parsedNum,
          name: `${parsedNum}번 학생`,
          username: `student_${numStr}`,
          pin: '1234',
          cash: 30000,
          savings: 0,
          debt: 0,
          stockShares: {},
          couponsOwned: [],
          isPinChanged: false,
          isOnline: true,
          pinResetRequested: false,
          recentActivity: '학생 로그인 접속',
          lastActive: '방금 전'
        };
        matchedRaw = autoStudent;
        candidateList = [...candidateList, autoStudent];
      }

      if (!matchedRaw) {
        return {
          success: false,
          message: `'${rawCleanId}' 학생을 찾을 수 없습니다. 학생 번호(예: 1 또는 1번)나 선생님께서 등록하신 이름을 입력해 주세요. (학급 코드: ${effectiveClassCode})`
        };
      }

      const matched = sanitizeStudent(matchedRaw);

      // Expected PIN (default: 1234 if not set)
      const expectedPin = (matched.pin !== undefined && matched.pin !== null && String(matched.pin).trim() !== '')
        ? normalizeFullWidthDigits(String(matched.pin)).trim()
        : '1234';

      const inputPin = normalizeFullWidthDigits(String(pin || '')).trim();
      if (!inputPin) {
        return {
          success: false,
          message: '학생 비밀번호(PIN)를 입력해 주세요. (초기 비밀번호: 1234)'
        };
      }

      if (inputPin !== expectedPin) {
        return {
          success: false,
          message: '비밀번호(PIN)가 일치하지 않습니다. 다시 확인해 주세요. (초기 비밀번호: 1234)'
        };
      }

      // Update state with candidateList to ensure matched is ALWAYS present in state.students
      const baseList = (candidateList && candidateList.length > 0) ? candidateList : (state.students || []);
      const updatedStudents = baseList.map(s => {
        const safe = sanitizeStudent(s);
        return safe.id === matched.id ? matched : safe;
      });
      if (!updatedStudents.some(s => s.id === matched.id)) {
        updatedStudents.push(matched);
      }

      const newState: ClassEconomyState = {
        ...state,
        classCode: effectiveClassCode,
        students: updatedStudents
      };
      try {
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(newState));
        localStorage.setItem('kidsrich_students_' + effectiveClassCode, JSON.stringify(updatedStudents));
        sessionStorage.setItem('kidsrich_auth_student_account', JSON.stringify(matched));
        localStorage.setItem('kidsrich_auth_student_account', JSON.stringify(matched));
        localStorage.setItem('kidsrich_auth_student_id', matched.id);
        localStorage.setItem('kidsrich_auth_role', 'student');
      } catch (e) {}

      setState(newState);
      setCurrentStudentId(matched.id);
      sessionStorage.setItem('kidsrich_auth_student_id', matched.id);
      sessionStorage.setItem('kidsrich_auth_role', 'student');
      setRole('student');

      return { success: true };
    } catch (err: any) {
      console.error('loginStudent error:', err);
      return { success: false, message: err?.message || '학생 로그인 처리 중 오류가 발생했습니다. 이름과 비밀번호를 다시 확인해 주세요.' };
    }
  };

  const logout = () => {
    setRole('guest');
    setCurrentStudentId('');
    setCurrentTeacher(null);
    setIsSuperAdminSession(false);
    sessionStorage.removeItem('kidsrich_super_admin_session');
    sessionStorage.removeItem('kidsrich_auth_role');
    sessionStorage.removeItem('kidsrich_auth_student_id');
    sessionStorage.removeItem('kidsrich_auth_student_account');
    sessionStorage.removeItem('kidsrich_auth_teacher');
    localStorage.removeItem('kidsrich_auth_role');
    localStorage.removeItem('kidsrich_auth_student_id');
    localStorage.removeItem('kidsrich_auth_student_account');
    localStorage.removeItem('kidsrich_auth_teacher');
  };

  // Proactive deduplication on mount: automatically cleans up any duplicate students (e.g. 1~5 duplicates)
  useEffect(() => {
    if (state.students && state.students.length > 0) {
      const { unique, duplicateIds } = deduplicateStudents(state.students);
      if (duplicateIds.length > 0) {
        console.info(`[KidsRich] Found ${duplicateIds.length} duplicate student(s) on mount. Removing duplicates...`, duplicateIds);
        setState(prev => {
          const nextState = { ...prev, students: unique };
          try {
            localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(nextState));
          } catch (e) {}
          return nextState;
        });
        if (state.classCode) {
          deleteMultipleStudentsFromFirestore(state.classCode, duplicateIds).catch(err => {
            console.warn('Auto-cleanup of duplicate students in Firestore failed:', err);
          });
        }
      }
    }
  }, []);

  // LocalStorage Persistence
  useEffect(() => {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  // Firestore Class Settings Subscription (Lightweight 1-document listener)
  // Plan A: Real-time student collection streaming and transactions streaming are removed to prevent quota exhaustion.
  useEffect(() => {
    const classCode = state.classCode;
    if (!classCode || role === 'super_admin') return;

    // 1. Subscribe to class settings & market (1 doc only)
    const unsubClass = subscribeToClass(
      classCode,
      (updated) => {
        setIsCloudConnected(true);
        setState((prev) => {
          const updatedState: ClassEconomyState = {
            ...prev,
            classCode: updated.classCode || prev.classCode,
            className: updated.className !== undefined ? updated.className : prev.className,
            teacherName: updated.teacherName !== undefined ? updated.teacherName : prev.teacherName,
            teacherEmail: updated.teacherEmail !== undefined ? updated.teacherEmail : prev.teacherEmail,
            currencyUnit: updated.currencyUnit !== undefined ? updated.currencyUnit : (prev.currencyUnit || '원'),
            language: updated.language !== undefined ? updated.language : (prev.language || 'ko'),
            currentRound: updated.currentRound !== undefined ? updated.currentRound : prev.currentRound,
            totalRounds: updated.totalRounds !== undefined ? updated.totalRounds : prev.totalRounds,
            isTradingFrozen: updated.isTradingFrozen !== undefined ? updated.isTradingFrozen : prev.isTradingFrozen,
            isLeaderboardPublic: updated.isLeaderboardPublic !== undefined ? updated.isLeaderboardPublic : (prev.isLeaderboardPublic !== undefined ? prev.isLeaderboardPublic : true),
            depositInterestRate: updated.depositInterestRate !== undefined ? updated.depositInterestRate : prev.depositInterestRate,
            newsMessage: updated.newsMessage !== undefined ? updated.newsMessage : prev.newsMessage,
            newsArticles: updated.newsArticles !== undefined ? updated.newsArticles : (prev.newsArticles || initialNewsArticles),
            scheduledScenarios: updated.scheduledScenarios !== undefined ? updated.scheduledScenarios : (prev.scheduledScenarios || []),
            stocks: updated.stocks !== undefined && updated.stocks.length > 0 ? updated.stocks : prev.stocks,
            shopItems: updated.shopItems !== undefined && updated.shopItems.length > 0 ? updated.shopItems : prev.shopItems,
          };
          try {
            localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(updatedState));
          } catch (e) {
            console.warn('LocalStorage save error:', e);
          }
          return updatedState;
        });

        // If the teacher just advanced to a new round, automatically trigger student balance refresh
        if (updated.currentRound && updated.currentRound !== stateRef.current.currentRound) {
          if (role === 'student' && currentStudentId) {
            // Jitter 0~1.2s to distribute student requests gently
            setTimeout(() => {
              getSingleStudentFromFirestore(classCode, currentStudentId).then(singleStudent => {
                if (singleStudent) {
                  setState(prev => ({
                    ...prev,
                    students: prev.students.map(s => s.id === singleStudent.id ? mergeStudentKeepingNewerBalance(s, singleStudent) : s)
                  }));
                }
              }).catch(() => {});
            }, Math.random() * 1200);
          }
        }
      },
      () => {
        // Document does not exist in Firestore yet -> seed it
        syncClassToFirestore(stateRef.current).catch(err => {
          console.warn('Initial Firestore class seed error:', err);
        });
      }
    );

    return () => {
      unsubClass();
    };
  }, [state.classCode, role, currentStudentId]);

  // 2. Individual Student Real-Time Listener (Ultra-lightweight: 1 document only)
  // When teacher executes settlement or awards fines/rewards, the student device receives updates instantly (<0.5s)
  useEffect(() => {
    if (role !== 'student' || !state.classCode || !currentStudentId) return;

    const unsubStudent = subscribeToSingleStudent(
      state.classCode,
      currentStudentId,
      (updatedStudent) => {
        setState(prev => {
          const existingIdx = prev.students.findIndex(s => s.id === updatedStudent.id);
          let newStudents = [...prev.students];
          if (existingIdx !== -1) {
            newStudents[existingIdx] = mergeStudentKeepingNewerBalance(newStudents[existingIdx], updatedStudent);
          } else {
            newStudents.push(sanitizeStudent(updatedStudent));
          }
          const newState = {
            ...prev,
            students: newStudents
          };
          try {
            localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(newState));
          } catch (e) {}
          return newState;
        });
      }
    );

    return () => {
      unsubStudent();
    };
  }, [role, state.classCode, currentStudentId]);

  // Plan A: Smart periodic refresh for teacher (every 3 minutes, only when tab is active and visible)
  useEffect(() => {
    if (role !== 'teacher' || !state.classCode) return;
    const interval = setInterval(() => {
      if (typeof document !== 'undefined' && !document.hidden && !isFirestoreQuotaExceeded()) {
        refreshClassData();
      }
    }, 180000); // 3 minutes

    return () => clearInterval(interval);
  }, [role, state.classCode]);

  const currentStudent = useMemo(() => {
    if (!currentStudentId) return undefined;
    const fromState = state.students?.find(s => s.id === currentStudentId);
    if (fromState) return fromState;

    // Check localStorage class students cache
    try {
      const localStr = localStorage.getItem('kidsrich_students_' + state.classCode);
      if (localStr) {
        const parsed = JSON.parse(localStr);
        if (Array.isArray(parsed)) {
          const found = parsed.find((s: any) => s.id === currentStudentId);
          if (found) return sanitizeStudent(found);
        }
      }
    } catch (e) {}

    // Check session stored student account
    try {
      const savedAcc = sessionStorage.getItem('kidsrich_auth_student_account');
      if (savedAcc) {
        const parsed = JSON.parse(savedAcc);
        if (parsed && (parsed.id === currentStudentId || String(parsed.number) === currentStudentId)) {
          return sanitizeStudent(parsed);
        }
      }
    } catch (e) {}

    // Check initialStudents fallback
    const initFound = initialStudents.find(s => s.id === currentStudentId);
    if (initFound) return sanitizeStudent(initFound);

    return undefined;
  }, [state.students, currentStudentId, state.classCode]);

  const calculateTotalAssets = (student?: Student | null): number => {
    if (!student) return 0;
    const stocks = Array.isArray(state.stocks) ? state.stocks : [];
    const stockShares = student.stockShares || {};
    const stockVal = stocks.reduce((sum, stock) => {
      const shares = stockShares[stock.id] || 0;
      return sum + shares * (Number(stock.currentPrice) || 0);
    }, 0);
    return Math.round((Number(student.cash) || 0) + (Number(student.savings) || 0) + stockVal - (Number(student.debt) || 0));
  };

  // Helper to log transaction and sync to Firestore
  const logTx = (
    studentId: string,
    studentName: string,
    type: Transaction['type'],
    amount: number,
    description: string,
    round?: number
  ): Transaction => {
    const newTx: Transaction = {
      id: 'tx-' + Date.now() + '-' + Math.random().toString(36).substring(2, 5),
      studentId,
      studentName,
      type,
      amount,
      description,
      round: round ?? state.currentRound,
      timestamp: new Date().toISOString().replace('T', ' ').substring(0, 16)
    };
    // Plan A: Local transaction storage only (0 Firestore writes)
    return newTx;
  };

  // Student Actions (Server-Authoritative Firestore Transactions + Strict Integer Local Fallback)
  const depositSavings = async (amount: number): Promise<boolean> => {
    const cleanAmt = toSafeInt(amount, 0);
    const lockKey = `studentTx:${currentStudentId}`;
    if (!currentStudent || cleanAmt <= 0 || inFlightStudentTxRef.current.has(lockKey)) return false;
    if (stateRef.current.isTradingFrozen) {
      setLastActionError('현재 거래 정지 상태입니다.');
      return false;
    }

    inFlightStudentTxRef.current.add(lockKey);
    setLastActionError(null);
    try {
      const res = await runAtomicDeposit(stateRef.current.classCode, currentStudent.id, cleanAmt, currentStudent);
      if (res.ok && res.student) {
        const committed = res.student;
        const tx = logTx(committed.id, committed.name, 'deposit', cleanAmt, `저축 계좌 ${cleanAmt.toLocaleString()}원 입금`);
        setState(prev => ({
          ...prev,
          students: prev.students.map(s => s.id === committed.id ? committed : s),
          transactions: [tx, ...prev.transactions]
        }));
        return true;
      }

      if (!res.fallbackToLocal) {
        setLastActionError(res.error || '입금 처리에 실패했습니다.');
        return false;
      }

      // Offline / Quota fallback with strict integer math
      const liveStudent = stateRef.current.students.find(s => s.id === currentStudent.id) || currentStudent;
      const liveCash = toSafeInt(liveStudent.cash);
      if (liveCash < cleanAmt) {
        setLastActionError(`보유 현금(${liveCash.toLocaleString()}원)이 부족합니다.`);
        return false;
      }
      const updatedStudent: Student = {
        ...liveStudent,
        cash: liveCash - cleanAmt,
        savings: toSafeInt(liveStudent.savings) + cleanAmt,
        recentActivity: '저축 입금',
        balanceVersion: (liveStudent.balanceVersion || 0) + 1,
        updatedAtMs: Date.now()
      };
      const tx = logTx(updatedStudent.id, updatedStudent.name, 'deposit', cleanAmt, `저축 계좌 ${cleanAmt.toLocaleString()}원 입금`);
      syncStudentToFirestore(stateRef.current.classCode, updatedStudent);
      setState(prev => ({
        ...prev,
        students: prev.students.map(s => s.id === updatedStudent.id ? updatedStudent : s),
        transactions: [tx, ...prev.transactions]
      }));
      return true;
    } finally {
      inFlightStudentTxRef.current.delete(lockKey);
    }
  };

  const withdrawSavings = async (amount: number): Promise<boolean> => {
    const cleanAmt = toSafeInt(amount, 0);
    const lockKey = `studentTx:${currentStudentId}`;
    if (!currentStudent || cleanAmt <= 0 || inFlightStudentTxRef.current.has(lockKey)) return false;
    if (stateRef.current.isTradingFrozen) {
      setLastActionError('현재 거래 정지 상태입니다.');
      return false;
    }

    inFlightStudentTxRef.current.add(lockKey);
    setLastActionError(null);
    try {
      const res = await runAtomicWithdraw(stateRef.current.classCode, currentStudent.id, cleanAmt, currentStudent);
      if (res.ok && res.student) {
        const committed = res.student;
        const tx = logTx(committed.id, committed.name, 'withdraw', cleanAmt, `저축 계좌 ${cleanAmt.toLocaleString()}원 출금`);
        setState(prev => ({
          ...prev,
          students: prev.students.map(s => s.id === committed.id ? committed : s),
          transactions: [tx, ...prev.transactions]
        }));
        return true;
      }

      if (!res.fallbackToLocal) {
        setLastActionError(res.error || '출금 처리에 실패했습니다.');
        return false;
      }

      const liveStudent = stateRef.current.students.find(s => s.id === currentStudent.id) || currentStudent;
      const liveSavings = toSafeInt(liveStudent.savings);
      if (liveSavings < cleanAmt) {
        setLastActionError(`예금 잔액(${liveSavings.toLocaleString()}원)이 부족합니다.`);
        return false;
      }
      const updatedStudent: Student = {
        ...liveStudent,
        cash: toSafeInt(liveStudent.cash) + cleanAmt,
        savings: liveSavings - cleanAmt,
        recentActivity: '저축 출금',
        balanceVersion: (liveStudent.balanceVersion || 0) + 1,
        updatedAtMs: Date.now()
      };
      const tx = logTx(updatedStudent.id, updatedStudent.name, 'withdraw', cleanAmt, `저축 계좌 ${cleanAmt.toLocaleString()}원 출금`);
      syncStudentToFirestore(stateRef.current.classCode, updatedStudent);
      setState(prev => ({
        ...prev,
        students: prev.students.map(s => s.id === updatedStudent.id ? updatedStudent : s),
        transactions: [tx, ...prev.transactions]
      }));
      return true;
    } finally {
      inFlightStudentTxRef.current.delete(lockKey);
    }
  };

  const buyStock = async (stockId: string, shares: number, customAmount?: number): Promise<boolean> => {
    const lockKey = `studentTx:${currentStudentId}`;
    if (!currentStudent || stateRef.current.isTradingFrozen || inFlightStudentTxRef.current.has(lockKey)) {
      if (stateRef.current.isTradingFrozen) setLastActionError('현재 거래 정지 상태입니다.');
      return false;
    }
    const stock = (stateRef.current.stocks || []).find(s => s.id === stockId);
    if (!stock || (stock.currentPrice || 0) <= 0) return false;

    inFlightStudentTxRef.current.add(lockKey);
    setLastActionError(null);
    try {
      const res = await runAtomicBuyStock(
        stateRef.current.classCode,
        currentStudent.id,
        stockId,
        shares,
        customAmount,
        stateRef.current.stocks,
        currentStudent
      );

      if (res.ok && res.student) {
        const committed = res.student;
        const totalCost = res.actualAmount || 0;
        const effShares = res.actualShares || 0;
        const sharesLabel = Number.isInteger(effShares) ? `${effShares}주` : `${parseFloat(effShares.toFixed(6))}주`;
        const tx = logTx(
          committed.id,
          committed.name,
          'stock_buy',
          totalCost,
          `${res.stockName || stock.name} ${sharesLabel} 매수 (${totalCost.toLocaleString()}원)`
        );
        setState(prev => ({
          ...prev,
          students: prev.students.map(s => s.id === committed.id ? committed : s),
          transactions: [tx, ...prev.transactions]
        }));
        return true;
      }

      if (!res.fallbackToLocal) {
        setLastActionError(res.error || '주식 매수 처리에 실패했습니다.');
        return false;
      }

      const liveStudent = stateRef.current.students.find(s => s.id === currentStudent.id) || currentStudent;
      let totalCost: number;
      let effectiveShares: number;
      if (customAmount !== undefined && customAmount > 0) {
        totalCost = toSafeInt(customAmount, 0);
        if (totalCost <= 0) return false;
        effectiveShares = calcBuySharesFromAmount(totalCost, stock.currentPrice);
      } else {
        if (!Number.isFinite(shares) || shares <= 0) return false;
        effectiveShares = toSafeShares(shares);
        totalCost = calcBuyCostFromShares(effectiveShares, stock.currentPrice);
      }
      const liveCash = toSafeInt(liveStudent.cash);
      if (totalCost <= 0 || effectiveShares <= 0) {
        setLastActionError('매수 금액 또는 수량이 너무 작습니다.');
        return false;
      }
      if (liveCash < totalCost) {
        setLastActionError(`보유 현금(${liveCash.toLocaleString()}원)이 부족합니다.`);
        return false;
      }

      const currentShares = toSafeShares((liveStudent.stockShares || {})[stockId] || 0);
      const newShares = toSafeShares(currentShares + effectiveShares);
      if (newShares <= currentShares) {
        setLastActionError('매수 수량이 너무 작아 체결할 수 없습니다.');
        return false;
      }
      const updatedStudent: Student = {
        ...liveStudent,
        cash: liveCash - totalCost,
        stockShares: sanitizeStockSharesMap({ ...(liveStudent.stockShares || {}), [stockId]: newShares }),
        recentActivity: `${stock.name} 매수`,
        balanceVersion: (liveStudent.balanceVersion || 0) + 1,
        updatedAtMs: Date.now()
      };
      const sharesLabel = Number.isInteger(effectiveShares) ? `${effectiveShares}주` : `${parseFloat(effectiveShares.toFixed(6))}주`;
      const tx = logTx(updatedStudent.id, updatedStudent.name, 'stock_buy', totalCost, `${stock.name} ${sharesLabel} 매수 (${totalCost.toLocaleString()}원)`);
      syncStudentToFirestore(stateRef.current.classCode, updatedStudent);
      setState(prev => ({
        ...prev,
        students: prev.students.map(s => s.id === updatedStudent.id ? updatedStudent : s),
        transactions: [tx, ...prev.transactions]
      }));
      return true;
    } finally {
      inFlightStudentTxRef.current.delete(lockKey);
    }
  };

  const sellStock = async (stockId: string, shares: number, customAmount?: number): Promise<boolean> => {
    const lockKey = `studentTx:${currentStudentId}`;
    if (!currentStudent || stateRef.current.isTradingFrozen || inFlightStudentTxRef.current.has(lockKey)) {
      if (stateRef.current.isTradingFrozen) setLastActionError('현재 거래 정지 상태입니다.');
      return false;
    }
    const stock = (stateRef.current.stocks || []).find(s => s.id === stockId);
    if (!stock || (stock.currentPrice || 0) <= 0) return false;

    inFlightStudentTxRef.current.add(lockKey);
    setLastActionError(null);
    try {
      const res = await runAtomicSellStock(
        stateRef.current.classCode,
        currentStudent.id,
        stockId,
        shares,
        customAmount,
        stateRef.current.stocks,
        currentStudent
      );

      if (res.ok && res.student) {
        const committed = res.student;
        const totalReturn = res.actualAmount || 0;
        const effShares = res.actualShares || 0;
        const sharesLabel = Number.isInteger(effShares) ? `${effShares}주` : `${parseFloat(effShares.toFixed(6))}주`;
        const tx = logTx(
          committed.id,
          committed.name,
          'stock_sell',
          totalReturn,
          `${res.stockName || stock.name} ${sharesLabel} 매도 (${totalReturn.toLocaleString()}원)`
        );
        setState(prev => ({
          ...prev,
          students: prev.students.map(s => s.id === committed.id ? committed : s),
          transactions: [tx, ...prev.transactions]
        }));
        return true;
      }

      if (!res.fallbackToLocal) {
        setLastActionError(res.error || '주식 매도 처리에 실패했습니다.');
        return false;
      }

      const liveStudent = stateRef.current.students.find(s => s.id === currentStudent.id) || currentStudent;
      const currentShares = toSafeShares((liveStudent.stockShares || {})[stockId] || 0);
      if (currentShares <= 0) return false;

      let totalReturn: number;
      let effectiveShares: number;
      if (customAmount !== undefined && customAmount > 0) {
        const requestedReturn = toSafeInt(customAmount, 0);
        if (requestedReturn <= 0) return false;
        const maxPossibleReturn = calcSellReturnFromShares(currentShares, stock.currentPrice);
        if (maxPossibleReturn <= 0) {
          setLastActionError('매도 가능한 주식 평가액이 1원 미만입니다.');
          return false;
        }
        if (requestedReturn >= maxPossibleReturn) {
          totalReturn = maxPossibleReturn;
          effectiveShares = currentShares;
        } else {
          totalReturn = requestedReturn;
          effectiveShares = Math.min(currentShares, calcSellSharesFromAmount(totalReturn, stock.currentPrice));
        }
      } else {
        if (!Number.isFinite(shares) || shares <= 0) return false;
        effectiveShares = Math.min(currentShares, toSafeShares(shares));
        totalReturn = calcSellReturnFromShares(effectiveShares, stock.currentPrice);
      }
      if (totalReturn <= 0 || effectiveShares <= 0) {
        setLastActionError('매도 금액 또는 수량이 너무 작습니다.');
        return false;
      }
      const remainingShares = toSafeShares(currentShares - effectiveShares);
      if (remainingShares >= currentShares) {
        setLastActionError('매도 수량이 정상적으로 차감되지 않아 거래가 취소되었습니다.');
        return false;
      }
      const updatedStudent: Student = {
        ...liveStudent,
        cash: toSafeInt(liveStudent.cash) + totalReturn,
        stockShares: sanitizeStockSharesMap({ ...(liveStudent.stockShares || {}), [stockId]: remainingShares }),
        recentActivity: `${stock.name} 매도`,
        balanceVersion: (liveStudent.balanceVersion || 0) + 1,
        updatedAtMs: Date.now()
      };
      const sharesLabel = Number.isInteger(effectiveShares) ? `${effectiveShares}주` : `${parseFloat(effectiveShares.toFixed(6))}주`;
      const tx = logTx(updatedStudent.id, updatedStudent.name, 'stock_sell', totalReturn, `${stock.name} ${sharesLabel} 매도 (${totalReturn.toLocaleString()}원)`);
      syncStudentToFirestore(stateRef.current.classCode, updatedStudent);
      setState(prev => ({
        ...prev,
        students: prev.students.map(s => s.id === updatedStudent.id ? updatedStudent : s),
        transactions: [tx, ...prev.transactions]
      }));
      return true;
    } finally {
      inFlightStudentTxRef.current.delete(lockKey);
    }
  };

  const buyShopItem = async (item: ShopItem): Promise<boolean> => {
    const lockKey = `studentTx:${currentStudentId}`;
    if (!currentStudent || inFlightStudentTxRef.current.has(lockKey)) return false;

    const itemPrice = toSafeInt(item.price, 0);
    const now = new Date();
    const formattedDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    const newCoupon: Coupon = {
      id: 'coupon-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
      name: item.name,
      icon: item.icon,
      price: itemPrice,
      purchasedAt: formattedDate,
      used: false,
      teacherConfirmed: false
    };

    inFlightStudentTxRef.current.add(lockKey);
    setLastActionError(null);
    try {
      const res = await runAtomicBuyShopItem(stateRef.current.classCode, currentStudent.id, item, newCoupon, currentStudent);
      if (res.ok && res.student) {
        const committed = res.student;
        const tx = logTx(committed.id, committed.name, 'shop_buy', itemPrice, `학급 상점: ${item.name} 결제`);
        setState(prev => ({
          ...prev,
          students: prev.students.map(s => s.id === committed.id ? committed : s),
          transactions: [tx, ...prev.transactions]
        }));
        return true;
      }

      if (!res.fallbackToLocal) {
        setLastActionError(res.error || '상점 결제 처리에 실패했습니다.');
        return false;
      }

      const liveStudent = stateRef.current.students.find(s => s.id === currentStudent.id) || currentStudent;
      const liveCash = toSafeInt(liveStudent.cash);
      if (liveCash < itemPrice) return false;

      const updatedStudent: Student = {
        ...liveStudent,
        cash: liveCash - itemPrice,
        recentActivity: `${item.name} 결제`,
        couponsOwned: [newCoupon, ...(liveStudent.couponsOwned || [])],
        balanceVersion: (liveStudent.balanceVersion || 0) + 1,
        updatedAtMs: Date.now()
      };
      const tx = logTx(updatedStudent.id, updatedStudent.name, 'shop_buy', itemPrice, `학급 상점: ${item.name} 결제`);
      syncStudentToFirestore(stateRef.current.classCode, updatedStudent);
      setState(prev => ({
        ...prev,
        students: prev.students.map(s => s.id === updatedStudent.id ? updatedStudent : s),
        transactions: [tx, ...prev.transactions]
      }));
      return true;
    } finally {
      inFlightStudentTxRef.current.delete(lockKey);
    }
  };

  const transferMoney = async (targetName: string, amount: number, note: string): Promise<boolean> => {
    const cleanAmt = toSafeInt(amount, 0);
    const lockKey = `studentTx:${currentStudentId}`;
    if (!currentStudent || cleanAmt <= 0 || inFlightStudentTxRef.current.has(lockKey)) return false;

    const targetStudent = stateRef.current.students.find(s => s.name === targetName) || null;
    if (targetStudent && targetStudent.id === currentStudent.id) {
      setLastActionError('본인에게는 송금할 수 없습니다.');
      return false;
    }

    inFlightStudentTxRef.current.add(lockKey);
    setLastActionError(null);
    try {
      const res = await runAtomicTransferMoney(
        stateRef.current.classCode,
        currentStudent.id,
        targetStudent ? targetStudent.id : null,
        cleanAmt,
        `${targetName}에게 송금`,
        `${currentStudent.name}에게 입금수령`,
        currentStudent,
        targetStudent
      );

      if (res.ok && res.student) {
        const committedSender = res.student;
        const committedReceiver = res.receiverStudent;
        const tx = logTx(
          committedSender.id,
          committedSender.name,
          'transfer',
          cleanAmt,
          `${targetName}에게 ${cleanAmt.toLocaleString()}원 송금 (${note || '사유 없음'})`
        );
        setState(prev => ({
          ...prev,
          students: prev.students.map(s => {
            if (s.id === committedSender.id) return committedSender;
            if (committedReceiver && s.id === committedReceiver.id) return committedReceiver;
            return s;
          }),
          transactions: [tx, ...prev.transactions]
        }));
        return true;
      }

      if (!res.fallbackToLocal) {
        setLastActionError(res.error || '송금 처리에 실패했습니다.');
        return false;
      }

      const liveSender = stateRef.current.students.find(s => s.id === currentStudent.id) || currentStudent;
      const liveCash = toSafeInt(liveSender.cash);
      if (liveCash < cleanAmt) return false;

      const updatedSender: Student = {
        ...liveSender,
        cash: liveCash - cleanAmt,
        recentActivity: `${targetName}에게 송금`,
        balanceVersion: (liveSender.balanceVersion || 0) + 1,
        updatedAtMs: Date.now()
      };
      let updatedReceiver: Student | null = null;
      if (targetStudent) {
        updatedReceiver = {
          ...targetStudent,
          cash: toSafeInt(targetStudent.cash) + cleanAmt,
          recentActivity: `${liveSender.name}에게 입금수령`,
          balanceVersion: (targetStudent.balanceVersion || 0) + 1,
          updatedAtMs: Date.now()
        };
        syncStudentToFirestore(stateRef.current.classCode, updatedReceiver);
      }
      syncStudentToFirestore(stateRef.current.classCode, updatedSender);

      const tx = logTx(
        updatedSender.id,
        updatedSender.name,
        'transfer',
        cleanAmt,
        `${targetName}에게 ${cleanAmt.toLocaleString()}원 송금 (${note || '사유 없음'})`
      );
      setState(prev => ({
        ...prev,
        students: prev.students.map(s => {
          if (s.id === updatedSender.id) return updatedSender;
          if (updatedReceiver && s.id === updatedReceiver.id) return updatedReceiver;
          return s;
        }),
        transactions: [tx, ...prev.transactions]
      }));
      return true;
    } finally {
      inFlightStudentTxRef.current.delete(lockKey);
    }
  };

  const rebalancePortfolio = async (
    targetCashPct: number,
    targetSavingsPct: number,
    targetStockPct: number
  ): Promise<boolean> => {
    const lockKey = `studentTx:${currentStudentId}`;
    if (!currentStudent || stateRef.current.isTradingFrozen || inFlightStudentTxRef.current.has(lockKey)) {
      if (stateRef.current.isTradingFrozen) setLastActionError('현재 거래 정지 상태입니다.');
      return false;
    }
    const pctsValid =
      Number.isFinite(targetCashPct) &&
      Number.isFinite(targetSavingsPct) &&
      Number.isFinite(targetStockPct) &&
      targetCashPct >= 0 &&
      targetSavingsPct >= 0 &&
      targetStockPct >= 0 &&
      targetCashPct <= 100 &&
      targetSavingsPct <= 100 &&
      targetStockPct <= 100 &&
      Math.abs(targetCashPct + targetSavingsPct + targetStockPct - 100) <= 0.01;
    if (!pctsValid) {
      setLastActionError('목표 자산 비중의 합은 100%여야 합니다.');
      return false;
    }

    inFlightStudentTxRef.current.add(lockKey);
    setLastActionError(null);
    try {
      const res = await runAtomicRebalance(
        stateRef.current.classCode,
        currentStudent.id,
        targetCashPct,
        targetSavingsPct,
        targetStockPct,
        stateRef.current.stocks,
        currentStudent
      );

      if (res.ok && res.student) {
        const committed = res.student;
        const stocksList = stateRef.current.stocks || [];
        const actualStockVal = toSafeInt(stocksList.reduce((sum, st) => sum + ((committed.stockShares || {})[st.id] || 0) * (st.currentPrice || 0), 0));
        const total = toSafeInt(committed.cash) + toSafeInt(committed.savings) + actualStockVal;
        const tx = logTx(
          committed.id,
          committed.name,
          'transfer',
          total,
          `자산 비중 리밸런싱 완료 (현금: ${committed.cash.toLocaleString()}원, 저축: ${committed.savings.toLocaleString()}원, 주식: ${actualStockVal.toLocaleString()}원)`
        );
        setState(prev => ({
          ...prev,
          students: prev.students.map(s => s.id === committed.id ? committed : s),
          transactions: [tx, ...prev.transactions]
        }));
        return true;
      }

      if (!res.fallbackToLocal) {
        setLastActionError(res.error || '리밸런싱 실행에 실패했습니다.');
        return false;
      }

      const liveStudent = stateRef.current.students.find(s => s.id === currentStudent.id) || currentStudent;
      const currentSharesMap = liveStudent.stockShares || {};
      const stocksList = stateRef.current.stocks || [];
      const currentTotalStock = toSafeInt(
        stocksList.reduce((sum, st) => sum + toSafeShares(currentSharesMap[st.id] || 0) * (st.currentPrice || 0), 0)
      );
      const totalAssets = toSafeInt(liveStudent.cash) + toSafeInt(liveStudent.savings) + currentTotalStock;
      if (totalAssets <= 0) return false;

      const targetSavingsAmt = toSafeInt(totalAssets * (targetSavingsPct / 100));
      const targetStockVal = toSafeInt(totalAssets * (targetStockPct / 100));
      const newShares: Record<string, number> = {};

      if (targetStockVal > 0 && stocksList.length > 0) {
        if (currentTotalStock > 0) {
          stocksList.forEach(st => {
            const currentVal = toSafeShares(currentSharesMap[st.id] || 0) * (st.currentPrice || 0);
            const ratio = currentVal / currentTotalStock;
            const targetValForStock = targetStockVal * ratio;
            newShares[st.id] = Math.floor(targetValForStock / Math.max(1, st.currentPrice || 1));
          });
        } else {
          const perStockVal = targetStockVal / stocksList.length;
          stocksList.forEach(st => {
            newShares[st.id] = Math.floor(perStockVal / Math.max(1, st.currentPrice || 1));
          });
        }
      }

      const cleanedShares = sanitizeStockSharesMap(newShares);
      const actualStockVal = toSafeInt(
        stocksList.reduce((sum, st) => sum + (cleanedShares[st.id] || 0) * (st.currentPrice || 0), 0)
      );
      const actualSavingsAmt = Math.min(Math.max(0, totalAssets - actualStockVal), targetSavingsAmt);
      const actualCashAmt = Math.max(0, totalAssets - actualStockVal - actualSavingsAmt);

      const updatedStudent: Student = {
        ...liveStudent,
        cash: toSafeInt(actualCashAmt),
        savings: toSafeInt(actualSavingsAmt),
        stockShares: cleanedShares,
        recentActivity: `자산 비중 리밸런싱 (${targetCashPct}% / ${targetSavingsPct}% / ${targetStockPct}%)`,
        balanceVersion: (liveStudent.balanceVersion || 0) + 1,
        updatedAtMs: Date.now()
      };
      const tx = logTx(
        updatedStudent.id,
        updatedStudent.name,
        'transfer',
        totalAssets,
        `자산 비중 리밸런싱 완료 (현금: ${actualCashAmt.toLocaleString()}원, 저축: ${actualSavingsAmt.toLocaleString()}원, 주식: ${actualStockVal.toLocaleString()}원)`
      );
      syncStudentToFirestore(stateRef.current.classCode, updatedStudent);
      setState(prev => ({
        ...prev,
        students: prev.students.map(s => s.id === updatedStudent.id ? updatedStudent : s),
        transactions: [tx, ...prev.transactions]
      }));
      return true;
    } finally {
      inFlightStudentTxRef.current.delete(lockKey);
    }
  };

  const repayDebt = async (amount: number): Promise<boolean> => {
    const reqAmt = toSafeInt(amount, 0);
    const lockKey = `studentTx:${currentStudentId}`;
    if (!currentStudent || stateRef.current.isTradingFrozen || reqAmt <= 0 || inFlightStudentTxRef.current.has(lockKey)) {
      if (stateRef.current.isTradingFrozen) setLastActionError('현재 거래 정지 상태입니다.');
      return false;
    }

    inFlightStudentTxRef.current.add(lockKey);
    setLastActionError(null);
    try {
      const res = await runAtomicRepayDebt(stateRef.current.classCode, currentStudent.id, reqAmt, currentStudent);
      if (res.ok && res.student) {
        const committed = res.student;
        const cleanAmt = res.actualAmount || reqAmt;
        const leftDebt = toSafeInt(committed.debt);
        const tx = logTx(
          committed.id,
          committed.name,
          'transfer',
          cleanAmt,
          `학급 부채(빚) ${cleanAmt.toLocaleString()}원 상환 완료${leftDebt > 0 ? ` (잔여 빚: ${leftDebt.toLocaleString()}원)` : ' (전액 완제)'}`
        );
        setState(prev => ({
          ...prev,
          students: prev.students.map(s => s.id === committed.id ? committed : s),
          transactions: [tx, ...prev.transactions]
        }));
        return true;
      }

      if (!res.fallbackToLocal) {
        setLastActionError(res.error || '부채 상환 처리에 실패했습니다.');
        return false;
      }

      const liveStudent = stateRef.current.students.find(s => s.id === currentStudent.id) || currentStudent;
      const debt = toSafeInt(liveStudent.debt);
      const cash = toSafeInt(liveStudent.cash);
      if (debt <= 0 || cash <= 0) return false;
      const cleanAmt = Math.min(cash, Math.min(debt, reqAmt));
      if (cleanAmt <= 0) return false;

      const updatedStudent: Student = {
        ...liveStudent,
        cash: cash - cleanAmt,
        debt: debt - cleanAmt,
        recentActivity: `부채 상환 (-${cleanAmt.toLocaleString()}원)`,
        balanceVersion: (liveStudent.balanceVersion || 0) + 1,
        updatedAtMs: Date.now()
      };
      const leftDebt = debt - cleanAmt;
      const tx = logTx(
        updatedStudent.id,
        updatedStudent.name,
        'transfer',
        cleanAmt,
        `학급 부채(빚) ${cleanAmt.toLocaleString()}원 상환 완료${leftDebt > 0 ? ` (잔여 빚: ${leftDebt.toLocaleString()}원)` : ' (전액 완제)'}`
      );
      syncStudentToFirestore(stateRef.current.classCode, updatedStudent);
      setState(prev => ({
        ...prev,
        students: prev.students.map(s => s.id === updatedStudent.id ? updatedStudent : s),
        transactions: [tx, ...prev.transactions]
      }));
      return true;
    } finally {
      inFlightStudentTxRef.current.delete(lockKey);
    }
  };

  const forgiveStudentDebt = async (studentId: string, amount?: number): Promise<boolean> => {
    const student = stateRef.current.students.find(s => s.id === studentId);
    if (!student) return false;
    const lockKey = `forgiveDebt:${studentId}`;
    if (inFlightStudentTxRef.current.has(lockKey)) return false;

    inFlightStudentTxRef.current.add(lockKey);
    try {
      const res = await runAtomicForgiveStudentDebt(stateRef.current.classCode, studentId, amount, student);
      if (res.ok && res.student) {
        const committed = res.student;
        const cleanAmt = res.actualAmount || 0;
        const remDebt = toSafeInt(committed.debt);
        const tx = logTx(
          committed.id,
          committed.name,
          'reward',
          cleanAmt,
          `선생님께서 학급 부채(빚) ${cleanAmt.toLocaleString()}원을 탕감(면제)해 주셨습니다.${remDebt > 0 ? ` (잔여 빚: ${remDebt.toLocaleString()}원)` : ' (전액 탕감)'}`
        );
        setState(prev => ({
          ...prev,
          students: prev.students.map(s => s.id === studentId ? committed : s),
          transactions: [tx, ...prev.transactions]
        }));
        return true;
      }

      if (!res.fallbackToLocal) {
        return false;
      }

      const debt = toSafeInt(student.debt);
      if (debt <= 0) return false;
      const cleanAmt = amount !== undefined && amount > 0 ? Math.min(debt, toSafeInt(amount)) : debt;
      if (cleanAmt <= 0) return false;

      const updatedStudent: Student = {
        ...student,
        debt: debt - cleanAmt,
        recentActivity: `부채 ${cleanAmt.toLocaleString()}원 탕감`,
        balanceVersion: (student.balanceVersion || 0) + 1,
        updatedAtMs: Date.now()
      };
      const tx = logTx(
        student.id,
        student.name,
        'reward',
        cleanAmt,
        `선생님께서 학급 부채(빚) ${cleanAmt.toLocaleString()}원을 탕감(면제)해 주셨습니다.${debt - cleanAmt > 0 ? ` (잔여 빚: ${(debt - cleanAmt).toLocaleString()}원)` : ' (전액 탕감)'}`
      );
      syncStudentProfileFromTeacher(stateRef.current.classCode, updatedStudent);
      setState(prev => ({
        ...prev,
        students: prev.students.map(s => s.id === studentId ? updatedStudent : s),
        transactions: [tx, ...prev.transactions]
      }));
      return true;
    } finally {
      inFlightStudentTxRef.current.delete(lockKey);
    }
  };

  const useCoupon = (couponId: string) => {
    if (!currentStudent) return;
    const now = new Date();
    const formattedDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    const targetCoupon = (currentStudent.couponsOwned || []).find(c => c.id === couponId);

    const updatedStudent: Student = {
      ...currentStudent,
      couponsOwned: (currentStudent.couponsOwned || []).map(c => 
        c.id === couponId
          ? {
              ...c,
              requestedUse: true,
              requestedAt: formattedDate,
              used: false
            }
          : c
      ),
      recentActivity: `쿠폰 사용 신청 (${targetCoupon?.name || '쿠폰'})`
    };
    syncStudentToFirestore(state.classCode, updatedStudent);
    setState(prev => ({
      ...prev,
      students: prev.students.map(s => s.id === currentStudentId ? updatedStudent : s)
    }));
  };

  const cancelCouponRequest = (couponId: string) => {
    if (!currentStudent) return;
    const targetCoupon = (currentStudent.couponsOwned || []).find(c => c.id === couponId);
    if (targetCoupon?.used && targetCoupon?.teacherConfirmed) return;

    const updatedStudent: Student = {
      ...currentStudent,
      couponsOwned: (currentStudent.couponsOwned || []).map(c => 
        c.id === couponId
          ? {
              ...c,
              requestedUse: false,
              requestedAt: undefined,
              used: false
            }
          : c
      ),
      recentActivity: `쿠폰 사용 신청 취소 (${targetCoupon?.name || '쿠폰'})`
    };
    syncStudentToFirestore(state.classCode, updatedStudent);
    setState(prev => ({
      ...prev,
      students: prev.students.map(s => s.id === currentStudentId ? updatedStudent : s)
    }));
  };

  const toggleCouponTeacherConfirm = (studentId: string, couponId: string, forceStatus?: boolean) => {
    const now = new Date();
    const formattedDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    let updatedTarget: Student | null = null;

    setState(prev => {
      const updatedStudents = prev.students.map(s => {
        if (s.id === studentId) {
          const updatedCoupons = (s.couponsOwned || []).map(c => {
            if (c.id === couponId) {
              const nextStatus = forceStatus !== undefined ? forceStatus : !c.teacherConfirmed;
              const { teacherConfirmedAt, usedAt, ...restCoupon } = c;
              return nextStatus
                ? {
                    ...c,
                    teacherConfirmed: true,
                    teacherConfirmedAt: c.teacherConfirmedAt || formattedDate,
                    used: true,
                    usedAt: c.usedAt || formattedDate,
                    requestedUse: true
                  }
                : {
                    ...restCoupon,
                    teacherConfirmed: false,
                    used: false,
                    requestedUse: false
                  };
            }
            return c;
          });
          updatedTarget = {
            ...s,
            couponsOwned: updatedCoupons
          };
          return updatedTarget;
        }
        return s;
      });

      if (updatedTarget) {
        syncStudentNonBalanceFieldsFromTeacher(prev.classCode, updatedTarget.id, {
          couponsOwned: updatedTarget.couponsOwned
        });
      }

      const newState = {
        ...prev,
        students: updatedStudents
      };
      syncClassToFirestore(newState);
      try {
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(newState));
      } catch (e) {
        console.warn('LocalStorage save error:', e);
      }
      return newState;
    });
  };

  const batchSetCouponsTeacherConfirm = (items: { studentId: string; couponId: string }[], confirmed: boolean) => {
    if (!items || items.length === 0) return;
    const now = new Date();
    const formattedDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    const studentMap = new Map<string, Set<string>>();
    items.forEach(it => {
      if (!studentMap.has(it.studentId)) {
        studentMap.set(it.studentId, new Set());
      }
      studentMap.get(it.studentId)!.add(it.couponId);
    });

    const updatedTargets: Student[] = [];

    setState(prev => {
      const updatedStudents = prev.students.map(s => {
        if (studentMap.has(s.id)) {
          const couponIdSet = studentMap.get(s.id)!;
          const updatedCoupons = (s.couponsOwned || []).map(c => {
            if (couponIdSet.has(c.id)) {
              const { teacherConfirmedAt, usedAt, ...restCoupon } = c;
              return confirmed
                ? {
                    ...c,
                    teacherConfirmed: true,
                    teacherConfirmedAt: c.teacherConfirmedAt || formattedDate,
                    used: true,
                    usedAt: c.usedAt || formattedDate,
                    requestedUse: true
                  }
                : {
                    ...restCoupon,
                    teacherConfirmed: false,
                    used: false,
                    requestedUse: false
                  };
            }
            return c;
          });
          const updated = {
            ...s,
            couponsOwned: updatedCoupons
          };
          updatedTargets.push(updated);
          return updated;
        }
        return s;
      });

      if (updatedTargets.length > 0) {
        syncMultipleStudentNonBalanceFieldsFromTeacher(
          prev.classCode,
          updatedTargets.map(u => ({
            studentId: u.id,
            fields: { couponsOwned: u.couponsOwned }
          }))
        );
      }

      const newState = {
        ...prev,
        students: updatedStudents
      };
      syncClassToFirestore(newState);
      try {
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(newState));
      } catch (e) {
        console.warn('LocalStorage save error:', e);
      }
      return newState;
    });
  };

  // Teacher Actions
  const updateClassSettings = (settings: {
    className?: string;
    classCode?: string;
    teacherName?: string;
    teacherEmail?: string;
    currencyUnit?: string;
    totalRounds?: number;
    currentRound?: number;
    language?: string;
    isLeaderboardPublic?: boolean;
  }) => {
    setState(prev => {
      const nextTeacherName = settings.teacherName !== undefined ? settings.teacherName.trim() : prev.teacherName;
      const nextTeacherEmail = settings.teacherEmail !== undefined ? settings.teacherEmail.trim() : prev.teacherEmail;
      const nextClassName = settings.className !== undefined ? settings.className.trim() : prev.className;
      const nextClassCode = settings.classCode !== undefined ? settings.classCode.trim() : prev.classCode;
      const nextCurrencyUnit = settings.currencyUnit !== undefined ? settings.currencyUnit.trim() : (prev.currencyUnit || '원');
      const nextTotalRounds = settings.totalRounds !== undefined ? Math.max(1, settings.totalRounds) : prev.totalRounds;
      const nextCurrentRound = settings.currentRound !== undefined ? Math.max(1, settings.currentRound) : prev.currentRound;
      const nextLanguage = settings.language !== undefined ? settings.language : (prev.language || 'ko');
      const nextIsLeaderboardPublic = settings.isLeaderboardPublic !== undefined ? settings.isLeaderboardPublic : (prev.isLeaderboardPublic !== undefined ? prev.isLeaderboardPublic : true);

      const newState: ClassEconomyState = {
        ...prev,
        className: nextClassName,
        classCode: nextClassCode,
        teacherName: nextTeacherName,
        teacherEmail: nextTeacherEmail,
        currencyUnit: nextCurrencyUnit,
        totalRounds: nextTotalRounds,
        currentRound: nextCurrentRound,
        language: nextLanguage,
        isLeaderboardPublic: nextIsLeaderboardPublic
      };

      try {
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(newState));
      } catch (e) {
        console.warn('LocalStorage save error:', e);
      }

      if (currentTeacher) {
        const updatedTeacher: TeacherAccount = {
          ...currentTeacher,
          name: nextTeacherName || currentTeacher.name,
          email: nextTeacherEmail || currentTeacher.email,
          classCode: nextClassCode,
          className: nextClassName
        };
        setCurrentTeacher(updatedTeacher);
        sessionStorage.setItem('kidsrich_auth_teacher', JSON.stringify(updatedTeacher));
        saveTeacherToFirestore(updatedTeacher);

        const savedTeachersStr = localStorage.getItem('kidsrich_teachers');
        const localTeachers: TeacherAccount[] = savedTeachersStr ? JSON.parse(savedTeachersStr) : [];
        const idx = localTeachers.findIndex(t => t.teacherId === updatedTeacher.teacherId || t.email === updatedTeacher.email);
        if (idx >= 0) {
          localTeachers[idx] = updatedTeacher;
        } else {
          localTeachers.push(updatedTeacher);
        }
        localStorage.setItem('kidsrich_teachers', JSON.stringify(localTeachers));
      }

      syncClassToFirestore(newState);
      return newState;
    });
  };

  const toggleTradingFreeze = () => {
    setState(prev => {
      const newState = { ...prev, isTradingFrozen: !prev.isTradingFrozen };
      syncClassToFirestore(newState);
      return newState;
    });
  };

  const toggleLeaderboardPublic = () => {
    setState(prev => {
      const currentPublic = prev.isLeaderboardPublic !== undefined ? prev.isLeaderboardPublic : true;
      const newState: ClassEconomyState = { ...prev, isLeaderboardPublic: !currentPublic };
      try {
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(newState));
      } catch (e) {
        console.warn('LocalStorage save error:', e);
      }
      syncClassToFirestore(newState);
      return newState;
    });
  };

  const setLeaderboardPublic = (isPublic: boolean) => {
    setState(prev => {
      const newState: ClassEconomyState = { ...prev, isLeaderboardPublic: isPublic };
      try {
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(newState));
      } catch (e) {
        console.warn('LocalStorage save error:', e);
      }
      syncClassToFirestore(newState);
      return newState;
    });
  };

  const setInterestRates = (depositRate: number) => {
    setState(prev => {
      const newState = {
        ...prev,
        depositInterestRate: depositRate
      };
      syncClassToFirestore(newState);
      return newState;
    });
  };

  const updateStockPrice = (stockId: string, newPrice: number) => {
    if (newPrice <= 0 || isNaN(newPrice)) return;
    setState(prev => {
      const updatedStocks = prev.stocks.map(st => {
        if (st.id === stockId) {
          const prevPrice = st.currentPrice;
          const changeRate = prevPrice > 0 ? parseFloat((((newPrice - prevPrice) / prevPrice) * 100).toFixed(1)) : 0;
          return {
            ...st,
            previousPrice: prevPrice !== newPrice ? prevPrice : st.previousPrice,
            currentPrice: newPrice,
            changeRate: prevPrice !== newPrice ? changeRate : st.changeRate
          };
        }
        return st;
      });

      const newState = {
        ...prev,
        stocks: updatedStocks
      };
      syncClassToFirestore(newState);
      try {
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(newState));
      } catch (e) {
        console.warn('LocalStorage save error:', e);
      }
      return newState;
    });
  };

  const addStock = (name: string, category: string, initialPrice: number): boolean => {
    if (stateRef.current.stocks.length >= MAX_STOCKS) return false;
    const newStock: StockInfo = {
      id: 'stock-' + Date.now() + '-' + Math.random().toString(36).substring(2, 5),
      name: name.trim(),
      category: category.trim() || '일반주',
      currentPrice: toSafeInt(initialPrice, 5000),
      previousPrice: toSafeInt(initialPrice, 5000),
      changeRate: 0
    };
    setState(prev => {
      const newState = {
        ...prev,
        stocks: [...prev.stocks, newStock]
      };
      syncClassToFirestore(newState);
      return newState;
    });
    return true;
  };

  const deleteStock = (stockId: string): boolean => {
    if (state.stocks.length <= 1) return false;
    setState(prev => {
      const newState = {
        ...prev,
        stocks: prev.stocks.filter(st => st.id !== stockId)
      };
      syncClassToFirestore(newState);
      return newState;
    });
    return true;
  };

  const applyRoundScenario = (scenario: {
    depositRate?: number;
    stockPrices?: Record<string, number>;
    newsMessage?: string;
  }) => {
    setState(prev => {
      let updatedStocks = prev.stocks;
      if (scenario.stockPrices && Object.keys(scenario.stockPrices).length > 0) {
        updatedStocks = prev.stocks.map(st => {
          const newPrice = scenario.stockPrices![st.id];
          if (newPrice !== undefined && !isNaN(newPrice) && newPrice > 0) {
            const prevPrice = st.currentPrice;
            if (newPrice !== prevPrice) {
              const changeRate = prevPrice > 0 ? parseFloat((((newPrice - prevPrice) / prevPrice) * 100).toFixed(1)) : 0;
              return {
                ...st,
                previousPrice: prevPrice,
                currentPrice: newPrice,
                changeRate
              };
            }
          }
          return st;
        });
      }

      const newState: ClassEconomyState = {
        ...prev,
        depositInterestRate: scenario.depositRate !== undefined ? scenario.depositRate : prev.depositInterestRate,
        newsMessage: scenario.newsMessage ? (scenario.newsMessage.startsWith('📢') ? scenario.newsMessage : `📢 ${scenario.newsMessage}`) : prev.newsMessage,
        stocks: updatedStocks
      };

      syncClassToFirestore(newState);
      try {
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(newState));
      } catch (e) {
        console.warn('LocalStorage save error:', e);
      }
      return newState;
    });
  };

  const publishNews = (message: string) => {
    setState(prev => {
      const headline = message.startsWith('📢') || message.startsWith('🚨') ? message : `📢 ${message}`;
      const now = new Date();
      const formattedDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
      
      const newArticle: NewsArticle = {
        id: `news-${Date.now()}`,
        title: message.replace(/^[📢🚨]\s*(\[속보\]\s*)?/, ''),
        content: message.replace(/^[📢🚨]\s*/, ''),
        summary: message.replace(/^[📢🚨]\s*/, ''),
        category: message.includes('[속보]') ? 'special' : 'economy',
        impact: 'neutral',
        publishedRound: prev.currentRound,
        publishedAt: formattedDate,
        author: prev.teacherName ? `${prev.teacherName} 선생님` : '학급경제신문',
        isBreaking: message.includes('[속보]')
      };

      const existingArticles = prev.newsArticles || initialNewsArticles;
      const updatedArticles = [newArticle, ...existingArticles];

      const newState = {
        ...prev,
        newsMessage: headline,
        newsArticles: updatedArticles
      };
      syncClassToFirestore(newState);
      try {
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(newState));
      } catch (e) {
        console.warn('LocalStorage save error:', e);
      }
      return newState;
    });
  };

  const publishNewsArticle = (articleData: Omit<NewsArticle, 'id' | 'publishedAt'> & { id?: string; publishedAt?: string }) => {
    const now = new Date();
    const formattedDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    
    setState(prev => {
      const newArticle: NewsArticle = {
        id: articleData.id || `news-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        title: articleData.title.trim(),
        content: articleData.content.trim(),
        summary: articleData.summary?.trim() || articleData.content.trim().slice(0, 100) + (articleData.content.length > 100 ? '...' : ''),
        category: articleData.category || 'economy',
        relatedStockId: articleData.relatedStockId,
        relatedStockName: articleData.relatedStockName,
        impact: articleData.impact || 'neutral',
        publishedRound: articleData.publishedRound || prev.currentRound,
        publishedAt: articleData.publishedAt || formattedDate,
        author: articleData.author?.trim() || (prev.teacherName ? `${prev.teacherName} 선생님` : '학급경제신문'),
        isBreaking: !!articleData.isBreaking
      };

      const existingArticles = prev.newsArticles || initialNewsArticles;
      const updatedArticles = [newArticle, ...existingArticles.filter(a => a.id !== newArticle.id)];
      const headline = newArticle.isBreaking ? `🚨 [속보] ${newArticle.title}` : `📢 ${newArticle.title}`;
      
      const newState: ClassEconomyState = {
        ...prev,
        newsMessage: headline,
        newsArticles: updatedArticles
      };
      syncClassToFirestore(newState);
      try {
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(newState));
      } catch (e) {
        console.warn('LocalStorage save error:', e);
      }
      return newState;
    });
  };

  const updateNewsArticle = (article: NewsArticle) => {
    setState(prev => {
      const existingArticles = prev.newsArticles || initialNewsArticles;
      const updatedArticles = existingArticles.map(a => a.id === article.id ? article : a);
      const newState: ClassEconomyState = {
        ...prev,
        newsArticles: updatedArticles
      };
      syncClassToFirestore(newState);
      try {
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(newState));
      } catch (e) {
        console.warn('LocalStorage save error:', e);
      }
      return newState;
    });
  };

  const deleteNewsArticle = (articleId: string) => {
    setState(prev => {
      const existingArticles = prev.newsArticles || initialNewsArticles;
      const updatedArticles = existingArticles.filter(a => a.id !== articleId);
      const newState: ClassEconomyState = {
        ...prev,
        newsArticles: updatedArticles
      };
      syncClassToFirestore(newState);
      try {
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(newState));
      } catch (e) {
        console.warn('LocalStorage save error:', e);
      }
      return newState;
    });
  };

  const setRound = (round: number) => {
    setState(prev => {
      const newState = { ...prev, currentRound: Math.max(1, Math.min(prev.totalRounds, round)) };
      syncClassToFirestore(newState);
      return newState;
    });
  };

  const executeSettlement = async (scenarioOptions?: {
    depositRate?: number;
    stockPrices?: Record<string, number>;
    newsMessage?: string;
    targetRoundOverride?: number;
    markScenarioIdExecuted?: string;
    executeSettlement?: boolean;
  }): Promise<boolean> => {
    const currentSnapshot = stateRef.current;
    setPreviousStateBackup(currentSnapshot);
    const undoDeadline = Date.now() + 5 * 60 * 1000;

    // 1. Run server-authoritative settlement (fetches LIVE Firestore balances & stock prices first)
    const atomicRes = await runAtomicTeacherSettlement(
      currentSnapshot.classCode,
      scenarioOptions || {},
      currentSnapshot
    );

    if (atomicRes.ok && atomicRes.students && atomicRes.stocks) {
      setState(prev => {
        const newState: ClassEconomyState = {
          ...prev,
          currentRound: atomicRes.nextRound ?? prev.currentRound,
          depositInterestRate: atomicRes.depositRate ?? prev.depositInterestRate,
          newsMessage: atomicRes.newsMessage ?? prev.newsMessage,
          stocks: atomicRes.stocks!,
          students: atomicRes.students!,
          scheduledScenarios: atomicRes.scheduledScenarios ?? prev.scheduledScenarios,
          transactions: [...(atomicRes.transactions || []), ...prev.transactions],
          undoAvailableUntil: undoDeadline
        };
        try {
          localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(newState));
        } catch (e) {}
        return newState;
      });
      setLastSyncedAt(new Date());
      return true;
    }

    if (!atomicRes.fallbackToLocal) {
      setLastActionError(atomicRes.error || '라운드 정산 중 오류가 발생했습니다.');
      return false;
    }

    // 2. Offline / Quota fallback using strict integer math
    setState(prev => {
      const nextRound = scenarioOptions?.targetRoundOverride !== undefined
        ? Math.min(prev.totalRounds, Math.max(1, scenarioOptions.targetRoundOverride))
        : Math.min(prev.totalRounds, prev.currentRound + 1);
      const effectiveDepositRate = scenarioOptions?.depositRate !== undefined ? scenarioOptions.depositRate : prev.depositInterestRate;
      const shouldSettle = scenarioOptions?.executeSettlement !== false;

      let updatedStocks = prev.stocks;
      if (scenarioOptions?.stockPrices && Object.keys(scenarioOptions.stockPrices).length > 0) {
        updatedStocks = prev.stocks.map(st => {
          const newPrice = scenarioOptions.stockPrices![st.id];
          if (newPrice !== undefined && !isNaN(newPrice) && newPrice > 0) {
            const cleanPrice = toSafeInt(newPrice, st.currentPrice);
            const prevPrice = toSafeInt(st.currentPrice, cleanPrice);
            const changeRate = prevPrice > 0 ? parseFloat((((cleanPrice - prevPrice) / prevPrice) * 100).toFixed(1)) : 0;
            return {
              ...st,
              previousPrice: prevPrice,
              currentPrice: cleanPrice,
              changeRate
            };
          }
          return st;
        });
      }

      const effectiveNews = scenarioOptions?.newsMessage && scenarioOptions.newsMessage.trim()
        ? (scenarioOptions.newsMessage.trim().startsWith('📢') || scenarioOptions.newsMessage.trim().startsWith('🚨')
            ? scenarioOptions.newsMessage.trim()
            : `📢 ${scenarioOptions.newsMessage.trim()}`)
        : prev.newsMessage;

      const newTransactions: Transaction[] = [];
      const nowIso = new Date().toISOString();
      const nowMs = Date.now();

      const updatedStudents = prev.students.map(student => {
        const liveCash = toSafeInt(student.cash);
        const liveSavings = toSafeInt(student.savings);
        const liveDebt = toSafeInt(student.debt);
        const liveShares = sanitizeStockSharesMap(student.stockShares);

        const earnedInterest = shouldSettle ? toSafeInt(liveSavings * (effectiveDepositRate / 100)) : 0;
        const newSavings = liveSavings + earnedInterest;
        const stockVal = toSafeInt(updatedStocks.reduce((sum, st) => sum + (liveShares[st.id] || 0) * (st.currentPrice || 0), 0));
        const totalAssets = Math.round(liveCash + newSavings + stockVal - liveDebt);

        const prevSnapshots = Array.isArray(student.roundHistory) ? [...student.roundHistory] : [];
        const prevSnap = prevSnapshots.find(s => s.round === prev.currentRound - 1);
        const prevTotal = prevSnap ? prevSnap.totalAssets : (liveCash + liveSavings);
        const changeAmount = totalAssets - prevTotal;
        const changeRate = prevTotal > 0 ? parseFloat(((changeAmount / prevTotal) * 100).toFixed(1)) : 0;

        const newSnapshot: StudentRoundSnapshot = {
          round: prev.currentRound,
          cash: liveCash,
          savings: newSavings,
          stockValue: stockVal,
          debt: liveDebt,
          totalAssets,
          changeAmount,
          changeRate,
          timestamp: nowIso.replace('T', ' ').substring(0, 16),
          notes: shouldSettle
            ? (earnedInterest > 0 ? `이자 +${earnedInterest.toLocaleString()}${prev.currencyUnit || '원'} 지급` : '정산 완료')
            : `Round ${nextRound} 예약 시나리오 전환`
        };

        const filteredHistory = prevSnapshots.filter(s => s.round !== prev.currentRound);
        const updatedRoundHistory = [...filteredHistory, newSnapshot].sort((a, b) => a.round - b.round);

        if (earnedInterest > 0) {
          newTransactions.push({
            id: `tx-interest-${nowMs}-${student.id}`,
            studentId: student.id,
            studentName: student.name,
            type: 'deposit',
            amount: earnedInterest,
            round: prev.currentRound,
            description: `Round ${prev.currentRound} 예금 이자 지급 (+${effectiveDepositRate.toFixed(1)}%)`,
            timestamp: new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })
          });
        }

        return {
          ...student,
          cash: liveCash,
          savings: newSavings,
          debt: liveDebt,
          stockShares: liveShares,
          roundHistory: updatedRoundHistory,
          recentActivity: earnedInterest > 0
            ? `Round ${prev.currentRound} 예금 이자 +${earnedInterest.toLocaleString()}${prev.currencyUnit || '원'}`
            : `Round ${nextRound} 시작 (자산 변동 갱신)`,
          balanceVersion: (student.balanceVersion || 0) + 1,
          updatedAtMs: nowMs
        };
      });

      const updatedScenarios = scenarioOptions?.markScenarioIdExecuted
        ? (prev.scheduledScenarios || []).map(sc =>
            sc.id === scenarioOptions.markScenarioIdExecuted
              ? { ...sc, status: 'executed' as const, executedAt: nowIso, updatedAt: nowIso }
              : sc
          )
        : prev.scheduledScenarios;

      syncMultipleStudentProfilesFromTeacher(prev.classCode, updatedStudents);

      const newState: ClassEconomyState = {
        ...prev,
        currentRound: nextRound,
        depositInterestRate: effectiveDepositRate,
        newsMessage: effectiveNews,
        stocks: updatedStocks,
        students: updatedStudents,
        scheduledScenarios: updatedScenarios,
        transactions: [...newTransactions, ...prev.transactions],
        undoAvailableUntil: undoDeadline
      };

      syncClassToFirestore(newState);
      try {
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(newState));
      } catch (e) {}
      return newState;
    });
    return true;
  };

  const restorePreviousState = () => {
    if (previousStateBackup) {
      syncClassToFirestore(previousStateBackup);
      if (previousStateBackup.classCode && previousStateBackup.students?.length > 0) {
        syncMultipleStudentProfilesFromTeacher(previousStateBackup.classCode, previousStateBackup.students);
      }
      setState(previousStateBackup);
      setPreviousStateBackup(null);
    }
  };

  const applyFineOrReward = async (
    type: 'fine' | 'reward',
    amount: number,
    reason: string,
    targetStudentIds: string[]
  ): Promise<FineRewardResultSummary | null> => {
    if (amount <= 0 || targetStudentIds.length === 0) return null;

    const roundAmount = Math.max(1, toSafeInt(amount, 0));
    const effectiveReason = reason.trim() || (type === 'reward' ? '학급 활동 상금' : '학급 규칙 위반 벌금');
    const curState = stateRef.current;

    // 1. Server-authoritative per-student Firestore atomic transactions
    const atomicRes = await runAtomicFineOrReward(
      curState.classCode,
      type,
      roundAmount,
      effectiveReason,
      targetStudentIds,
      curState.students,
      curState.stocks,
      curState.currencyUnit || '원',
      curState.currentRound
    );

    if (atomicRes.ok && atomicRes.summary && atomicRes.updatedStudentsMap) {
      const updatedMap = atomicRes.updatedStudentsMap;
      const generatedTxs = atomicRes.transactions || [];
      setState(prev => {
        const newState: ClassEconomyState = {
          ...prev,
          students: prev.students.map(s => updatedMap[s.id] || s),
          transactions: [...generatedTxs, ...prev.transactions]
        };
        try {
          localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(newState));
        } catch (e) {}
        return newState;
      });
      setLastFineRewardSummary(atomicRes.summary);
      return atomicRes.summary;
    }

    if (!atomicRes.fallbackToLocal) {
      setLastActionError(atomicRes.error || '상벌금 적용 중 오류가 발생했습니다.');
      return null;
    }

    // 2. Offline / Quota fallback with strict integer math
    let calculatedSummary: FineRewardResultSummary | null = null;
    setState(prev => {
      const generatedTxs: Transaction[] = [];
      const updatedTargets: Student[] = [];
      const records: StudentFineRewardRecord[] = [];
      const currencyUnit = prev.currencyUnit || '원';

      let totalCashDeducted = 0;
      let totalSavingsDeducted = 0;
      let totalStockLiquidated = 0;
      let totalNewDebt = 0;
      let totalDebtRepaid = 0;

      const updatedStudents = prev.students.map(s => {
        if (!targetStudentIds.includes(s.id)) return s;

        const liveCash = toSafeInt(s.cash);
        const liveSavings = toSafeInt(s.savings);
        const liveDebt = toSafeInt(s.debt);
        const liveShares = sanitizeStockSharesMap(s.stockShares);

        if (type === 'reward') {
          let debtRepaid = 0;
          let cashAdded = roundAmount;

          if (liveDebt > 0) {
            debtRepaid = Math.min(liveDebt, roundAmount);
            cashAdded = roundAmount - debtRepaid;
          }

          const newDebt = liveDebt - debtRepaid;
          const newCash = liveCash + cashAdded;
          totalDebtRepaid += debtRepaid;

          let desc = `[상금] ${effectiveReason} (+${roundAmount.toLocaleString()}${currencyUnit})`;
          let activity = `상금 +${roundAmount.toLocaleString()}${currencyUnit}`;

          if (debtRepaid > 0) {
            if (cashAdded > 0) {
              desc = `[상금] ${effectiveReason} (+${roundAmount.toLocaleString()}${currencyUnit}: 부채 상환 ${debtRepaid.toLocaleString()}${currencyUnit}, 잔여 현금 +${cashAdded.toLocaleString()}${currencyUnit})`;
              activity = `상금 지급 (부채 -${debtRepaid.toLocaleString()}${currencyUnit}, 현금 +${cashAdded.toLocaleString()}${currencyUnit})`;
            } else {
              desc = `[상금] ${effectiveReason} (+${roundAmount.toLocaleString()}${currencyUnit}: 전액 부채 상환, 남은 빚 ${newDebt.toLocaleString()}${currencyUnit})`;
              activity = `상금 전액 부채 상환 (-${debtRepaid.toLocaleString()}${currencyUnit})`;
            }
          }

          const updated: Student = {
            ...s,
            cash: newCash,
            debt: newDebt,
            recentActivity: activity,
            balanceVersion: (s.balanceVersion || 0) + 1,
            updatedAtMs: Date.now()
          };
          updatedTargets.push(updated);
          generatedTxs.push(logTx(s.id, s.name, 'reward', roundAmount, desc));
          records.push({
            studentId: s.id,
            studentName: s.name,
            studentNumber: s.number,
            type: 'reward',
            amount: roundAmount,
            cashDeducted: 0,
            savingsDeducted: 0,
            stockLiquidatedAmt: 0,
            liquidatedStocks: [],
            newDebtIncurred: 0,
            debtRepaid,
            finalDebt: newDebt,
            finalCash: newCash,
            finalSavings: liveSavings
          });
          return updated;
        }

        let remainingFine = roundAmount;
        let cashDeducted = 0;
        let savingsDeducted = 0;
        let stockLiquidatedAmt = 0;
        let newDebtIncurred = 0;
        const liquidatedStocks: LiquidatedStockItem[] = [];

        if (liveCash >= remainingFine) {
          cashDeducted = remainingFine;
          remainingFine = 0;
        } else {
          cashDeducted = liveCash;
          remainingFine -= liveCash;
        }
        const updatedCash = liveCash - cashDeducted;
        totalCashDeducted += cashDeducted;

        if (remainingFine > 0) {
          if (liveSavings >= remainingFine) {
            savingsDeducted = remainingFine;
            remainingFine = 0;
          } else {
            savingsDeducted = liveSavings;
            remainingFine -= liveSavings;
          }
        }
        const updatedSavings = liveSavings - savingsDeducted;
        totalSavingsDeducted += savingsDeducted;

        const updatedShares: Record<string, number> = { ...liveShares };
        if (remainingFine > 0 && prev.stocks && prev.stocks.length > 0) {
          for (const st of prev.stocks) {
            if (remainingFine <= 0) break;
            const sharesHeld = toSafeShares(updatedShares[st.id] || 0);
            const price = st.currentPrice || 0;
            if (sharesHeld > 0 && price > 0) {
              const holdingVal = calcSellReturnFromShares(sharesHeld, price);
              if (holdingVal <= 0) continue;
              if (holdingVal <= remainingFine) {
                stockLiquidatedAmt += holdingVal;
                remainingFine -= holdingVal;
                updatedShares[st.id] = 0;
                liquidatedStocks.push({ stockId: st.id, stockName: st.name, shares: sharesHeld, amount: holdingVal });
              } else {
                const soldVal = remainingFine;
                const actualSold = Math.min(sharesHeld, calcSellSharesFromAmount(soldVal, price));
                stockLiquidatedAmt += soldVal;
                remainingFine = 0;
                updatedShares[st.id] = toSafeShares(sharesHeld - actualSold);
                liquidatedStocks.push({ stockId: st.id, stockName: st.name, shares: actualSold, amount: soldVal });
              }
            }
          }
        }
        totalStockLiquidated += stockLiquidatedAmt;

        if (remainingFine > 0) {
          newDebtIncurred = remainingFine;
          remainingFine = 0;
        }
        totalNewDebt += newDebtIncurred;

        const finalDebt = liveDebt + newDebtIncurred;

        const breakdownParts: string[] = [];
        if (cashDeducted > 0) breakdownParts.push(`현금 -${cashDeducted.toLocaleString()}${currencyUnit}`);
        if (savingsDeducted > 0) breakdownParts.push(`저축 자동인출 -${savingsDeducted.toLocaleString()}${currencyUnit}`);
        if (stockLiquidatedAmt > 0) {
          const stockNamesDetail = liquidatedStocks
            .map(d => `${d.stockName} ${Number.isInteger(d.shares) ? `${d.shares}주` : `${parseFloat(d.shares.toFixed(4))}주`}`)
            .join(', ');
          breakdownParts.push(`주식 자동매각 -${stockLiquidatedAmt.toLocaleString()}${currencyUnit}(${stockNamesDetail})`);
        }
        if (newDebtIncurred > 0) breakdownParts.push(`부채(빚) +${newDebtIncurred.toLocaleString()}${currencyUnit} 발생`);

        const breakdownStr = breakdownParts.length > 0 ? ` (${breakdownParts.join(', ')})` : '';
        const txDesc = `[벌금] ${effectiveReason} (-${roundAmount.toLocaleString()}${currencyUnit})${breakdownStr}`;

        let activityStr = `벌금 -${roundAmount.toLocaleString()}${currencyUnit}`;
        if (newDebtIncurred > 0) {
          activityStr = `벌금 부과 (부채 +${newDebtIncurred.toLocaleString()}${currencyUnit} 발생)`;
        } else if (stockLiquidatedAmt > 0) {
          activityStr = `벌금 부과 (주식 ${stockLiquidatedAmt.toLocaleString()}${currencyUnit} 자동매각)`;
        } else if (savingsDeducted > 0) {
          activityStr = `벌금 부과 (저축 ${savingsDeducted.toLocaleString()}${currencyUnit} 인출)`;
        }

        const updated: Student = {
          ...s,
          cash: updatedCash,
          savings: updatedSavings,
          stockShares: sanitizeStockSharesMap(updatedShares),
          debt: finalDebt,
          recentActivity: activityStr,
          balanceVersion: (s.balanceVersion || 0) + 1,
          updatedAtMs: Date.now()
        };
        updatedTargets.push(updated);
        generatedTxs.push(logTx(s.id, s.name, 'fine', roundAmount, txDesc));
        records.push({
          studentId: s.id,
          studentName: s.name,
          studentNumber: s.number,
          type: 'fine',
          amount: roundAmount,
          cashDeducted,
          savingsDeducted,
          stockLiquidatedAmt,
          liquidatedStocks,
          newDebtIncurred,
          debtRepaid: 0,
          finalDebt,
          finalCash: updatedCash,
          finalSavings: updatedSavings
        });
        return updated;
      });

      syncMultipleStudentProfilesFromTeacher(prev.classCode, updatedTargets);

      calculatedSummary = {
        type,
        amount: roundAmount,
        reason: effectiveReason,
        targetCount: targetStudentIds.length,
        totalCashDeducted,
        totalSavingsDeducted,
        totalStockLiquidated,
        totalNewDebt,
        totalDebtRepaid,
        records
      };

      const newState = {
        ...prev,
        students: updatedStudents,
        transactions: [...generatedTxs, ...prev.transactions]
      };
      syncClassToFirestore(newState);
      return newState;
    });

    if (calculatedSummary) {
      setLastFineRewardSummary(calculatedSummary);
    }
    return calculatedSummary;
  };

  const approvePinReset = (studentId: string, customPin: string = '0000') => {
    const cleanPin = customPin.trim() || '0000';
    let updatedTarget: Student | null = null;

    setState(prev => {
      const updatedStudents = prev.students.map(s => {
        if (s.id === studentId) {
          updatedTarget = {
            ...s,
            pin: cleanPin,
            isPinChanged: cleanPin !== '1234',
            pinResetRequested: false,
            recentActivity: `PIN [${cleanPin}] 초기화 완료`
          };
          return updatedTarget;
        }
        return s;
      });

      if (updatedTarget) {
        syncStudentNonBalanceFieldsFromTeacher(prev.classCode, updatedTarget.id, {
          pin: updatedTarget.pin,
          isPinChanged: updatedTarget.isPinChanged,
          pinResetRequested: updatedTarget.pinResetRequested,
          recentActivity: updatedTarget.recentActivity
        });
      }

      return {
        ...prev,
        students: updatedStudents
      };
    });
  };

  const requestPinReset = async (
    studentIdentifier: string,
    classCode?: string
  ): Promise<{ success: boolean; message?: string }> => {
    const rawCleanId = normalizeFullWidthDigits(String(studentIdentifier || '')).trim();
    const inputCode = normalizeClassCode(classCode);
    const effectiveCode = inputCode || normalizeClassCode(state.classCode) || 'C-10001';
    if (!rawCleanId) {
      return { success: false, message: '학생 이름 또는 번호를 입력해 주세요.' };
    }

    try {
      const candidateList = await getAvailableStudentsForClass(effectiveCode);
      const target = matchStudentIdentifier(candidateList, rawCleanId);

      if (!target) {
        return { success: false, message: `'${rawCleanId}' 학생을 찾을 수 없습니다. 이름이나 번호와 학급 코드(${effectiveCode})를 다시 확인해 주세요.` };
      }

      const updated: Student = {
        ...sanitizeStudent(target),
        pinResetRequested: true,
        recentActivity: '선생님께 PIN 비밀번호 재설정 요청함'
      };

      try {
        await syncStudentNonBalanceFieldsFromTeacher(effectiveCode, updated.id, {
          pinResetRequested: updated.pinResetRequested,
          recentActivity: updated.recentActivity
        });
      } catch (e) {
        console.warn('syncStudentNonBalanceFieldsFromTeacher error:', e);
      }

      setState(prev => ({
        ...prev,
        students: (prev.students || []).map(s => (s.id === target.id ? updated : s))
      }));

      try {
        const localCached = (candidateList || []).map(s => s.id === target.id ? updated : s);
        localStorage.setItem('kidsrich_students_' + effectiveCode, JSON.stringify(localCached));
      } catch (e) {}

      return { success: true, message: `${target.name} 학생의 PIN 재설정 요청이 담임선생님께 전송되었습니다.` };
    } catch (err: any) {
      console.error('requestPinReset error:', err);
      return { success: false, message: 'PIN 재설정 요청 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.' };
    }
  };

  const changeStudentPin = (studentId: string, newPin: string): { success: boolean; message?: string } => {
    const cleanPin = newPin.trim();
    if (!cleanPin || cleanPin.length < 4 || cleanPin.length > 6) {
      return { success: false, message: '비밀번호(PIN)는 4~6자리로 입력해 주세요.' };
    }
    const student = state.students.find(s => s.id === studentId);
    if (!student) {
      return { success: false, message: '학생 정보를 찾을 수 없습니다.' };
    }

    const updated: Student = {
      ...student,
      pin: cleanPin,
      isPinChanged: true,
      pinResetRequested: false,
      recentActivity: '비밀번호(PIN) 직접 변경 완료'
    };

    syncStudentNonBalanceFieldsFromTeacher(state.classCode, updated.id, {
      pin: updated.pin,
      isPinChanged: updated.isPinChanged,
      pinResetRequested: updated.pinResetRequested,
      recentActivity: updated.recentActivity
    });

    setState(prev => {
      const updatedStudents = prev.students.map(s => (s.id === studentId ? updated : s));
      return {
        ...prev,
        students: updatedStudents
      };
    });
    return { success: true, message: '비밀번호(PIN)가 성공적으로 변경되었습니다.' };
  };

  const updateStudentPinByTeacher = (studentId: string, newPin: string): { success: boolean; message?: string } => {
    const cleanPin = newPin.trim();
    if (!cleanPin || cleanPin.length < 4 || cleanPin.length > 6) {
      return { success: false, message: '새 PIN 비밀번호는 4~6자리로 입력해 주세요.' };
    }
    const student = state.students.find(s => s.id === studentId);
    if (!student) {
      return { success: false, message: '학생 정보를 찾을 수 없습니다.' };
    }

    const updated: Student = {
      ...student,
      pin: cleanPin,
      isPinChanged: true,
      pinResetRequested: false,
      recentActivity: `선생님에 의해 PIN(${cleanPin})으로 변경됨`
    };

    syncStudentNonBalanceFieldsFromTeacher(state.classCode, updated.id, {
      pin: updated.pin,
      isPinChanged: updated.isPinChanged,
      pinResetRequested: updated.pinResetRequested,
      recentActivity: updated.recentActivity
    });

    setState(prev => {
      const updatedStudents = prev.students.map(s => (s.id === studentId ? updated : s));
      return {
        ...prev,
        students: updatedStudents
      };
    });
    return { success: true, message: `${student.name} 학생의 PIN이 [${cleanPin}]으로 변경되었습니다.` };
  };

  const updateMultipleStudentsPinByTeacher = (
    studentIds: string[],
    newPin: string
  ): { success: boolean; message?: string } => {
    if (!studentIds || studentIds.length === 0) {
      return { success: false, message: '선택된 학생이 없습니다.' };
    }
    const cleanPin = newPin.trim();
    if (!cleanPin || cleanPin.length < 4 || cleanPin.length > 6) {
      return { success: false, message: '새 PIN 비밀번호는 4~6자리로 입력해 주세요.' };
    }

    const updatedTargets: Student[] = [];

    setState(prev => {
      const updatedStudents = prev.students.map(s => {
        if (studentIds.includes(s.id)) {
          const updated: Student = {
            ...s,
            pin: cleanPin,
            isPinChanged: true,
            pinResetRequested: false,
            recentActivity: `선생님에 의해 PIN(${cleanPin})으로 일괄 변경됨`
          };
          updatedTargets.push(updated);
          return updated;
        }
        return s;
      });

      if (updatedTargets.length > 0) {
        syncMultipleStudentNonBalanceFieldsFromTeacher(
          prev.classCode,
          updatedTargets.map(u => ({
            studentId: u.id,
            fields: {
              pin: u.pin,
              isPinChanged: u.isPinChanged,
              pinResetRequested: u.pinResetRequested,
              recentActivity: u.recentActivity
            }
          }))
        );
      }

      return {
        ...prev,
        students: updatedStudents
      };
    });

    return {
      success: true,
      message: `${studentIds.length}명 학생의 비밀번호(PIN)가 [${cleanPin}]으로 일괄 변경되었습니다.`
    };
  };

  const resetAllPins = (defaultPin: string = '1234') => {
    const cleanPin = defaultPin.trim() || '1234';
    const updatedList: Student[] = [];

    setState(prev => {
      const updatedStudents = prev.students.map(s => {
        const updated: Student = {
          ...s,
          pin: cleanPin,
          isPinChanged: cleanPin !== '1234',
          pinResetRequested: false,
          recentActivity: `전체 PIN [${cleanPin}] 초기화`
        };
        updatedList.push(updated);
        return updated;
      });

      if (updatedList.length > 0) {
        syncMultipleStudentNonBalanceFieldsFromTeacher(
          prev.classCode,
          updatedList.map(u => ({
            studentId: u.id,
            fields: {
              pin: u.pin,
              isPinChanged: u.isPinChanged,
              pinResetRequested: u.pinResetRequested,
              recentActivity: u.recentActivity
            }
          }))
        );
      }

      return {
        ...prev,
        students: updatedStudents
      };
    });
  };

  const addStudent = (name: string, username?: string, pin?: string, initialCash: number = 30000) => {
    setState(prev => {
      const maxNum = prev.students.reduce((max, s) => Math.max(max, Number(s.number) || 0), 0);
      const nextNum = maxNum + 1;
      const id = `student_${Date.now()}_${nextNum}`;
      const newStudent: Student = {
        id,
        number: nextNum,
        name: name.trim(),
        username: username?.trim() || `student_${String(nextNum).padStart(2, '0')}`,
        pin: pin?.trim() || '1234',
        cash: initialCash >= 0 ? initialCash : 30000,
        savings: 0,
        debt: 0,
        stockShares: {},
        lastActive: '접속 이력 없음',
        isOnline: false,
        pinResetRequested: false,
        recentActivity: '계정 생성됨',
        couponsOwned: []
      };
      syncStudentToFirestore(prev.classCode, newStudent);
      const { unique } = deduplicateStudents([...prev.students, newStudent]);
      return {
        ...prev,
        students: unique
      };
    });
  };

  const addBulkStudents = (names: string[], initialCash: number = 30000) => {
    if (!names || names.length === 0) return;
    setState(prev => {
      let maxNum = prev.students.reduce((max, s) => Math.max(max, Number(s.number) || 0), 0);
      const newStudentsList: Student[] = [];

      names.forEach((rawName, idx) => {
        const cleanName = rawName.trim();
        if (!cleanName) return;
        maxNum += 1;
        const num = maxNum;
        const numStr = String(num).padStart(2, '0');
        const st: Student = {
          id: `student_${Date.now()}_${idx}_${num}`,
          number: num,
          name: cleanName,
          username: `student_${numStr}`,
          pin: '1234',
          cash: initialCash >= 0 ? initialCash : 30000,
          savings: 0,
          debt: 0,
          stockShares: {},
          lastActive: '접속 이력 없음',
          isOnline: false,
          pinResetRequested: false,
          recentActivity: '계정 생성됨',
          couponsOwned: []
        };
        newStudentsList.push(st);
      });

      saveMultipleStudentsToFirestore(prev.classCode, newStudentsList);

      const { unique } = deduplicateStudents([...prev.students, ...newStudentsList]);
      return {
        ...prev,
        students: unique
      };
    });
  };

  const createNumberedStudents = (count: number, initialCash: number = 30000) => {
    if (count <= 0) return;
    setState(prev => {
      let maxNum = prev.students.reduce((max, s) => Math.max(max, Number(s.number) || 0), 0);
      const newStudentsList: Student[] = [];

      for (let i = 1; i <= count; i++) {
        maxNum += 1;
        const num = maxNum;
        const numStr = String(num).padStart(2, '0');
        const st: Student = {
          id: `student_${Date.now()}_${i}_${num}`,
          number: num,
          name: `${num}번 학생`,
          username: `student_${numStr}`,
          pin: '1234',
          cash: initialCash >= 0 ? initialCash : 30000,
          savings: 0,
          debt: 0,
          stockShares: {},
          lastActive: '접속 이력 없음',
          isOnline: false,
          pinResetRequested: false,
          recentActivity: '계정 생성됨',
          couponsOwned: []
        };
        newStudentsList.push(st);
      }

      saveMultipleStudentsToFirestore(prev.classCode, newStudentsList);

      const { unique } = deduplicateStudents([...prev.students, ...newStudentsList]);
      return {
        ...prev,
        students: unique
      };
    });
  };

  const deleteStudent = async (studentId: string): Promise<boolean> => {
    if (!studentId) return false;
    const currentCode = stateRef.current.classCode;

    // 1. 즉시 로컬 상태 반영 (UI 즉각 갱신)
    let remaining: Student[] = [];
    setState(prev => {
      remaining = prev.students
        .filter(s => s.id !== studentId)
        .map((s, idx) => ({ ...s, number: idx + 1 }));
      return {
        ...prev,
        students: remaining
      };
    });

    if (currentStudentId === studentId) {
      setCurrentStudentId('');
    }

    // 2. Firestore 문서 삭제
    try {
      const ok = await deleteStudentFromFirestore(currentCode, studentId);
      // 번호가 재정렬된 남은 학생들의 비금전 프로필(번호 등)만 안전하게 동기화 (학생 실시간 잔액 보호)
      if (remaining.length > 0) {
        await syncMultipleStudentNonBalanceFieldsFromTeacher(
          currentCode,
          remaining.map(r => ({
            studentId: r.id,
            fields: { number: r.number }
          }))
        );
      }
      return ok;
    } catch (err) {
      console.warn('deleteStudent Firestore error:', err);
      return false;
    }
  };

  const deleteMultipleStudents = async (studentIds: string[]): Promise<boolean> => {
    if (!studentIds || studentIds.length === 0) return false;
    const currentCode = stateRef.current.classCode;
    const targetSet = new Set(studentIds);

    // 1. 즉시 로컬 상태 반영 (UI 즉각 갱신)
    let remaining: Student[] = [];
    setState(prev => {
      remaining = prev.students
        .filter(s => !targetSet.has(s.id))
        .map((s, idx) => ({ ...s, number: idx + 1 }));
      return {
        ...prev,
        students: remaining
      };
    });

    if (targetSet.has(currentStudentId)) {
      setCurrentStudentId('');
    }

    // 2. Firestore 일괄 삭제 (Batch Delete)
    try {
      const ok = await deleteMultipleStudentsFromFirestore(currentCode, studentIds);
      // 번호가 재정렬된 남은 학생들의 비금전 프로필(번호 등)만 안전하게 동기화 (학생 실시간 잔액 보호)
      if (remaining.length > 0) {
        await syncMultipleStudentNonBalanceFieldsFromTeacher(
          currentCode,
          remaining.map(r => ({
            studentId: r.id,
            fields: { number: r.number }
          }))
        );
      }
      return ok;
    } catch (err) {
      console.warn('deleteMultipleStudents Firestore error:', err);
      return false;
    }
  };

  /**
   * Identifies and purges any duplicate student accounts (especially 1~5 duplicates),
   * permanently deleting the duplicate documents from Firestore and updating local state.
   */
  const removeDuplicateStudents = async (): Promise<{ removedCount: number; removedNames: string[] }> => {
    const currentCode = stateRef.current.classCode;
    const currentStudents = stateRef.current.students || [];
    const { unique, duplicateIds, duplicateStudents } = deduplicateStudents(currentStudents);

    if (duplicateIds.length === 0) {
      return { removedCount: 0, removedNames: [] };
    }

    const removedNames = duplicateStudents.map(s => `${s.number}번 ${s.name} (${s.username})`);

    setState(prev => {
      const nextState = {
        ...prev,
        students: unique
      };
      try {
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(nextState));
      } catch (e) {
        console.warn('LocalStorage save error in removeDuplicateStudents:', e);
      }
      return nextState;
    });

    if (currentCode && duplicateIds.length > 0) {
      try {
        await deleteMultipleStudentsFromFirestore(currentCode, duplicateIds);
        console.info(`[KidsRich] Permanently removed ${duplicateIds.length} duplicate student documents from Firestore.`);
      } catch (err) {
        console.warn('Failed to delete duplicate students from Firestore:', err);
      }
    }

    return { removedCount: duplicateIds.length, removedNames };
  };

  const deleteTransaction = async (txId: string): Promise<boolean> => {
    if (!txId) return false;
    const currentCode = stateRef.current.classCode;
    setState(prev => ({
      ...prev,
      transactions: prev.transactions.filter(t => t.id !== txId)
    }));
    try {
      return await deleteTransactionFromFirestore(currentCode, txId);
    } catch (err) {
      console.warn('deleteTransaction error:', err);
      return false;
    }
  };

  const deleteMultipleTransactions = async (txIds: string[]): Promise<boolean> => {
    if (!txIds || txIds.length === 0) return false;
    const currentCode = stateRef.current.classCode;
    const targetSet = new Set(txIds);
    setState(prev => ({
      ...prev,
      transactions: prev.transactions.filter(t => !targetSet.has(t.id))
    }));
    try {
      return await deleteMultipleTransactionsFromFirestore(currentCode, txIds);
    } catch (err) {
      console.warn('deleteMultipleTransactions error:', err);
      return false;
    }
  };

  const clearAllTransactions = async (): Promise<boolean> => {
    const currentCode = stateRef.current.classCode;
    setState(prev => ({
      ...prev,
      transactions: []
    }));
    try {
      return await clearAllTransactionsFromFirestore(currentCode);
    } catch (err) {
      console.warn('clearAllTransactions error:', err);
      return false;
    }
  };

  const addShopItem = (item: Omit<ShopItem, 'id'>) => {
    const newItem: ShopItem = {
      ...item,
      id: 'shop-' + Date.now()
    };
    setState(prev => {
      const newState = {
        ...prev,
        shopItems: [...prev.shopItems, newItem]
      };
      syncClassToFirestore(newState);
      return newState;
    });
  };

  const deleteShopItem = (itemId: string) => {
    setState(prev => {
      const newState = {
        ...prev,
        shopItems: prev.shopItems.filter(item => item.id !== itemId)
      };
      syncClassToFirestore(newState);
      return newState;
    });
  };

  const resetAllData = async () => {
    localStorage.removeItem(LOCAL_STORAGE_KEY);
    localStorage.removeItem('kidsrich_school_state');
    const freshState: ClassEconomyState = {
      ...initialClassState,
      students: initialStudents
    };
    setState(freshState);
    setCurrentStudentId('');
    try {
      await clearAllStudentsFromFirestore(freshState.classCode);
      await saveMultipleStudentsToFirestore(freshState.classCode, initialStudents);
      await syncClassToFirestore(freshState);
    } catch (e) {
      console.warn('resetAllData Firestore sync error:', e);
    }
  };

  /**
   * Scans all students (against live Firestore if online), sanitizes floating-point currency drift,
   * eliminates invalid share residuals, deduplicates students, and persists cleaned balances.
   */
  const repairAllStudentBalancesConsistency = async (): Promise<{ fixedCount: number; details: string[] }> => {
    const classCode = stateRef.current.classCode;
    const details: string[] = [];
    let fixedCount = 0;

    let baseStudents = stateRef.current.students || [];
    try {
      const remoteStudents = await getStudentsFromFirestore(classCode);
      if (Array.isArray(remoteStudents) && remoteStudents.length > 0) {
        const existingMap = new Map<string, Student>(baseStudents.map(s => [s.id, s]));
        baseStudents = remoteStudents.map(rs => mergeStudentKeepingNewerBalance(existingMap.get(rs.id), rs));
      }
    } catch (e) {
      console.warn('repairAllStudentBalancesConsistency remote fetch fallback:', e);
    }

    const { unique, duplicateIds } = deduplicateStudents(baseStudents);
    if (duplicateIds.length > 0) {
      fixedCount += duplicateIds.length;
      details.push(`중복 학생 계정 ${duplicateIds.length}개 정리`);
      if (classCode) {
        deleteMultipleStudentsFromFirestore(classCode, duplicateIds).catch(console.warn);
      }
    }

    const cleanedList: Student[] = unique.map(raw => {
      const safeCash = toSafeInt(raw.cash, 0);
      const safeSavings = toSafeInt(raw.savings, 0);
      const safeDebt = toSafeInt(raw.debt, 0);
      const safeShares = sanitizeStockSharesMap(raw.stockShares);

      const issues: string[] = [];
      if (raw.cash !== safeCash) issues.push(`현금 ${raw.cash}→${safeCash}`);
      if (raw.savings !== safeSavings) issues.push(`예금 ${raw.savings}→${safeSavings}`);
      if ((raw.debt || 0) !== safeDebt) issues.push(`부채 ${raw.debt || 0}→${safeDebt}`);
      if (JSON.stringify(raw.stockShares || {}) !== JSON.stringify(safeShares)) issues.push('소수점/잔여 주식 정리');

      if (issues.length > 0) {
        fixedCount++;
        details.push(`${raw.number}번 ${raw.name}: ${issues.join(', ')}`);
      }

      return {
        ...sanitizeStudent(raw),
        cash: safeCash,
        savings: safeSavings,
        debt: safeDebt,
        stockShares: safeShares,
        balanceVersion: (raw.balanceVersion || 0) + (issues.length > 0 ? 1 : 0),
        updatedAtMs: issues.length > 0 ? Date.now() : raw.updatedAtMs
      };
    });

    setState(prev => {
      const nextState: ClassEconomyState = { ...prev, students: cleanedList };
      try {
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(nextState));
        if (classCode) localStorage.setItem('kidsrich_students_' + classCode, JSON.stringify(cleanedList));
      } catch (e) {}
      return nextState;
    });

    if (classCode && cleanedList.length > 0) {
      try {
        await saveMultipleStudentsToFirestore(classCode, cleanedList);
      } catch (e) {
        console.warn('repairAllStudentBalancesConsistency sync error:', e);
      }
    }

    setLastSyncedAt(new Date());
    return { fixedCount, details };
  };

  /**
   * Upserts a Scheduled Round Scenario (up to MAX_SCHEDULED_SCENARIOS = 5 pending rounds)
   * Auto-saved immediately to both localStorage and Firestore.
   */
  const upsertScheduledScenario = (scenarioInput: {
    id?: string;
    targetRound: number;
    scheduledAt: string;
    depositRate: number;
    stockPrices: Record<string, number>;
    newsMessage: string;
    newsArticleTitle?: string;
    executeSettlementOnTrigger: boolean;
    status?: ScheduledRoundScenario['status'];
  }): { success: boolean; message?: string; scenario?: ScheduledRoundScenario } => {
    const curState = stateRef.current;
    const cleanRound = Math.max(curState.currentRound + 1, Math.min(curState.totalRounds, Math.round(scenarioInput.targetRound)));
    const parsedTime = scenarioInput.scheduledAt ? new Date(scenarioInput.scheduledAt).getTime() : NaN;
    if (!Number.isFinite(parsedTime)) {
      return { success: false, message: '올바른 예약 날짜 및 시간을 선택해 주세요.' };
    }

    const existingList = Array.isArray(curState.scheduledScenarios) ? [...curState.scheduledScenarios] : [];
    const existingByIdOrRound = existingList.find(
      s => (scenarioInput.id && s.id === scenarioInput.id) || (s.targetRound === cleanRound && s.status !== 'cancelled')
    );

    const activePendingOthers = existingList.filter(
      s => s.status === 'pending' && s.id !== existingByIdOrRound?.id && s.targetRound !== cleanRound
    );
    const nextStatus = scenarioInput.status || existingByIdOrRound?.status || 'pending';
    if (nextStatus === 'pending' && activePendingOthers.length >= MAX_SCHEDULED_SCENARIOS) {
      return { success: false, message: `예약 시나리오는 최대 ${MAX_SCHEDULED_SCENARIOS}개 라운드까지만 동시 예약할 수 있습니다.` };
    }

    const cleanedPrices: Record<string, number> = {};
    Object.entries(scenarioInput.stockPrices || {}).forEach(([k, v]) => {
      const p = toSafeInt(v, 0);
      if (p > 0) cleanedPrices[k] = p;
    });

    const nowIso = new Date().toISOString();
    const savedScenario: ScheduledRoundScenario = {
      id: existingByIdOrRound?.id || scenarioInput.id || `sched-r${cleanRound}-${Date.now()}`,
      targetRound: cleanRound,
      scheduledAt: scenarioInput.scheduledAt,
      scheduledAtMs: parsedTime,
      depositRate: Number.isFinite(scenarioInput.depositRate) ? scenarioInput.depositRate : curState.depositInterestRate,
      stockPrices: cleanedPrices,
      newsMessage: scenarioInput.newsMessage || '',
      newsArticleTitle: scenarioInput.newsArticleTitle?.trim() || undefined,
      executeSettlementOnTrigger: Boolean(scenarioInput.executeSettlementOnTrigger),
      status: nextStatus === 'executed' ? 'pending' : nextStatus,
      createdAt: existingByIdOrRound?.createdAt || nowIso,
      updatedAt: nowIso
    };

    const nextList = [
      ...existingList.filter(s => s.id !== savedScenario.id && s.targetRound !== cleanRound),
      savedScenario
    ].sort((a, b) => a.targetRound - b.targetRound);

    setState(prev => {
      const newState: ClassEconomyState = {
        ...prev,
        scheduledScenarios: nextList
      };
      try {
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(newState));
      } catch (e) {}
      syncClassToFirestore(newState);
      return newState;
    });

    return { success: true, scenario: savedScenario };
  };

  const deleteScheduledScenario = (scenarioId: string) => {
    setState(prev => {
      const nextList = (prev.scheduledScenarios || []).filter(s => s.id !== scenarioId);
      const newState: ClassEconomyState = {
        ...prev,
        scheduledScenarios: nextList
      };
      try {
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(newState));
      } catch (e) {}
      syncClassToFirestore(newState);
      return newState;
    });
  };

  const runDueScheduledScenario = async (scenario: ScheduledRoundScenario, forceManual: boolean = false): Promise<boolean> => {
    const curState = stateRef.current;
    if (!curState.classCode || schedulerLockRef.current) return false;
    if (scenario.targetRound <= curState.currentRound) return false;

    schedulerLockRef.current = true;
    try {
      // Student clients wait a short jitter so active teacher tab executes first if online
      if (!forceManual && role === 'student') {
        await new Promise(resolve => setTimeout(resolve, 2500 + Math.random() * 2000));
        const liveClass = await getClassFromFirestore(curState.classCode).catch(() => null);
        if (liveClass) {
          const liveTarget = (liveClass.scheduledScenarios || []).find(s => s.id === scenario.id);
          if (!liveTarget || liveTarget.status !== 'pending' || (liveClass.currentRound || 1) >= scenario.targetRound) {
            return false;
          }
        }
      }

      const claim = await claimScheduledScenarioExecution(curState.classCode, scenario.id, forceManual);
      if (!claim.claimed && !claim.fallbackToLocal) {
        return false;
      }

      const targetScenario = claim.scenario || scenario;
      const executed = await executeSettlement({
        depositRate: targetScenario.depositRate,
        stockPrices: targetScenario.stockPrices,
        newsMessage: targetScenario.newsMessage,
        targetRoundOverride: targetScenario.targetRound,
        markScenarioIdExecuted: targetScenario.id,
        executeSettlement: targetScenario.executeSettlementOnTrigger
      });

      if (!executed && claim.claimed) {
        await resetScheduledScenarioToPending(curState.classCode, targetScenario.id);
        return false;
      }

      // Optionally archive as a NewsArticle if newsMessage is provided
      if (targetScenario.newsMessage && targetScenario.newsMessage.trim()) {
        publishNewsArticle({
          title: targetScenario.newsArticleTitle || `Round ${targetScenario.targetRound} 경제 시나리오 속보`,
          content: targetScenario.newsMessage.trim(),
          category: 'economy',
          impact: 'neutral',
          publishedRound: targetScenario.targetRound,
          isBreaking: true
        });
      }

      return true;
    } catch (err) {
      console.warn('runDueScheduledScenario error:', err);
      await resetScheduledScenarioToPending(stateRef.current.classCode, scenario.id).catch(() => {});
      return false;
    } finally {
      schedulerLockRef.current = false;
    }
  };

  const triggerScheduledScenarioNow = async (scenarioId: string): Promise<boolean> => {
    const target = (stateRef.current.scheduledScenarios || []).find(s => s.id === scenarioId);
    if (!target) return false;
    return runDueScheduledScenario(target, true);
  };

  // Automatic Background Scheduler (checks every 5s + on tab visibility return)
  useEffect(() => {
    if (role === 'guest' || role === 'super_admin' || !state.classCode) return;

    const checkAndRunDue = () => {
      if (schedulerLockRef.current) return;
      const cur = stateRef.current;
      const now = Date.now();
      const dueList = (cur.scheduledScenarios || [])
        .filter(s => s.status === 'pending' && s.scheduledAtMs <= now && s.targetRound > cur.currentRound)
        .sort((a, b) => a.scheduledAtMs - b.scheduledAtMs);

      if (dueList.length > 0) {
        runDueScheduledScenario(dueList[0], false);
      }
    };

    checkAndRunDue();
    const intervalId = setInterval(checkAndRunDue, 5000);
    const onVisibility = () => {
      if (typeof document !== 'undefined' && !document.hidden) {
        checkAndRunDue();
      }
    };
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', onVisibility);
    }
    return () => {
      clearInterval(intervalId);
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', onVisibility);
      }
    };
  }, [role, state.classCode]);

  /**
   * Exports full class state into a clean, portable JSON format.
   * Perfect for GitHub migration, local archiving, or moving to a permanent personal Firebase.
   */
  const exportFullBackupJSON = (): string => {
    const backupPayload = {
      app: 'KidsRich Class Economy',
      version: '2.1',
      exportedAt: new Date().toISOString(),
      classCode: state.classCode,
      className: state.className,
      totalStudents: state.students.length,
      currentRound: state.currentRound,
      state: {
        ...state,
        students: state.students,
        transactions: state.transactions,
        stocks: state.stocks,
        shopItems: state.shopItems,
        newsArticles: state.newsArticles,
        scheduledScenarios: state.scheduledScenarios || []
      }
    };
    return JSON.stringify(backupPayload, null, 2);
  };

  /**
   * Imports and restores a full class backup JSON.
   * Updates state, local storage, and syncs immediately to Firestore.
   */
  const importFullBackupJSON = async (jsonString: string): Promise<{ success: boolean; message: string; count?: number }> => {
    try {
      const parsed = JSON.parse(jsonString);
      const incomingState: ClassEconomyState = parsed.state || parsed;

      if (!incomingState || !Array.isArray(incomingState.students)) {
        return { success: false, message: '올바른 학급 백업 JSON 파일 형식이 아닙니다.' };
      }

      const cleanStudents = deduplicateStudents(incomingState.students.map(sanitizeStudent)).unique;
      const targetClassCode = incomingState.classCode || state.classCode || 'C-10001';

      const restoredState: ClassEconomyState = {
        ...incomingState,
        classCode: targetClassCode,
        teacherName: currentTeacher?.name || incomingState.teacherName || '선생님',
        teacherEmail: currentTeacher?.email || incomingState.teacherEmail || '',
        students: cleanStudents,
        scheduledScenarios: Array.isArray(incomingState.scheduledScenarios) ? incomingState.scheduledScenarios : [],
        transactions: Array.isArray(incomingState.transactions) ? incomingState.transactions : state.transactions
      };

      // 1. Update React state & localStorage
      setState(restoredState);
      try {
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(restoredState));
        localStorage.setItem('kidsrich_students_' + targetClassCode, JSON.stringify(cleanStudents));
      } catch (e) {}

      // Keep logged-in teacher pointing to the restored classCode so future logins open this class
      if (currentTeacher) {
        const updatedTeacher: TeacherAccount = {
          ...currentTeacher,
          classCode: targetClassCode,
          className: restoredState.className || currentTeacher.className
        };
        setCurrentTeacher(updatedTeacher);
        try {
          const authStr = JSON.stringify(updatedTeacher);
          sessionStorage.setItem('kidsrich_auth_teacher', authStr);
          localStorage.setItem('kidsrich_auth_teacher', authStr);
          const savedTeachersStr = localStorage.getItem('kidsrich_teachers');
          const localTeachers: TeacherAccount[] = savedTeachersStr ? JSON.parse(savedTeachersStr) : [];
          const idx = localTeachers.findIndex(t => t.teacherId === updatedTeacher.teacherId || (t.email && t.email === updatedTeacher.email));
          if (idx >= 0) {
            localTeachers[idx] = updatedTeacher;
          } else {
            localTeachers.push(updatedTeacher);
          }
          localStorage.setItem('kidsrich_teachers', JSON.stringify(localTeachers));
        } catch (e) {}
        try {
          await saveTeacherToFirestore(updatedTeacher);
        } catch (e) {}
      }

      // 2. Sync to Firestore (Class Doc + Students)
      try {
        await syncClassToFirestore(restoredState);
        await saveMultipleStudentsToFirestore(targetClassCode, cleanStudents);
      } catch (err) {
        console.warn('Firestore backup restore sync warning:', err);
      }

      setLastSyncedAt(new Date());
      setIsCloudConnected(true);

      return {
        success: true,
        message: `Round ${restoredState.currentRound} 기준, 학생 ${cleanStudents.length}명의 데이터가 성공적으로 복원되었습니다.`,
        count: cleanStudents.length
      };
    } catch (err: any) {
      return { success: false, message: 'JSON 파일 구문 분석 실패: ' + (err?.message || '알 수 없는 오류') };
    }
  };

  return (
    <ClassEconomyContext.Provider
      value={{
        state,
        role,
        currentStudentId,
        currentStudent,
        currentTeacher,
        isCloudConnected,
        isSyncing,
        lastSyncedAt,
        initialUrlClassCode,
        lastActionError,
        clearLastActionError,
        refreshClassData,
        setRole,
        setCurrentStudentId,
        setCurrentTeacher,
        updateTeacherProfile,
        loginTeacher,
        signupTeacher,
        verifyTeacherForPasswordReset,
        resetTeacherPassword,
        loginStudent,
        getAvailableStudentsForClass,
        getSavedTeacherAccounts,
        quickLoginTeacher,
        quickLoginStudent,
        isSuperAdminSession,
        loginSuperAdmin,
        impersonateClassAsTeacher,
        returnToSuperAdmin,
        logout,
        depositSavings,
        withdrawSavings,
        buyStock,
        sellStock,
        buyShopItem,
        transferMoney,
        rebalancePortfolio,
        useCoupon,
        cancelCouponRequest,
        toggleCouponTeacherConfirm,
        batchSetCouponsTeacherConfirm,
        changeStudentPin,
        updateStudentPinByTeacher,
        updateMultipleStudentsPinByTeacher,
        requestPinReset,
        updateClassSettings,
        toggleTradingFreeze,
        toggleLeaderboardPublic,
        setLeaderboardPublic,
        setInterestRates,
        updateStockPrice,
        applyRoundScenario,
        upsertScheduledScenario,
        deleteScheduledScenario,
        triggerScheduledScenarioNow,
        addStock,
        deleteStock,
        publishNews,
        publishNewsArticle,
        updateNewsArticle,
        deleteNewsArticle,
        setRound,
        executeSettlement,
        restorePreviousState,
        applyFineOrReward,
        lastFineRewardSummary,
        setLastFineRewardSummary,
        approvePinReset,
        resetAllPins,
        addStudent,
        addBulkStudents,
        createNumberedStudents,
        deleteStudent,
        deleteMultipleStudents,
        removeDuplicateStudents,
        repairAllStudentBalancesConsistency,
        deleteTransaction,
        deleteMultipleTransactions,
        clearAllTransactions,
        addShopItem,
        deleteShopItem,
        repayDebt,
        forgiveStudentDebt,
        calculateTotalAssets,
        resetAllData,
        exportFullBackupJSON,
        importFullBackupJSON
      }}
    >
      {children}
    </ClassEconomyContext.Provider>
  );
};

export const useClassEconomy = () => {
  const context = useContext(ClassEconomyContext);
  if (!context) {
    throw new Error('useClassEconomy must be used within a ClassEconomyProvider');
  }
  return context;
};
