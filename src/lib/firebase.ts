import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getFirestore,
  initializeFirestore,
  memoryLocalCache,
  setLogLevel,
  doc,
  setDoc,
  deleteDoc,
  getDoc,
  getDocs,
  collection,
  onSnapshot,
  query,
  orderBy,
  limit,
  writeBatch,
  runTransaction,
  updateDoc,
  FieldPath,
  SetOptions,
  Unsubscribe
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import {
  ClassEconomyState,
  Student,
  Transaction,
  ShopItem,
  StockInfo,
  TeacherAccount,
  NewsArticle,
  ScheduledRoundScenario,
  Coupon,
  StudentRoundSnapshot,
  LiquidatedStockItem,
  StudentFineRewardRecord,
  FineRewardResultSummary
} from '../types';
import { deduplicateStudents } from './studentDeduplication';

/**
 * Strict integer currency helper: eliminates floating-point drift (e.g. 60545.539 -> 60546)
 */
export function toSafeInt(val: any, fallback: number = 0): number {
  const num = Number(val);
  if (!Number.isFinite(num)) return Math.max(0, Math.round(fallback));
  return Math.max(0, Math.round(num));
}

/**
 * Strict fractional stock share sanitizer (up to 8 decimal places, zero below 1e-8)
 */
export function toSafeShares(val: any): number {
  const num = Number(val);
  if (!Number.isFinite(num) || num <= 0.00000001) return 0;
  return parseFloat(num.toFixed(8));
}

export function sanitizeStockSharesMap(raw: any): Record<string, number> {
  if (!raw || typeof raw !== 'object') return {};
  const cleaned: Record<string, number> = {};
  for (const [k, v] of Object.entries(raw)) {
    const sh = toSafeShares(v);
    if (sh > 0) {
      cleaned[k] = sh;
    }
  }
  return cleaned;
}

/**
 * Deterministic anti-arbitrage stock math helpers:
 * - Buying rounds shares DOWN / cost UP so cash spent >= share value gained.
 * - Selling rounds return DOWN / shares deducted UP so cash received <= share value sold.
 */
export function calcBuySharesFromAmount(amount: number, price: number): number {
  const safeAmt = toSafeInt(amount, 0);
  if (safeAmt <= 0 || !Number.isFinite(price) || price <= 0) return 0;
  return toSafeShares(Math.floor((safeAmt / price) * 1e8 + 1e-9) / 1e8);
}

export function calcBuyCostFromShares(shares: number, price: number): number {
  const safeShares = toSafeShares(shares);
  if (safeShares <= 0 || !Number.isFinite(price) || price <= 0) return 0;
  return toSafeInt(Math.ceil(safeShares * price - 1e-6), 0);
}

export function calcSellReturnFromShares(shares: number, price: number): number {
  const safeShares = toSafeShares(shares);
  if (safeShares <= 0 || !Number.isFinite(price) || price <= 0) return 0;
  return toSafeInt(Math.floor(safeShares * price + 1e-6), 0);
}

export function calcSellSharesFromAmount(amount: number, price: number): number {
  const safeAmt = toSafeInt(amount, 0);
  if (safeAmt <= 0 || !Number.isFinite(price) || price <= 0) return 0;
  return toSafeShares(Math.ceil((safeAmt / price) * 1e8 - 1e-6) / 1e8);
}

// Initialize Firebase App (supports both VITE_ env variables and firebase-applet-config.json)
const fbConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || firebaseConfig.apiKey,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || firebaseConfig.authDomain,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || firebaseConfig.projectId,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || firebaseConfig.storageBucket,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || firebaseConfig.messagingSenderId,
  appId: import.meta.env.VITE_FIREBASE_APP_ID || firebaseConfig.appId,
};

// Suppress noisy Firestore SDK v12 internal Watch existence BloomFilterError warnings
setLogLevel('error');

const app = getApps().length > 0 ? getApp() : initializeApp(fbConfig);

// Initialize Firestore (default database or custom named database ID) with clean memory cache
const customDbId = import.meta.env.VITE_FIREBASE_PROJECT_ID
  ? (import.meta.env.VITE_FIRESTORE_DATABASE_ID || '(default)')
  : (import.meta.env.VITE_FIRESTORE_DATABASE_ID || firebaseConfig.firestoreDatabaseId);
const dbIdArg = customDbId && customDbId !== '(default)' ? customDbId : undefined;

let firestoreInstance;
try {
  firestoreInstance = initializeFirestore(
    app,
    { localCache: memoryLocalCache() },
    dbIdArg
  );
} catch {
  firestoreInstance = dbIdArg ? getFirestore(app, dbIdArg) : getFirestore(app);
}
export const db = firestoreInstance;

// Firestore Quota and error backoff guard
let quotaExceededUntil = 0;

export function isFirestoreQuotaExceeded(): boolean {
  return Date.now() < quotaExceededUntil;
}

export function markQuotaExceeded(cooldownMs: number = 25000) {
  quotaExceededUntil = Date.now() + cooldownMs;
  try {
    sessionStorage.setItem('kidsrich_quota_exceeded', String(quotaExceededUntil));
  } catch (e) {}
}

export function checkAndHandleFirestoreError(err: any): boolean {
  if (!err) return false;
  const msg = String(err?.message || '');
  const code = String(err?.code || '');
  if (code === 'resource-exhausted' || msg.includes('Quota limit exceeded') || msg.includes('quota metric')) {
    markQuotaExceeded();
    return true;
  }
  return false;
}

// Restore quota flag from sessionStorage if set previously
try {
  const savedUntil = sessionStorage.getItem('kidsrich_quota_exceeded');
  if (savedUntil && Number(savedUntil) > Date.now()) {
    quotaExceededUntil = Number(savedUntil);
  }
} catch (e) {}

/**
 * Recursively removes all undefined fields from objects and arrays for Firestore compatibility.
 * Google Firestore SDK throws an error if any field in an object or nested array is `undefined`.
 */
export function cleanFirestoreData<T>(data: T): T {
  if (data === undefined) {
    return null as any;
  }
  if (data === null || typeof data !== 'object') {
    return data;
  }
  if (Array.isArray(data)) {
    return data
      .filter((item) => item !== undefined)
      .map((item) => cleanFirestoreData(item)) as any;
  }
  const cleaned: Record<string, any> = {};
  for (const [key, value] of Object.entries(data as Record<string, any>)) {
    if (value !== undefined) {
      cleaned[key] = cleanFirestoreData(value);
    }
  }
  return cleaned as T;
}

/**
 * Builds SetOptions using top-level FieldPaths so nested maps (especially `stockShares`)
 * are REPLACED in full instead of deep-merged (which would retain deleted/sold-out keys),
 * while still preserving any omitted top-level fields (like `isOnline`, `lastSeen`, `lastActive`).
 */
export function getReplaceTopLevelMergeOptions(cleaned: Record<string, any>): SetOptions {
  const keys = Object.keys(cleaned || {});
  if (keys.length === 0) return { merge: true };
  return { mergeFields: keys.map((k) => new FieldPath(k)) };
}

/**
 * Save complete class settings and market metadata to Firestore (does NOT overwrite student presence)
 */
export async function syncClassToFirestore(state: ClassEconomyState) {
  if (!state.classCode) return;
  try {
    const classDocRef = doc(db, 'classes', state.classCode);
    const payload = cleanFirestoreData({
      classCode: state.classCode,
      className: state.className || '우리반',
      teacherName: state.teacherName || '',
      teacherEmail: state.teacherEmail || '',
      currencyUnit: state.currencyUnit || '원',
      language: state.language || 'ko',
      currentRound: state.currentRound || 1,
      totalRounds: state.totalRounds || 10,
      isTradingFrozen: !!state.isTradingFrozen,
      isLeaderboardPublic: state.isLeaderboardPublic !== undefined ? !!state.isLeaderboardPublic : true,
      depositInterestRate: state.depositInterestRate || 5.0,
      newsMessage: state.newsMessage || '',
      newsArticles: state.newsArticles || [],
      scheduledScenarios: state.scheduledScenarios || [],
      stocks: state.stocks || [],
      shopItems: state.shopItems || [],
      updatedAt: new Date().toISOString()
    });
    await setDoc(classDocRef, payload, getReplaceTopLevelMergeOptions(payload));
  } catch (err) {
    console.warn('Firestore syncClass error:', err);
  }
}

/**
 * Check if a classCode already exists in Firestore (prevents multi-teacher class code collisions)
 */
export async function isClassCodeTakenInFirestore(classCode: string): Promise<boolean> {
  if (!classCode || isFirestoreQuotaExceeded()) return false;
  try {
    const snap = await getDoc(doc(db, 'classes', classCode));
    return snap.exists();
  } catch (err) {
    checkAndHandleFirestoreError(err);
    return false;
  }
}

/**
 * Save single student profile/assets to Firestore
 */
export async function syncStudentToFirestore(classCode: string, student: Student) {
  if (!classCode || !student || !student.id) return;
  try {
    const studentRef = doc(db, 'classes', classCode, 'students', student.id);
    const cleaned = cleanFirestoreData(student);
    await setDoc(studentRef, cleaned, getReplaceTopLevelMergeOptions(cleaned));
  } catch (err) {
    console.warn('Firestore syncStudent error:', err);
  }
}

/**
 * Save student profile changes from teacher without overwriting student online status
 */
export async function syncStudentProfileFromTeacher(classCode: string, student: Student) {
  if (!classCode || !student || !student.id) return;
  try {
    const studentRef = doc(db, 'classes', classCode, 'students', student.id);
    const { isOnline, lastSeen, lastActive, ...profileData } = student;
    const cleaned = cleanFirestoreData(profileData);
    await setDoc(studentRef, cleaned, getReplaceTopLevelMergeOptions(cleaned));
  } catch (err) {
    console.warn('Firestore syncStudentProfileFromTeacher error:', err);
  }
}

/**
 * Targeted non-financial update from teacher (PIN, coupons, name, number)
 * NEVER overwrites live cash, savings, debt, stockShares, or balanceVersion!
 */
export async function syncStudentNonBalanceFieldsFromTeacher(
  classCode: string,
  studentId: string,
  fields: Partial<Pick<Student, 'pin' | 'isPinChanged' | 'pinResetRequested' | 'couponsOwned' | 'number' | 'name' | 'recentActivity'>>
): Promise<boolean> {
  if (!classCode || !studentId) return false;
  try {
    const studentRef = doc(db, 'classes', classCode, 'students', studentId);
    const cleaned = cleanFirestoreData({
      ...fields,
      updatedAtMs: Date.now()
    });
    await setDoc(studentRef, cleaned, { merge: true });
    return true;
  } catch (err) {
    console.warn('Firestore syncStudentNonBalanceFieldsFromTeacher error:', err);
    return false;
  }
}

/**
 * Save multiple student profiles atomically in a Firestore Batch without overwriting presence
 */
export async function syncMultipleStudentProfilesFromTeacher(classCode: string, students: Student[]) {
  if (!classCode || !students || students.length === 0) return;
  try {
    const chunkSize = 400;
    for (let i = 0; i < students.length; i += chunkSize) {
      const chunk = students.slice(i, i + chunkSize);
      const batch = writeBatch(db);
      chunk.forEach((student) => {
        if (!student.id) return;
        const studentRef = doc(db, 'classes', classCode, 'students', student.id);
        const { isOnline, lastSeen, lastActive, ...profileData } = student;
        const cleaned = cleanFirestoreData(profileData);
        batch.set(studentRef, cleaned, getReplaceTopLevelMergeOptions(cleaned));
      });
      await batch.commit();
    }
  } catch (err) {
    console.warn('Firestore syncMultipleStudentProfilesFromTeacher error:', err);
  }
}

/**
 * Save multiple non-financial updates (e.g. bulk PIN reset, student renumbering, coupon confirmations)
 * without overwriting live cash, savings, debt, or stockShares.
 */
export async function syncMultipleStudentNonBalanceFieldsFromTeacher(
  classCode: string,
  updates: Array<{
    studentId: string;
    fields: Partial<Pick<Student, 'pin' | 'isPinChanged' | 'pinResetRequested' | 'couponsOwned' | 'number' | 'name' | 'recentActivity'>>;
  }>
) {
  if (!classCode || !updates || updates.length === 0) return;
  try {
    const chunkSize = 400;
    const nowMs = Date.now();
    for (let i = 0; i < updates.length; i += chunkSize) {
      const chunk = updates.slice(i, i + chunkSize);
      const batch = writeBatch(db);
      chunk.forEach(({ studentId, fields }) => {
        if (!studentId) return;
        const studentRef = doc(db, 'classes', classCode, 'students', studentId);
        batch.set(studentRef, cleanFirestoreData({ ...fields, updatedAtMs: nowMs }), { merge: true });
      });
      await batch.commit();
    }
  } catch (err) {
    console.warn('Firestore syncMultipleStudentNonBalanceFieldsFromTeacher error:', err);
  }
}

/**
 * Save multiple students to Firestore in a batch (e.g. bulk add, initial seed)
 */
export async function saveMultipleStudentsToFirestore(classCode: string, students: Student[]) {
  if (!classCode || !students || students.length === 0) return;
  try {
    const chunkSize = 400;
    for (let i = 0; i < students.length; i += chunkSize) {
      const chunk = students.slice(i, i + chunkSize);
      const batch = writeBatch(db);
      chunk.forEach((student) => {
        const studentRef = doc(db, 'classes', classCode, 'students', student.id);
        const cleaned = cleanFirestoreData(student);
        batch.set(studentRef, cleaned, getReplaceTopLevelMergeOptions(cleaned));
      });
      await batch.commit();
    }
  } catch (err) {
    console.warn('Firestore saveMultipleStudents error:', err);
  }
}

/**
 * Helper to ensure student object integrity from Firestore
 */
export function sanitizeFirestoreStudent(data: any, docId: string): Student {
  const num = Number(data?.number ?? 1);
  const parsedCash = data?.cash !== undefined && data?.cash !== null ? toSafeInt(data.cash, 30000) : 30000;
  const parsedSavings = data?.savings !== undefined && data?.savings !== null ? toSafeInt(data.savings, 0) : 0;
  const parsedDebt = data?.debt !== undefined && data?.debt !== null ? toSafeInt(data.debt, 0) : 0;

  return {
    id: String(data?.id || docId),
    number: isNaN(num) ? 1 : num,
    name: String(data?.name || '학생'),
    username: data?.username || `student_${String(isNaN(num) ? 1 : num).padStart(2, '0')}`,
    pin: data?.pin !== undefined && data?.pin !== null ? String(data.pin) : '1234',
    cash: parsedCash,
    savings: parsedSavings,
    debt: parsedDebt,
    stockShares: sanitizeStockSharesMap(data?.stockShares),
    couponsOwned: Array.isArray(data?.couponsOwned) ? data.couponsOwned : [],
    roundHistory: Array.isArray(data?.roundHistory)
      ? data.roundHistory
      : (data?.roundHistory && typeof data?.roundHistory === 'object' ? Object.values(data.roundHistory) : undefined),
    balanceVersion: typeof data?.balanceVersion === 'number' && Number.isFinite(data.balanceVersion) ? data.balanceVersion : 0,
    updatedAtMs: typeof data?.updatedAtMs === 'number' && Number.isFinite(data.updatedAtMs) ? data.updatedAtMs : 0,
    isPinChanged: Boolean(data?.isPinChanged),
    isOnline: Boolean(data?.isOnline || false),
    pinResetRequested: Boolean(data?.pinResetRequested),
    recentActivity: String(data?.recentActivity || '계정 준비됨'),
    lastActive: String(data?.lastActive || '최근 접속')
  };
}

/**
 * Fetch all students of a class directly from Firestore.
 * Automatically deduplicates records (e.g. 1~5 duplicates) and purges redundant documents.
 */
export async function getStudentsFromFirestore(classCode: string): Promise<Student[]> {
  if (!classCode) return [];
  if (isFirestoreQuotaExceeded()) {
    return [];
  }
  try {
    const studentsColRef = collection(db, 'classes', classCode, 'students');
    const querySnap = await getDocs(studentsColRef);
    const list: Student[] = [];
    querySnap.forEach((d) => {
      list.push(sanitizeFirestoreStudent(d.data(), d.id));
    });

    const { unique, duplicateIds } = deduplicateStudents(list);

    // If duplicate student documents exist in Firestore (such as duplicate 1~5 docs), delete them from Firestore in background
    if (duplicateIds.length > 0) {
      console.info(`[KidsRich] Found ${duplicateIds.length} duplicate student documents in Firestore for class ${classCode}. Purging duplicates...`);
      deleteMultipleStudentsFromFirestore(classCode, duplicateIds).catch(err => {
        console.warn('Background cleanup of duplicate students in Firestore failed:', err);
      });
    }

    return unique;
  } catch (err) {
    if (checkAndHandleFirestoreError(err)) {
      console.info('Firestore read quota exceeded; using local cache for students.');
    } else {
      console.warn('Firestore getStudents error:', err);
    }
    return [];
  }
}

/**
 * Fetch a single student's document from Firestore (1 read only).
 * Ultra-efficient for student devices to sync their own balance, interest, and round snapshot without loading all 26 students.
 */
export async function getSingleStudentFromFirestore(classCode: string, studentId: string): Promise<Student | null> {
  if (!classCode || !studentId) return null;
  if (isFirestoreQuotaExceeded()) return null;
  try {
    const studentRef = doc(db, 'classes', classCode, 'students', studentId);
    const snap = await getDoc(studentRef);
    if (snap.exists()) {
      return sanitizeFirestoreStudent(snap.data(), snap.id);
    }
    return null;
  } catch (err) {
    if (checkAndHandleFirestoreError(err)) {
      console.info('Firestore read quota exceeded; using local cache for single student.');
    } else {
      console.warn('Firestore getSingleStudent error:', err);
    }
    return null;
  }
}

/**
 * Delete student document from Firestore
 */
export async function deleteStudentFromFirestore(classCode: string, studentId: string): Promise<boolean> {
  if (!classCode || !studentId) return false;
  try {
    const studentRef = doc(db, 'classes', classCode, 'students', studentId);
    await deleteDoc(studentRef);
    return true;
  } catch (err) {
    console.warn('Firestore deleteStudent error:', err);
    return false;
  }
}

/**
 * Delete multiple students from Firestore in a batch (handles chunking up to 400 docs per batch)
 */
export async function deleteMultipleStudentsFromFirestore(classCode: string, studentIds: string[]): Promise<boolean> {
  if (!classCode || !studentIds || studentIds.length === 0) return false;
  try {
    const chunkSize = 400;
    for (let i = 0; i < studentIds.length; i += chunkSize) {
      const chunk = studentIds.slice(i, i + chunkSize);
      const batch = writeBatch(db);
      chunk.forEach(id => {
        if (!id) return;
        const studentRef = doc(db, 'classes', classCode, 'students', id);
        batch.delete(studentRef);
      });
      await batch.commit();
    }
    return true;
  } catch (err) {
    console.warn('Firestore deleteMultipleStudents error:', err);
    return false;
  }
}

/**
 * Clear all students in a class collection from Firestore
 */
export async function clearAllStudentsFromFirestore(classCode: string) {
  if (!classCode) return;
  if (isFirestoreQuotaExceeded()) return;
  try {
    const studentsColRef = collection(db, 'classes', classCode, 'students');
    const querySnap = await getDocs(studentsColRef);
    if (querySnap.empty) return;
    const batch = writeBatch(db);
    querySnap.forEach(d => {
      batch.delete(d.ref);
    });
    await batch.commit();
  } catch (err) {
    if (!checkAndHandleFirestoreError(err)) {
      console.warn('Firestore clearAllStudents error:', err);
    }
  }
}

/**
 * Fetch complete class settings and market data directly from Firestore
 */
export async function getClassFromFirestore(classCode: string): Promise<Partial<ClassEconomyState> | null> {
  if (!classCode) return null;
  if (isFirestoreQuotaExceeded()) return null;
  try {
    const classDocRef = doc(db, 'classes', classCode);
    const snap = await getDoc(classDocRef);
    if (snap.exists()) {
      return snap.data() as Partial<ClassEconomyState>;
    }
    return null;
  } catch (err) {
    if (checkAndHandleFirestoreError(err)) {
      console.info('Firestore read quota exceeded; using local class data.');
    } else {
      console.warn('Firestore getClassFromFirestore error:', err);
    }
    return null;
  }
}

/**
 * Fetch transactions (Plan A: Kept in LocalStorage only, 0 Firestore read quota)
 */
export async function getTransactionsFromFirestore(_classCode: string): Promise<Transaction[]> {
  // Plan A: Transactions are managed locally to prevent quota exhaustion
  return [];
}

/**
 * Delete single transaction / asset history document (Plan A: Local only)
 */
export async function deleteTransactionFromFirestore(_classCode: string, _txId: string): Promise<boolean> {
  return true;
}

/**
 * Delete multiple transactions / asset history documents (Plan A: Local only)
 */
export async function deleteMultipleTransactionsFromFirestore(_classCode: string, _txIds: string[]): Promise<boolean> {
  return true;
}

/**
 * Clear all transactions for a class (Plan A: Local only)
 */
export async function clearAllTransactionsFromFirestore(_classCode: string): Promise<boolean> {
  return true;
}

/**
 * Save student activity record / transaction
 * Plan A: Disabled to prevent quota exhaustion. All activity logs & ledger are maintained safely in LocalStorage.
 */
export async function logTransactionToFirestore(_classCode: string, _tx: Transaction): Promise<void> {
  // Plan A: Pure local storage persistence (0 Firestore writes)
  return;
}

/**
 * Subscribe to real-time class document updates
 */
export function subscribeToClass(
  classCode: string,
  onUpdate: (data: Partial<ClassEconomyState>) => void,
  onDocNotFound?: () => void
): Unsubscribe {
  if (!classCode || isFirestoreQuotaExceeded()) {
    return () => {};
  }
  const classDocRef = doc(db, 'classes', classCode);
  return onSnapshot(classDocRef, (snap) => {
    if (snap.exists()) {
      const data = snap.data();
      onUpdate({
        classCode: data.classCode || classCode,
        className: data.className,
        teacherName: data.teacherName,
        teacherEmail: data.teacherEmail,
        currencyUnit: data.currencyUnit,
        language: data.language,
        currentRound: data.currentRound,
        totalRounds: data.totalRounds,
        isTradingFrozen: data.isTradingFrozen,
        isLeaderboardPublic: data.isLeaderboardPublic !== undefined ? Boolean(data.isLeaderboardPublic) : true,
        depositInterestRate: data.depositInterestRate,
        newsMessage: data.newsMessage,
        newsArticles: (data.newsArticles as NewsArticle[]) || undefined,
        scheduledScenarios: Array.isArray(data.scheduledScenarios) ? (data.scheduledScenarios as ScheduledRoundScenario[]) : undefined,
        stocks: (data.stocks as StockInfo[]) || undefined,
        shopItems: (data.shopItems as ShopItem[]) || undefined,
      });
    } else {
      if (onDocNotFound) {
        onDocNotFound();
      }
    }
  }, (err) => {
    if (checkAndHandleFirestoreError(err)) {
      console.info('Firestore subscribeToClass paused: Daily quota reached.');
    } else {
      console.warn('Firestore subscribeToClass error:', err);
    }
  });
}

/**
 * Ultra-lightweight real-time listener for an individual student (1 document only).
 * When the teacher advances the round, pays interest, or awards fines/rewards, this student's device
 * updates in under 0.5 seconds with ZERO polling and only 1 document read per round!
 */
export function subscribeToSingleStudent(
  classCode: string,
  studentId: string,
  onUpdate: (student: Student) => void
): Unsubscribe {
  if (!classCode || !studentId || isFirestoreQuotaExceeded()) {
    return () => {};
  }
  try {
    const studentRef = doc(db, 'classes', classCode, 'students', studentId);
    return onSnapshot(
      studentRef,
      (docSnap) => {
        if (docSnap.exists()) {
          const student = sanitizeFirestoreStudent(docSnap.data(), docSnap.id);
          onUpdate(student);
        }
      },
      (err) => {
        if (checkAndHandleFirestoreError(err)) {
          console.info('Single student subscription paused due to quota.');
        } else {
          console.warn('subscribeToSingleStudent error:', err);
        }
      }
    );
  } catch (err) {
    console.warn('subscribeToSingleStudent setup error:', err);
    return () => {};
  }
}

/**
 * Plan A: Real-time student list streaming removed to save Firestore read quota.
 * Student records are updated on demand when teacher clicks refresh or during initial load.
 */
export function subscribeToStudents(
  _classCode: string,
  _onUpdate: (students: Student[]) => void
): Unsubscribe {
  // Plan A: Disabled to prevent background loop reads
  return () => {};
}

/**
 * Plan A: Real-time transactions streaming removed to save Firestore read quota.
 * Transactions are managed locally in client storage.
 */
export function subscribeToTransactions(
  _classCode: string,
  _onUpdate: (transactions: Transaction[]) => void
): Unsubscribe {
  // Plan A: Disabled to prevent background loop reads
  return () => {};
}

/**
 * Register or update teacher account in Firestore
 */
export async function saveTeacherToFirestore(teacher: TeacherAccount) {
  if (!teacher.email && !teacher.teacherId) return;
  try {
    const teacherId = teacher.teacherId || teacher.email.replace(/[@.]/g, '_');
    const teacherRef = doc(db, 'teachers', teacherId);
    const cleaned = cleanFirestoreData(teacher);
    await setDoc(teacherRef, cleaned, { merge: true });
  } catch (err) {
    console.warn('Firestore saveTeacher error:', err);
  }
}

/**
 * Get teacher account from Firestore by email or teacherId
 */
export async function getTeacherFromFirestore(identifier: string): Promise<TeacherAccount | null> {
  if (!identifier) return null;
  if (isFirestoreQuotaExceeded()) return null;
  try {
    const cleanId = identifier.trim();
    const docId = cleanId.replace(/[@.]/g, '_');
    const teacherRef = doc(db, 'teachers', docId);
    const snap = await getDoc(teacherRef);
    if (snap.exists()) {
      return snap.data() as TeacherAccount;
    }
    // Also try direct cleanId
    const directRef = doc(db, 'teachers', cleanId);
    const directSnap = await getDoc(directRef);
    if (directSnap.exists()) {
      return directSnap.data() as TeacherAccount;
    }

    // Query collection to find matching email or teacherId regardless of doc key
    const teachersCol = collection(db, 'teachers');
    const allSnaps = await getDocs(teachersCol);
    for (const d of allSnaps.docs) {
      const data = d.data() as TeacherAccount;
      if (
        (data.email && data.email.toLowerCase() === cleanId.toLowerCase()) ||
        (data.teacherId && data.teacherId.toLowerCase() === cleanId.toLowerCase())
      ) {
        return data;
      }
    }

    return null;
  } catch (err) {
    if (checkAndHandleFirestoreError(err)) {
      console.info('Firestore getTeacher paused: Daily quota reached.');
    } else {
      console.warn('Firestore getTeacher error:', err);
    }
    return null;
  }
}

/**
 * Update teacher password in Firestore
 */
export async function updateTeacherPasswordInFirestore(teacherId: string, newPassword: string): Promise<boolean> {
  if (!teacherId || !newPassword) return false;
  try {
    const docId = teacherId.replace(/[@.]/g, '_');
    const teacherRef = doc(db, 'teachers', docId);
    await setDoc(teacherRef, { password: newPassword }, { merge: true });
    
    // Also try direct teacherId
    const directRef = doc(db, 'teachers', teacherId);
    await setDoc(directRef, { password: newPassword }, { merge: true });
    return true;
  } catch (err) {
    console.warn('Firestore updateTeacherPassword error:', err);
    return false;
  }
}

// ============================================================================
// SERVER-AUTHORITATIVE ATOMIC TRANSACTIONS (PREVENT BALANCE INCONSISTENCY)
// ============================================================================

export interface AtomicStudentResult {
  ok: boolean;
  student?: Student;
  receiverStudent?: Student;
  actualAmount?: number;
  actualShares?: number;
  stockName?: string;
  error?: string;
  fallbackToLocal?: boolean;
}

class BusinessRuleError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BusinessRuleError';
  }
}

function isQuotaOrNetworkFailure(err: any): boolean {
  if (!err || err instanceof BusinessRuleError) return false;
  const code = String(err?.code || '');
  const msg = String(err?.message || '').toLowerCase();
  if (checkAndHandleFirestoreError(err)) return true;
  return (
    code === 'unavailable' ||
    code === 'deadline-exceeded' ||
    code === 'cancelled' ||
    code === 'failed-precondition' ||
    msg.includes('network') ||
    msg.includes('offline') ||
    msg.includes('fetch') ||
    msg.includes('quota')
  );
}

/**
 * Atomic Deposit: Reads live class freeze status and student balance in a Firestore transaction.
 */
export async function runAtomicDeposit(
  classCode: string,
  studentId: string,
  amount: number,
  fallbackStudent?: Student
): Promise<AtomicStudentResult> {
  const cleanAmt = toSafeInt(amount, 0);
  if (!classCode || !studentId || cleanAmt <= 0) {
    return { ok: false, error: '유효한 입금 금액을 입력해 주세요.' };
  }
  if (isFirestoreQuotaExceeded()) {
    return { ok: false, fallbackToLocal: true };
  }
  try {
    const classRef = doc(db, 'classes', classCode);
    const studentRef = doc(db, 'classes', classCode, 'students', studentId);

    const committed = await runTransaction(db, async (tx) => {
      const [classSnap, studentSnap] = await Promise.all([tx.get(classRef), tx.get(studentRef)]);
      if (classSnap.exists() && classSnap.data()?.isTradingFrozen) {
        throw new BusinessRuleError('현재 거래 정지 상태입니다.');
      }
      const current = studentSnap.exists()
        ? sanitizeFirestoreStudent(studentSnap.data(), studentId)
        : (fallbackStudent ? sanitizeFirestoreStudent(fallbackStudent, studentId) : null);

      if (!current) {
        throw new BusinessRuleError('학생 정보를 찾을 수 없습니다.');
      }
      const liveCash = toSafeInt(current.cash);
      const liveSavings = toSafeInt(current.savings);
      if (liveCash < cleanAmt) {
        throw new BusinessRuleError(`보유 현금(${liveCash.toLocaleString()}원)이 부족합니다.`);
      }

      const updated: Student = {
        ...current,
        cash: liveCash - cleanAmt,
        savings: liveSavings + cleanAmt,
        recentActivity: '저축 입금',
        balanceVersion: (current.balanceVersion || 0) + 1,
        updatedAtMs: Date.now()
      };
      const cleaned = cleanFirestoreData(updated);
      tx.set(studentRef, cleaned, getReplaceTopLevelMergeOptions(cleaned));
      return updated;
    });

    return { ok: true, student: committed, actualAmount: cleanAmt };
  } catch (err: any) {
    if (err instanceof BusinessRuleError) {
      return { ok: false, error: err.message };
    }
    if (isQuotaOrNetworkFailure(err)) {
      return { ok: false, fallbackToLocal: true };
    }
    console.warn('runAtomicDeposit error:', err);
    return { ok: false, error: '입금 처리 중 일시적인 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.' };
  }
}

/**
 * Atomic Withdraw: Reads live class freeze status and student savings in a Firestore transaction.
 */
export async function runAtomicWithdraw(
  classCode: string,
  studentId: string,
  amount: number,
  fallbackStudent?: Student
): Promise<AtomicStudentResult> {
  const cleanAmt = toSafeInt(amount, 0);
  if (!classCode || !studentId || cleanAmt <= 0) {
    return { ok: false, error: '유효한 출금 금액을 입력해 주세요.' };
  }
  if (isFirestoreQuotaExceeded()) {
    return { ok: false, fallbackToLocal: true };
  }
  try {
    const classRef = doc(db, 'classes', classCode);
    const studentRef = doc(db, 'classes', classCode, 'students', studentId);

    const committed = await runTransaction(db, async (tx) => {
      const [classSnap, studentSnap] = await Promise.all([tx.get(classRef), tx.get(studentRef)]);
      if (classSnap.exists() && classSnap.data()?.isTradingFrozen) {
        throw new BusinessRuleError('현재 거래 정지 상태입니다.');
      }
      const current = studentSnap.exists()
        ? sanitizeFirestoreStudent(studentSnap.data(), studentId)
        : (fallbackStudent ? sanitizeFirestoreStudent(fallbackStudent, studentId) : null);

      if (!current) {
        throw new BusinessRuleError('학생 정보를 찾을 수 없습니다.');
      }
      const liveCash = toSafeInt(current.cash);
      const liveSavings = toSafeInt(current.savings);
      if (liveSavings < cleanAmt) {
        throw new BusinessRuleError(`예금 잔액(${liveSavings.toLocaleString()}원)이 부족합니다.`);
      }

      const updated: Student = {
        ...current,
        cash: liveCash + cleanAmt,
        savings: liveSavings - cleanAmt,
        recentActivity: '저축 출금',
        balanceVersion: (current.balanceVersion || 0) + 1,
        updatedAtMs: Date.now()
      };
      const cleaned = cleanFirestoreData(updated);
      tx.set(studentRef, cleaned, getReplaceTopLevelMergeOptions(cleaned));
      return updated;
    });

    return { ok: true, student: committed, actualAmount: cleanAmt };
  } catch (err: any) {
    if (err instanceof BusinessRuleError) {
      return { ok: false, error: err.message };
    }
    if (isQuotaOrNetworkFailure(err)) {
      return { ok: false, fallbackToLocal: true };
    }
    console.warn('runAtomicWithdraw error:', err);
    return { ok: false, error: '출금 처리 중 일시적인 오류가 발생했습니다.' };
  }
}

/**
 * Atomic Stock Buy: Uses LIVE Firestore stock prices & student cash inside the transaction.
 */
export async function runAtomicBuyStock(
  classCode: string,
  studentId: string,
  stockId: string,
  shares: number,
  customAmount?: number,
  fallbackStocks?: StockInfo[],
  fallbackStudent?: Student
): Promise<AtomicStudentResult> {
  if (!classCode || !studentId || !stockId) {
    return { ok: false, error: '주식 매수 정보가 올바르지 않습니다.' };
  }
  if (isFirestoreQuotaExceeded()) {
    return { ok: false, fallbackToLocal: true };
  }
  try {
    const classRef = doc(db, 'classes', classCode);
    const studentRef = doc(db, 'classes', classCode, 'students', studentId);

    const res = await runTransaction(db, async (tx) => {
      const [classSnap, studentSnap] = await Promise.all([tx.get(classRef), tx.get(studentRef)]);
      const classData = classSnap.exists() ? classSnap.data() : null;
      if (classData?.isTradingFrozen) {
        throw new BusinessRuleError('현재 거래 정지 상태입니다.');
      }

      const liveStocks: StockInfo[] =
        Array.isArray(classData?.stocks) && classData.stocks.length > 0
          ? classData.stocks
          : (fallbackStocks || []);
      const stock = liveStocks.find((s) => s.id === stockId);
      if (!stock || (stock.currentPrice || 0) <= 0) {
        throw new BusinessRuleError('해당 주식 종목 정보를 찾을 수 없습니다.');
      }

      const current = studentSnap.exists()
        ? sanitizeFirestoreStudent(studentSnap.data(), studentId)
        : (fallbackStudent ? sanitizeFirestoreStudent(fallbackStudent, studentId) : null);
      if (!current) {
        throw new BusinessRuleError('학생 정보를 찾을 수 없습니다.');
      }

      let totalCost: number;
      let effectiveShares: number;

      if (customAmount !== undefined && customAmount > 0) {
        totalCost = toSafeInt(customAmount, 0);
        if (totalCost <= 0) throw new BusinessRuleError('매수 금액은 1원 이상이어야 합니다.');
        effectiveShares = calcBuySharesFromAmount(totalCost, stock.currentPrice);
      } else {
        if (!Number.isFinite(shares) || shares <= 0) throw new BusinessRuleError('매수 수량은 0주보다 커야 합니다.');
        effectiveShares = toSafeShares(shares);
        totalCost = calcBuyCostFromShares(effectiveShares, stock.currentPrice);
      }
      if (totalCost <= 0 || effectiveShares <= 0) {
        throw new BusinessRuleError('매수 금액 또는 수량이 너무 작습니다.');
      }

      const liveCash = toSafeInt(current.cash);
      if (liveCash < totalCost) {
        throw new BusinessRuleError(`보유 현금(${liveCash.toLocaleString()}원)이 부족합니다.`);
      }

      const currentShares = toSafeShares((current.stockShares || {})[stockId] || 0);
      const newShares = toSafeShares(currentShares + effectiveShares);
      if (newShares <= currentShares) {
        throw new BusinessRuleError('매수 수량이 너무 작아 체결할 수 없습니다.');
      }
      const updatedSharesMap = sanitizeStockSharesMap({
        ...(current.stockShares || {}),
        [stockId]: newShares
      });

      const updated: Student = {
        ...current,
        cash: liveCash - totalCost,
        stockShares: updatedSharesMap,
        recentActivity: `${stock.name} 매수`,
        balanceVersion: (current.balanceVersion || 0) + 1,
        updatedAtMs: Date.now()
      };
      const cleaned = cleanFirestoreData(updated);
      tx.set(studentRef, cleaned, getReplaceTopLevelMergeOptions(cleaned));
      return { updated, totalCost, effectiveShares, stockName: stock.name };
    });

    return {
      ok: true,
      student: res.updated,
      actualAmount: res.totalCost,
      actualShares: res.effectiveShares,
      stockName: res.stockName
    };
  } catch (err: any) {
    if (err instanceof BusinessRuleError) {
      return { ok: false, error: err.message };
    }
    if (isQuotaOrNetworkFailure(err)) {
      return { ok: false, fallbackToLocal: true };
    }
    console.warn('runAtomicBuyStock error:', err);
    return { ok: false, error: '주식 매수 처리 중 오류가 발생했습니다.' };
  }
}

/**
 * Atomic Stock Sell: Uses LIVE Firestore stock prices & student shares inside the transaction.
 */
export async function runAtomicSellStock(
  classCode: string,
  studentId: string,
  stockId: string,
  shares: number,
  customAmount?: number,
  fallbackStocks?: StockInfo[],
  fallbackStudent?: Student
): Promise<AtomicStudentResult> {
  if (!classCode || !studentId || !stockId) {
    return { ok: false, error: '주식 매도 정보가 올바르지 않습니다.' };
  }
  if (isFirestoreQuotaExceeded()) {
    return { ok: false, fallbackToLocal: true };
  }
  try {
    const classRef = doc(db, 'classes', classCode);
    const studentRef = doc(db, 'classes', classCode, 'students', studentId);

    const res = await runTransaction(db, async (tx) => {
      const [classSnap, studentSnap] = await Promise.all([tx.get(classRef), tx.get(studentRef)]);
      const classData = classSnap.exists() ? classSnap.data() : null;
      if (classData?.isTradingFrozen) {
        throw new BusinessRuleError('현재 거래 정지 상태입니다.');
      }

      const liveStocks: StockInfo[] =
        Array.isArray(classData?.stocks) && classData.stocks.length > 0
          ? classData.stocks
          : (fallbackStocks || []);
      const stock = liveStocks.find((s) => s.id === stockId);
      if (!stock || (stock.currentPrice || 0) <= 0) {
        throw new BusinessRuleError('해당 주식 종목 정보를 찾을 수 없습니다.');
      }

      const current = studentSnap.exists()
        ? sanitizeFirestoreStudent(studentSnap.data(), studentId)
        : (fallbackStudent ? sanitizeFirestoreStudent(fallbackStudent, studentId) : null);
      if (!current) {
        throw new BusinessRuleError('학생 정보를 찾을 수 없습니다.');
      }

      const currentShares = toSafeShares((current.stockShares || {})[stockId] || 0);
      if (currentShares <= 0) {
        throw new BusinessRuleError(`보유 중인 ${stock.name} 주식이 없습니다.`);
      }

      let totalReturn: number;
      let effectiveShares: number;

      if (customAmount !== undefined && customAmount > 0) {
        const requestedReturn = toSafeInt(customAmount, 0);
        if (requestedReturn <= 0) {
          throw new BusinessRuleError('매도 금액은 1원 이상이어야 합니다.');
        }
        const maxPossibleReturn = calcSellReturnFromShares(currentShares, stock.currentPrice);
        if (maxPossibleReturn <= 0) {
          throw new BusinessRuleError('매도 가능한 주식 평가액이 1원 미만입니다.');
        }
        if (requestedReturn >= maxPossibleReturn) {
          totalReturn = maxPossibleReturn;
          effectiveShares = currentShares;
        } else {
          totalReturn = requestedReturn;
          effectiveShares = Math.min(currentShares, calcSellSharesFromAmount(totalReturn, stock.currentPrice));
        }
      } else {
        if (!Number.isFinite(shares) || shares <= 0) {
          throw new BusinessRuleError('매도 수량은 0주보다 커야 합니다.');
        }
        effectiveShares = Math.min(currentShares, toSafeShares(shares));
        totalReturn = calcSellReturnFromShares(effectiveShares, stock.currentPrice);
      }

      if (totalReturn <= 0 || effectiveShares <= 0) {
        throw new BusinessRuleError('매도 금액 또는 수량이 너무 작습니다.');
      }

      const remainingShares = toSafeShares(currentShares - effectiveShares);
      if (remainingShares >= currentShares) {
        throw new BusinessRuleError('매도 수량이 정상적으로 차감되지 않아 거래가 취소되었습니다.');
      }

      const updatedSharesMap = sanitizeStockSharesMap({
        ...(current.stockShares || {}),
        [stockId]: remainingShares
      });

      const updated: Student = {
        ...current,
        cash: toSafeInt(current.cash) + totalReturn,
        stockShares: updatedSharesMap,
        recentActivity: `${stock.name} 매도`,
        balanceVersion: (current.balanceVersion || 0) + 1,
        updatedAtMs: Date.now()
      };
      const cleaned = cleanFirestoreData(updated);
      tx.set(studentRef, cleaned, getReplaceTopLevelMergeOptions(cleaned));
      return { updated, totalReturn, effectiveShares, stockName: stock.name };
    });

    return {
      ok: true,
      student: res.updated,
      actualAmount: res.totalReturn,
      actualShares: res.effectiveShares,
      stockName: res.stockName
    };
  } catch (err: any) {
    if (err instanceof BusinessRuleError) {
      return { ok: false, error: err.message };
    }
    if (isQuotaOrNetworkFailure(err)) {
      return { ok: false, fallbackToLocal: true };
    }
    console.warn('runAtomicSellStock error:', err);
    return { ok: false, error: '주식 매도 처리 중 오류가 발생했습니다.' };
  }
}

/**
 * Atomic Shop Purchase: Checks live cash >= item.price and appends coupon atomically.
 */
export async function runAtomicBuyShopItem(
  classCode: string,
  studentId: string,
  item: ShopItem,
  newCoupon: Coupon,
  fallbackStudent?: Student
): Promise<AtomicStudentResult> {
  const itemPrice = toSafeInt(item.price, 0);
  if (!classCode || !studentId || itemPrice < 0) {
    return { ok: false, error: '상점 결제 정보가 올바르지 않습니다.' };
  }
  if (isFirestoreQuotaExceeded()) {
    return { ok: false, fallbackToLocal: true };
  }
  try {
    const studentRef = doc(db, 'classes', classCode, 'students', studentId);

    const committed = await runTransaction(db, async (tx) => {
      const studentSnap = await tx.get(studentRef);
      const current = studentSnap.exists()
        ? sanitizeFirestoreStudent(studentSnap.data(), studentId)
        : (fallbackStudent ? sanitizeFirestoreStudent(fallbackStudent, studentId) : null);
      if (!current) {
        throw new BusinessRuleError('학생 정보를 찾을 수 없습니다.');
      }

      const liveCash = toSafeInt(current.cash);
      if (liveCash < itemPrice) {
        throw new BusinessRuleError(`보유 현금(${liveCash.toLocaleString()}원)이 부족합니다.`);
      }

      const updated: Student = {
        ...current,
        cash: liveCash - itemPrice,
        recentActivity: `${item.name} 결제`,
        couponsOwned: [newCoupon, ...(current.couponsOwned || [])],
        balanceVersion: (current.balanceVersion || 0) + 1,
        updatedAtMs: Date.now()
      };
      const cleaned = cleanFirestoreData(updated);
      tx.set(studentRef, cleaned, getReplaceTopLevelMergeOptions(cleaned));
      return updated;
    });

    return { ok: true, student: committed, actualAmount: itemPrice };
  } catch (err: any) {
    if (err instanceof BusinessRuleError) {
      return { ok: false, error: err.message };
    }
    if (isQuotaOrNetworkFailure(err)) {
      return { ok: false, fallbackToLocal: true };
    }
    console.warn('runAtomicBuyShopItem error:', err);
    return { ok: false, error: '상점 결제 처리 중 오류가 발생했습니다.' };
  }
}

/**
 * Atomic Money Transfer: Reads BOTH sender AND receiver from Firestore in the SAME transaction,
 * so the receiver's live balance is NEVER overwritten by stale sender cache!
 */
export async function runAtomicTransferMoney(
  classCode: string,
  senderId: string,
  receiverId: string | null,
  amount: number,
  senderActivity: string,
  receiverActivity: string,
  fallbackSender?: Student,
  fallbackReceiver?: Student | null
): Promise<AtomicStudentResult> {
  const cleanAmt = toSafeInt(amount, 0);
  if (!classCode || !senderId || cleanAmt <= 0) {
    return { ok: false, error: '1원 이상의 송금 금액을 입력해 주세요.' };
  }
  if (receiverId && receiverId === senderId) {
    return { ok: false, error: '본인에게는 송금할 수 없습니다.' };
  }
  if (isFirestoreQuotaExceeded()) {
    return { ok: false, fallbackToLocal: true };
  }
  try {
    const senderRef = doc(db, 'classes', classCode, 'students', senderId);
    const receiverRef = receiverId ? doc(db, 'classes', classCode, 'students', receiverId) : null;

    const result = await runTransaction(db, async (tx) => {
      const senderSnap = await tx.get(senderRef);
      const receiverSnap = receiverRef ? await tx.get(receiverRef) : null;

      const sender = senderSnap.exists()
        ? sanitizeFirestoreStudent(senderSnap.data(), senderId)
        : (fallbackSender ? sanitizeFirestoreStudent(fallbackSender, senderId) : null);

      if (!sender) {
        throw new BusinessRuleError('송금 학생 정보를 찾을 수 없습니다.');
      }
      const liveSenderCash = toSafeInt(sender.cash);
      if (liveSenderCash < cleanAmt) {
        throw new BusinessRuleError(`보유 현금(${liveSenderCash.toLocaleString()}원)이 부족합니다.`);
      }

      const nowMs = Date.now();
      const updatedSender: Student = {
        ...sender,
        cash: liveSenderCash - cleanAmt,
        recentActivity: senderActivity,
        balanceVersion: (sender.balanceVersion || 0) + 1,
        updatedAtMs: nowMs
      };

      let updatedReceiver: Student | undefined;
      if (receiverRef && receiverId) {
        const receiver = receiverSnap && receiverSnap.exists()
          ? sanitizeFirestoreStudent(receiverSnap.data(), receiverId)
          : (fallbackReceiver ? sanitizeFirestoreStudent(fallbackReceiver, receiverId) : null);

        if (receiver) {
          updatedReceiver = {
            ...receiver,
            cash: toSafeInt(receiver.cash) + cleanAmt,
            recentActivity: receiverActivity,
            balanceVersion: (receiver.balanceVersion || 0) + 1,
            updatedAtMs: nowMs
          };
          const cleanedReceiver = cleanFirestoreData(updatedReceiver);
          tx.set(receiverRef, cleanedReceiver, getReplaceTopLevelMergeOptions(cleanedReceiver));
        }
      }

      const cleanedSender = cleanFirestoreData(updatedSender);
      tx.set(senderRef, cleanedSender, getReplaceTopLevelMergeOptions(cleanedSender));
      return { updatedSender, updatedReceiver };
    });

    return {
      ok: true,
      student: result.updatedSender,
      receiverStudent: result.updatedReceiver,
      actualAmount: cleanAmt
    };
  } catch (err: any) {
    if (err instanceof BusinessRuleError) {
      return { ok: false, error: err.message };
    }
    if (isQuotaOrNetworkFailure(err)) {
      return { ok: false, fallbackToLocal: true };
    }
    console.warn('runAtomicTransferMoney error:', err);
    return { ok: false, error: '송금 처리 중 오류가 발생했습니다.' };
  }
}

/**
 * Atomic Portfolio Rebalance: Computes cash/savings/shares against LIVE stock prices & student assets.
 */
export async function runAtomicRebalance(
  classCode: string,
  studentId: string,
  targetCashPct: number,
  targetSavingsPct: number,
  targetStockPct: number,
  fallbackStocks?: StockInfo[],
  fallbackStudent?: Student
): Promise<AtomicStudentResult> {
  if (!classCode || !studentId) {
    return { ok: false, error: '리밸런싱 정보가 올바르지 않습니다.' };
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
    return { ok: false, error: '목표 자산 비중의 합은 100%여야 합니다.' };
  }
  if (isFirestoreQuotaExceeded()) {
    return { ok: false, fallbackToLocal: true };
  }
  try {
    const classRef = doc(db, 'classes', classCode);
    const studentRef = doc(db, 'classes', classCode, 'students', studentId);

    const committed = await runTransaction(db, async (tx) => {
      const [classSnap, studentSnap] = await Promise.all([tx.get(classRef), tx.get(studentRef)]);
      const classData = classSnap.exists() ? classSnap.data() : null;
      if (classData?.isTradingFrozen) {
        throw new BusinessRuleError('현재 거래 정지 상태입니다.');
      }

      const stocksList: StockInfo[] =
        Array.isArray(classData?.stocks) && classData.stocks.length > 0
          ? classData.stocks
          : (fallbackStocks || []);

      const current = studentSnap.exists()
        ? sanitizeFirestoreStudent(studentSnap.data(), studentId)
        : (fallbackStudent ? sanitizeFirestoreStudent(fallbackStudent, studentId) : null);
      if (!current) {
        throw new BusinessRuleError('학생 정보를 찾을 수 없습니다.');
      }

      const currentSharesMap = current.stockShares || {};
      const currentTotalStock = toSafeInt(
        stocksList.reduce((sum, st) => sum + toSafeShares(currentSharesMap[st.id] || 0) * (st.currentPrice || 0), 0)
      );
      const totalAssets = toSafeInt(current.cash) + toSafeInt(current.savings) + currentTotalStock;
      if (totalAssets <= 0) {
        throw new BusinessRuleError('리밸런싱할 보유 자산이 없습니다.');
      }

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

      const updated: Student = {
        ...current,
        cash: toSafeInt(actualCashAmt),
        savings: toSafeInt(actualSavingsAmt),
        stockShares: cleanedShares,
        recentActivity: `자산 비중 리밸런싱 (${targetCashPct}% / ${targetSavingsPct}% / ${targetStockPct}%)`,
        balanceVersion: (current.balanceVersion || 0) + 1,
        updatedAtMs: Date.now()
      };
      const cleaned = cleanFirestoreData(updated);
      tx.set(studentRef, cleaned, getReplaceTopLevelMergeOptions(cleaned));
      return updated;
    });

    return { ok: true, student: committed };
  } catch (err: any) {
    if (err instanceof BusinessRuleError) {
      return { ok: false, error: err.message };
    }
    if (isQuotaOrNetworkFailure(err)) {
      return { ok: false, fallbackToLocal: true };
    }
    console.warn('runAtomicRebalance error:', err);
    return { ok: false, error: '리밸런싱 처리 중 오류가 발생했습니다.' };
  }
}

/**
 * Atomic Debt Repayment: Reads live cash & debt before deducting.
 */
export async function runAtomicRepayDebt(
  classCode: string,
  studentId: string,
  amount: number,
  fallbackStudent?: Student
): Promise<AtomicStudentResult> {
  const reqAmt = toSafeInt(amount, 0);
  if (!classCode || !studentId || reqAmt <= 0) {
    return { ok: false, error: '상환 금액은 1원 이상이어야 합니다.' };
  }
  if (isFirestoreQuotaExceeded()) {
    return { ok: false, fallbackToLocal: true };
  }
  try {
    const classRef = doc(db, 'classes', classCode);
    const studentRef = doc(db, 'classes', classCode, 'students', studentId);

    const res = await runTransaction(db, async (tx) => {
      const [classSnap, studentSnap] = await Promise.all([tx.get(classRef), tx.get(studentRef)]);
      if (classSnap.exists() && classSnap.data()?.isTradingFrozen) {
        throw new BusinessRuleError('현재 거래 정지 상태입니다.');
      }
      const current = studentSnap.exists()
        ? sanitizeFirestoreStudent(studentSnap.data(), studentId)
        : (fallbackStudent ? sanitizeFirestoreStudent(fallbackStudent, studentId) : null);
      if (!current) {
        throw new BusinessRuleError('학생 정보를 찾을 수 없습니다.');
      }

      const liveCash = toSafeInt(current.cash);
      const liveDebt = toSafeInt(current.debt);
      if (liveDebt <= 0) throw new BusinessRuleError('상환할 학급 부채(빚)가 없습니다.');
      if (liveCash <= 0) throw new BusinessRuleError('보유 현금이 부족합니다.');

      const cleanAmt = Math.min(liveCash, Math.min(liveDebt, reqAmt));
      if (cleanAmt <= 0) throw new BusinessRuleError('유효한 상환 금액이 아닙니다.');

      const updated: Student = {
        ...current,
        cash: liveCash - cleanAmt,
        debt: liveDebt - cleanAmt,
        recentActivity: `부채 상환 (-${cleanAmt.toLocaleString()}원)`,
        balanceVersion: (current.balanceVersion || 0) + 1,
        updatedAtMs: Date.now()
      };
      const cleaned = cleanFirestoreData(updated);
      tx.set(studentRef, cleaned, getReplaceTopLevelMergeOptions(cleaned));
      return { updated, cleanAmt };
    });

    return { ok: true, student: res.updated, actualAmount: res.cleanAmt };
  } catch (err: any) {
    if (err instanceof BusinessRuleError) {
      return { ok: false, error: err.message };
    }
    if (isQuotaOrNetworkFailure(err)) {
      return { ok: false, fallbackToLocal: true };
    }
    console.warn('runAtomicRepayDebt error:', err);
    return { ok: false, error: '부채 상환 중 오류가 발생했습니다.' };
  }
}

/**
 * Atomic Forgive Student Debt (Teacher): Reads live student debt before reducing.
 */
export async function runAtomicForgiveStudentDebt(
  classCode: string,
  studentId: string,
  amount?: number,
  fallbackStudent?: Student
): Promise<AtomicStudentResult> {
  if (!classCode || !studentId) {
    return { ok: false, error: '학생 정보가 올바르지 않습니다.' };
  }
  if (isFirestoreQuotaExceeded()) {
    return { ok: false, fallbackToLocal: true };
  }
  try {
    const studentRef = doc(db, 'classes', classCode, 'students', studentId);
    const res = await runTransaction(db, async (tx) => {
      const snap = await tx.get(studentRef);
      const current = snap.exists()
        ? sanitizeFirestoreStudent(snap.data(), studentId)
        : (fallbackStudent ? sanitizeFirestoreStudent(fallbackStudent, studentId) : null);
      if (!current) throw new BusinessRuleError('학생 정보를 찾을 수 없습니다.');

      const liveDebt = toSafeInt(current.debt);
      if (liveDebt <= 0) throw new BusinessRuleError('해당 학생에게 남은 부채가 없습니다.');

      const cleanAmt = amount !== undefined && amount > 0 ? Math.min(liveDebt, toSafeInt(amount)) : liveDebt;
      if (cleanAmt <= 0) throw new BusinessRuleError('탕감할 부채 금액이 올바르지 않습니다.');

      const updated: Student = {
        ...current,
        debt: liveDebt - cleanAmt,
        recentActivity: `부채 ${cleanAmt.toLocaleString()}원 탕감`,
        balanceVersion: (current.balanceVersion || 0) + 1,
        updatedAtMs: Date.now()
      };
      const cleaned = cleanFirestoreData(updated);
      tx.set(studentRef, cleaned, getReplaceTopLevelMergeOptions(cleaned));
      return { updated, cleanAmt };
    });

    return { ok: true, student: res.updated, actualAmount: res.cleanAmt };
  } catch (err: any) {
    if (err instanceof BusinessRuleError) {
      return { ok: false, error: err.message };
    }
    if (isQuotaOrNetworkFailure(err)) {
      return { ok: false, fallbackToLocal: true };
    }
    console.warn('runAtomicForgiveStudentDebt error:', err);
    return { ok: false, error: '부채 탕감 중 오류가 발생했습니다.' };
  }
}

/**
 * Atomic Teacher Round Settlement:
 * Always fetches LATEST students & class doc directly from Firestore BEFORE calculating interest,
 * preventing stale teacher roster cache from overwriting student trades/deposits!
 */
export interface AtomicSettlementResult {
  ok: boolean;
  nextRound?: number;
  settledRound?: number;
  depositRate?: number;
  newsMessage?: string;
  stocks?: StockInfo[];
  students?: Student[];
  transactions?: Transaction[];
  scheduledScenarios?: ScheduledRoundScenario[];
  previousClassSnapshot?: Partial<ClassEconomyState>;
  previousStudents?: Student[];
  fallbackToLocal?: boolean;
  error?: string;
}

export async function runAtomicTeacherSettlement(
  classCode: string,
  options: {
    depositRate?: number;
    stockPrices?: Record<string, number>;
    newsMessage?: string;
    targetRoundOverride?: number;
    markScenarioIdExecuted?: string;
    executeSettlement?: boolean; // default true
  },
  fallbackState: ClassEconomyState
): Promise<AtomicSettlementResult> {
  if (!classCode) return { ok: false, error: '학급 코드가 없습니다.' };
  if (isFirestoreQuotaExceeded()) {
    return { ok: false, fallbackToLocal: true };
  }

  try {
    const [liveClass, liveStudents] = await Promise.all([
      getClassFromFirestore(classCode),
      getStudentsFromFirestore(classCode)
    ]);

    const prevRound = liveClass?.currentRound ?? fallbackState.currentRound;
    const totalRounds = liveClass?.totalRounds ?? fallbackState.totalRounds;
    const prevDepositRate = liveClass?.depositInterestRate ?? fallbackState.depositInterestRate;
    const prevNewsMessage = liveClass?.newsMessage ?? fallbackState.newsMessage;
    const prevStocks = (liveClass?.stocks && liveClass.stocks.length > 0) ? liveClass.stocks : fallbackState.stocks;
    const prevScenarios = Array.isArray(liveClass?.scheduledScenarios)
      ? liveClass!.scheduledScenarios!
      : (fallbackState.scheduledScenarios || []);
    const baseStudents = (liveStudents && liveStudents.length > 0)
      ? deduplicateStudents(liveStudents).unique
      : deduplicateStudents(fallbackState.students).unique;

    const currencyUnit = liveClass?.currencyUnit ?? fallbackState.currencyUnit ?? '원';
    const nextRound = options.targetRoundOverride !== undefined
      ? Math.min(totalRounds, Math.max(1, options.targetRoundOverride))
      : Math.min(totalRounds, prevRound + 1);
    const effectiveDepositRate = options.depositRate !== undefined ? options.depositRate : prevDepositRate;

    let updatedStocks = prevStocks;
    if (options.stockPrices && Object.keys(options.stockPrices).length > 0) {
      updatedStocks = prevStocks.map(st => {
        const newPrice = options.stockPrices![st.id];
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

    const effectiveNews = options.newsMessage && options.newsMessage.trim()
      ? (options.newsMessage.trim().startsWith('📢') || options.newsMessage.trim().startsWith('🚨')
          ? options.newsMessage.trim()
          : `📢 ${options.newsMessage.trim()}`)
      : prevNewsMessage;

    const shouldSettle = options.executeSettlement !== false;
    const nowIso = new Date().toISOString();
    const nowFormatted = nowIso.replace('T', ' ').substring(0, 16);
    const nowTime = new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
    const nowMs = Date.now();
    const newTransactions: Transaction[] = [];

    const updatedStudents: Student[] = baseStudents.map(student => {
      const liveCash = toSafeInt(student.cash);
      const liveSavings = toSafeInt(student.savings);
      const liveDebt = toSafeInt(student.debt);
      const liveShares = sanitizeStockSharesMap(student.stockShares);

      const earnedInterest = shouldSettle ? toSafeInt(liveSavings * (effectiveDepositRate / 100)) : 0;
      const newSavings = liveSavings + earnedInterest;
      const stockVal = toSafeInt(
        updatedStocks.reduce((sum, st) => sum + (liveShares[st.id] || 0) * (st.currentPrice || 0), 0)
      );
      const totalAssets = Math.round(liveCash + newSavings + stockVal - liveDebt);

      const prevSnapshots = Array.isArray(student.roundHistory) ? [...student.roundHistory] : [];
      const prevSnap = prevSnapshots.find(s => s.round === prevRound - 1);
      const prevTotal = prevSnap ? prevSnap.totalAssets : (liveCash + liveSavings);
      const changeAmount = totalAssets - prevTotal;
      const changeRate = prevTotal > 0 ? parseFloat(((changeAmount / prevTotal) * 100).toFixed(1)) : 0;

      const newSnapshot: StudentRoundSnapshot = {
        round: prevRound,
        cash: liveCash,
        savings: newSavings,
        stockValue: stockVal,
        debt: liveDebt,
        totalAssets,
        changeAmount,
        changeRate,
        timestamp: nowFormatted,
        notes: shouldSettle
          ? (earnedInterest > 0 ? `이자 +${earnedInterest.toLocaleString()}${currencyUnit} 지급` : '정산 완료')
          : `Round ${nextRound} 예약 시나리오 전환`
      };

      const updatedRoundHistory = [...prevSnapshots.filter(s => s.round !== prevRound), newSnapshot]
        .sort((a, b) => a.round - b.round);

      if (earnedInterest > 0) {
        newTransactions.push({
          id: `tx-interest-${nowMs}-${student.id}`,
          studentId: student.id,
          studentName: student.name,
          type: 'deposit',
          amount: earnedInterest,
          round: prevRound,
          description: `Round ${prevRound} 예금 이자 지급 (+${effectiveDepositRate.toFixed(1)}%)`,
          timestamp: nowTime
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
          ? `Round ${prevRound} 예금 이자 +${earnedInterest.toLocaleString()}${currencyUnit}`
          : `Round ${nextRound} 시작 (자산 변동 갱신)`,
        balanceVersion: (student.balanceVersion || 0) + 1,
        updatedAtMs: nowMs
      };
    });

    const updatedScenarios = options.markScenarioIdExecuted
      ? prevScenarios.map(sc =>
          sc.id === options.markScenarioIdExecuted
            ? { ...sc, status: 'executed' as const, executedAt: nowIso, updatedAt: nowIso }
            : sc
        )
      : prevScenarios;

    // 1. Write student batches atomically (preserving live online presence fields)
    await syncMultipleStudentProfilesFromTeacher(classCode, updatedStudents);

    // 2. Write updated class doc
    const classRef = doc(db, 'classes', classCode);
    await setDoc(
      classRef,
      cleanFirestoreData({
        currentRound: nextRound,
        depositInterestRate: effectiveDepositRate,
        newsMessage: effectiveNews,
        stocks: updatedStocks,
        scheduledScenarios: updatedScenarios,
        updatedAt: nowIso
      }),
      { merge: true }
    );

    return {
      ok: true,
      nextRound,
      settledRound: prevRound,
      depositRate: effectiveDepositRate,
      newsMessage: effectiveNews,
      stocks: updatedStocks,
      students: updatedStudents,
      transactions: newTransactions,
      scheduledScenarios: updatedScenarios,
      previousClassSnapshot: {
        currentRound: prevRound,
        depositInterestRate: prevDepositRate,
        newsMessage: prevNewsMessage,
        stocks: prevStocks,
        scheduledScenarios: prevScenarios
      },
      previousStudents: baseStudents
    };
  } catch (err: any) {
    if (isQuotaOrNetworkFailure(err)) {
      return { ok: false, fallbackToLocal: true };
    }
    console.warn('runAtomicTeacherSettlement error:', err);
    return { ok: false, error: '라운드 정산 중 오류가 발생했습니다.' };
  }
}

/**
 * Atomic Fine or Reward:
 * Runs per-student Firestore runTransaction against live balances & live stock prices!
 */
export async function runAtomicFineOrReward(
  classCode: string,
  type: 'fine' | 'reward',
  amount: number,
  reason: string,
  targetStudentIds: string[],
  fallbackStudents: Student[],
  fallbackStocks: StockInfo[],
  currencyUnit: string = '원',
  currentRound: number = 1
): Promise<{
  ok: boolean;
  summary?: FineRewardResultSummary;
  updatedStudentsMap?: Record<string, Student>;
  transactions?: Transaction[];
  fallbackToLocal?: boolean;
  error?: string;
}> {
  const roundAmount = Math.max(1, toSafeInt(amount, 0));
  if (!classCode || targetStudentIds.length === 0 || roundAmount <= 0) {
    return { ok: false, error: '상벌금 적용 대상 또는 금액이 올바르지 않습니다.' };
  }
  if (isFirestoreQuotaExceeded()) {
    return { ok: false, fallbackToLocal: true };
  }

  try {
    const classSnap = await getDoc(doc(db, 'classes', classCode));
    const classData = classSnap.exists() ? classSnap.data() : null;
    const liveStocks: StockInfo[] =
      Array.isArray(classData?.stocks) && classData.stocks.length > 0
        ? classData.stocks
        : fallbackStocks;
    const activeRound = classData?.currentRound ?? currentRound;
    const effectiveReason = reason.trim() || (type === 'reward' ? '학급 활동 상금' : '학급 규칙 위반 벌금');

    const updatedStudentsMap: Record<string, Student> = {};
    const generatedTxs: Transaction[] = [];
    const records: StudentFineRewardRecord[] = [];
    const nowTime = new Date().toISOString().replace('T', ' ').substring(0, 16);

    let totalCashDeducted = 0;
    let totalSavingsDeducted = 0;
    let totalStockLiquidated = 0;
    let totalNewDebt = 0;
    let totalDebtRepaid = 0;

    // Execute per-student atomic transactions in parallel chunks of 10
    const chunkSize = 10;
    for (let i = 0; i < targetStudentIds.length; i += chunkSize) {
      const chunk = targetStudentIds.slice(i, i + chunkSize);
      await Promise.all(
        chunk.map(async (studentId) => {
          const fallbackSt = fallbackStudents.find(s => s.id === studentId);
          const studentRef = doc(db, 'classes', classCode, 'students', studentId);

          const res = await runTransaction(db, async (tx) => {
            const snap = await tx.get(studentRef);
            const s = snap.exists()
              ? sanitizeFirestoreStudent(snap.data(), studentId)
              : (fallbackSt ? sanitizeFirestoreStudent(fallbackSt, studentId) : null);
            if (!s) return null;

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
              const cleanedReward = cleanFirestoreData(updated);
              tx.set(studentRef, cleanedReward, getReplaceTopLevelMergeOptions(cleanedReward));

              const record: StudentFineRewardRecord = {
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
              };

              return { updated, record, txDesc: desc, debtRepaid, cashDeducted: 0, savingsDeducted: 0, stockLiquidatedAmt: 0, newDebtIncurred: 0 };
            }

            // FINE LOGIC: CASH -> SAVINGS -> STOCKS -> DEBT
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

            const updatedShares: Record<string, number> = { ...liveShares };
            if (remainingFine > 0 && liveStocks.length > 0) {
              for (const st of liveStocks) {
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
                    liquidatedStocks.push({
                      stockId: st.id,
                      stockName: st.name,
                      shares: sharesHeld,
                      amount: holdingVal
                    });
                  } else {
                    const soldVal = remainingFine;
                    const actualSold = Math.min(sharesHeld, calcSellSharesFromAmount(soldVal, price));
                    stockLiquidatedAmt += soldVal;
                    remainingFine = 0;
                    updatedShares[st.id] = toSafeShares(sharesHeld - actualSold);
                    liquidatedStocks.push({
                      stockId: st.id,
                      stockName: st.name,
                      shares: actualSold,
                      amount: soldVal
                    });
                  }
                }
              }
            }

            if (remainingFine > 0) {
              newDebtIncurred = remainingFine;
              remainingFine = 0;
            }
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
            const cleanedFine = cleanFirestoreData(updated);
            tx.set(studentRef, cleanedFine, getReplaceTopLevelMergeOptions(cleanedFine));

            const record: StudentFineRewardRecord = {
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
            };

            return { updated, record, txDesc, debtRepaid: 0, cashDeducted, savingsDeducted, stockLiquidatedAmt, newDebtIncurred };
          });

          if (res) {
            updatedStudentsMap[res.updated.id] = res.updated;
            records.push(res.record);
            totalCashDeducted += res.cashDeducted;
            totalSavingsDeducted += res.savingsDeducted;
            totalStockLiquidated += res.stockLiquidatedAmt;
            totalNewDebt += res.newDebtIncurred;
            totalDebtRepaid += res.debtRepaid;

            generatedTxs.push({
              id: `tx-${type}-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
              studentId: res.updated.id,
              studentName: res.updated.name,
              type,
              amount: roundAmount,
              description: res.txDesc,
              round: activeRound,
              timestamp: nowTime
            });
          }
        })
      );
    }

    records.sort((a, b) => (a.studentNumber || 0) - (b.studentNumber || 0));

    return {
      ok: true,
      summary: {
        type,
        amount: roundAmount,
        reason: effectiveReason,
        targetCount: records.length,
        totalCashDeducted,
        totalSavingsDeducted,
        totalStockLiquidated,
        totalNewDebt,
        totalDebtRepaid,
        records
      },
      updatedStudentsMap,
      transactions: generatedTxs
    };
  } catch (err: any) {
    if (isQuotaOrNetworkFailure(err)) {
      return { ok: false, fallbackToLocal: true };
    }
    console.warn('runAtomicFineOrReward error:', err);
    return { ok: false, error: '상벌금 처리 중 오류가 발생했습니다.' };
  }
}

/**
 * Atomic Claim for Scheduled Round Scenario Execution:
 * Prevents multiple open clients (teacher + 25 students) from executing the same scheduled round twice!
 */
export async function claimScheduledScenarioExecution(
  classCode: string,
  scenarioId: string,
  forceManualTrigger: boolean = false
): Promise<{ claimed: boolean; scenario?: ScheduledRoundScenario; fallbackToLocal?: boolean }> {
  if (!classCode || !scenarioId) return { claimed: false };
  if (isFirestoreQuotaExceeded()) return { claimed: false, fallbackToLocal: true };
  try {
    const classRef = doc(db, 'classes', classCode);
    const result = await runTransaction(db, async (tx) => {
      const snap = await tx.get(classRef);
      if (!snap.exists()) return { claimed: false as const };
      const data = snap.data();
      const scenarios: ScheduledRoundScenario[] = Array.isArray(data?.scheduledScenarios)
        ? data.scheduledScenarios
        : [];
      const idx = scenarios.findIndex(s => s.id === scenarioId);
      if (idx === -1) return { claimed: false as const };

      const target = scenarios[idx];
      if (target.status !== 'pending') return { claimed: false as const };
      if (!forceManualTrigger && Date.now() < target.scheduledAtMs) return { claimed: false as const };

      // Avoid double advancing past targetRound if already reached
      const currentRound = Number(data?.currentRound || 1);
      if (currentRound >= target.targetRound) {
        // Mark executed so it stops re-triggering
        const updatedScenarios = scenarios.map(s =>
          s.id === scenarioId ? { ...s, status: 'executed' as const, executedAt: new Date().toISOString() } : s
        );
        tx.update(classRef, { scheduledScenarios: cleanFirestoreData(updatedScenarios) });
        return { claimed: false as const };
      }

      const claimedScenario: ScheduledRoundScenario = {
        ...target,
        status: 'executing',
        updatedAt: new Date().toISOString()
      };
      const updatedScenarios = scenarios.map(s => (s.id === scenarioId ? claimedScenario : s));
      tx.update(classRef, { scheduledScenarios: cleanFirestoreData(updatedScenarios) });
      return { claimed: true as const, scenario: claimedScenario };
    });

    return result;
  } catch (err: any) {
    if (isQuotaOrNetworkFailure(err)) {
      return { claimed: false, fallbackToLocal: true };
    }
    console.warn('claimScheduledScenarioExecution error:', err);
    return { claimed: false };
  }
}

export async function resetScheduledScenarioToPending(classCode: string, scenarioId: string): Promise<void> {
  if (!classCode || !scenarioId || isFirestoreQuotaExceeded()) return;
  try {
    const classRef = doc(db, 'classes', classCode);
    await runTransaction(db, async (tx) => {
      const snap = await tx.get(classRef);
      if (!snap.exists()) return;
      const scenarios: ScheduledRoundScenario[] = Array.isArray(snap.data()?.scheduledScenarios)
        ? snap.data()!.scheduledScenarios
        : [];
      const updated = scenarios.map(s =>
        s.id === scenarioId && s.status === 'executing'
          ? { ...s, status: 'pending' as const, updatedAt: new Date().toISOString() }
          : s
      );
      tx.update(classRef, { scheduledScenarios: cleanFirestoreData(updated) });
    });
  } catch (err) {
    console.warn('resetScheduledScenarioToPending error:', err);
  }
}

// ============================================================================
// SUPER ADMIN (통합 관리자) FIRESTORE HELPERS
// ============================================================================

export interface SuperAdminClassSummary {
  classCode: string;
  className: string;
  teacherName: string;
  teacherEmail: string;
  currentRound: number;
  totalRounds: number;
  updatedAt: string;
  studentCount?: number;
}

export async function fetchAllTeachersFromFirestore(): Promise<TeacherAccount[]> {
  if (isFirestoreQuotaExceeded()) return [];
  try {
    const snap = await getDocs(collection(db, 'teachers'));
    const list: TeacherAccount[] = [];
    snap.forEach((d) => {
      const data = d.data() as TeacherAccount;
      if (data && (data.email || data.teacherId || data.name)) {
        list.push({
          ...data,
          teacherId: data.teacherId || d.id
        });
      }
    });
    return list.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
  } catch (err) {
    checkAndHandleFirestoreError(err);
    console.warn('fetchAllTeachersFromFirestore error:', err);
    return [];
  }
}

export async function fetchAllClassesFromFirestore(): Promise<SuperAdminClassSummary[]> {
  if (isFirestoreQuotaExceeded()) return [];
  try {
    const snap = await getDocs(collection(db, 'classes'));
    const list: SuperAdminClassSummary[] = [];
    snap.forEach((d) => {
      const data = d.data() as any;
      if (data) {
        list.push({
          classCode: data.classCode || d.id,
          className: data.className || '우리반',
          teacherName: data.teacherName || '',
          teacherEmail: data.teacherEmail || '',
          currentRound: Number(data.currentRound) || 1,
          totalRounds: Number(data.totalRounds) || 10,
          updatedAt: data.updatedAt || ''
        });
      }
    });
    return list.sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
  } catch (err) {
    checkAndHandleFirestoreError(err);
    console.warn('fetchAllClassesFromFirestore error:', err);
    return [];
  }
}

export async function fetchClassStudentsForSuperAdmin(classCode: string): Promise<Student[]> {
  if (!classCode || isFirestoreQuotaExceeded()) return [];
  try {
    const snap = await getDocs(collection(db, 'classes', classCode, 'students'));
    const raw: Student[] = [];
    snap.forEach((d) => {
      raw.push(d.data() as Student);
    });
    return deduplicateStudents(raw).unique.sort((a, b) => (a.number || 0) - (b.number || 0));
  } catch (err) {
    checkAndHandleFirestoreError(err);
    console.warn('fetchClassStudentsForSuperAdmin error:', err);
    return [];
  }
}

export async function fetchClassFullSnapshotFromFirestore(classCode: string): Promise<{
  classState: Partial<ClassEconomyState> | null;
  students: Student[];
  transactions: Transaction[];
}> {
  if (!classCode || isFirestoreQuotaExceeded()) {
    return { classState: null, students: [], transactions: [] };
  }
  try {
    const [classSnap, studentsSnap, txSnap] = await Promise.all([
      getDoc(doc(db, 'classes', classCode)),
      getDocs(collection(db, 'classes', classCode, 'students')),
      getDocs(query(collection(db, 'classes', classCode, 'transactions'), orderBy('timestamp', 'desc'), limit(200)))
    ]);

    const classState = classSnap.exists() ? (classSnap.data() as Partial<ClassEconomyState>) : null;
    const rawStudents: Student[] = [];
    studentsSnap.forEach((d) => rawStudents.push(d.data() as Student));
    const students = deduplicateStudents(rawStudents).unique.sort((a, b) => (a.number || 0) - (b.number || 0));

    const transactions: Transaction[] = [];
    txSnap.forEach((d) => transactions.push(d.data() as Transaction));

    return { classState, students, transactions };
  } catch (err) {
    checkAndHandleFirestoreError(err);
    console.warn('fetchClassFullSnapshotFromFirestore error:', err);
    return { classState: null, students: [], transactions: [] };
  }
}

export async function deleteTeacherFromFirestore(teacherId: string): Promise<boolean> {
  if (!teacherId) return false;
  try {
    const docId = teacherId.replace(/[@.]/g, '_');
    await Promise.all([
      deleteDoc(doc(db, 'teachers', docId)).catch(() => {}),
      deleteDoc(doc(db, 'teachers', teacherId)).catch(() => {})
    ]);
    return true;
  } catch (err) {
    console.warn('deleteTeacherFromFirestore error:', err);
    return false;
  }
}

export async function deleteClassCompletelyFromFirestore(classCode: string): Promise<boolean> {
  if (!classCode) return false;
  try {
    const studentsSnap = await getDocs(collection(db, 'classes', classCode, 'students'));
    const txSnap = await getDocs(collection(db, 'classes', classCode, 'transactions'));
    const batch = writeBatch(db);
    let ops = 0;
    studentsSnap.forEach((d) => {
      batch.delete(d.ref);
      ops++;
    });
    txSnap.forEach((d) => {
      if (ops < 450) {
        batch.delete(d.ref);
        ops++;
      }
    });
    batch.delete(doc(db, 'classes', classCode));
    await batch.commit();
    return true;
  } catch (err) {
    console.warn('deleteClassCompletelyFromFirestore error:', err);
    return false;
  }
}


