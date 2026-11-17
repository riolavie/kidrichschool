import React, { useState } from 'react';
import { useClassEconomy, MAX_STOCKS, MAX_SCHEDULED_SCENARIOS } from '../context/ClassEconomyContext';
import { SettlementModal } from './SettlementModal';
import { BulkStudentModal } from './BulkStudentModal';
import { AddShopItemModal } from './AddShopItemModal';
import { TeacherStudentPinModal } from './TeacherStudentPinModal';
import { TeacherNewsletterManager } from './TeacherNewsletterManager';
import { TeacherStudentAssetDashboard } from './TeacherStudentAssetDashboard';
import { Student, FineRewardResultSummary, ScheduledRoundScenario } from '../types';
import { deduplicateStudents } from '../lib/studentDeduplication';

export const TeacherAdmin: React.FC = () => {
  const {
    state,
    currentTeacher,
    isSuperAdminSession,
    returnToSuperAdmin,
    logout,
    isSyncing,
    lastSyncedAt,
    refreshClassData,
    updateClassSettings,
    updateTeacherProfile,
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
    setRound,
    restorePreviousState,
    applyFineOrReward,
    approvePinReset,
    updateStudentPinByTeacher,
    updateMultipleStudentsPinByTeacher,
    resetAllPins,
    deleteStudent,
    deleteMultipleStudents,
    removeDuplicateStudents,
    repairAllStudentBalancesConsistency,
    deleteTransaction,
    deleteMultipleTransactions,
    clearAllTransactions,
    calculateTotalAssets,
    deleteShopItem,
    toggleCouponTeacherConfirm,
    batchSetCouponsTeacherConfirm,
    forgiveStudentDebt,
    resetAllData,
    exportFullBackupJSON,
    importFullBackupJSON
  } = useClassEconomy();

  const [activeTab, setActiveTab] = useState<'general' | 'scenario' | 'newsletter' | 'students' | 'student_asset_dashboard' | 'shop_fines' | 'leaderboard' | 'asset_history'>('general');
  const [selectedAnalyticsStudentId, setSelectedAnalyticsStudentId] = useState<string>('');

  const navTabsRef = React.useRef<HTMLDivElement>(null);

  const handleScrollNav = (direction: 'left' | 'right') => {
    if (navTabsRef.current) {
      const scrollAmount = direction === 'left' ? -280 : 280;
      navTabsRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    }
  };

  // Teacher Profile State
  const [teacherNameInput, setTeacherNameInput] = useState<string>(
    currentTeacher?.name || state.teacherName || '김선생'
  );
  const [teacherEmailInput, setTeacherEmailInput] = useState<string>(
    currentTeacher?.email || state.teacherEmail || ''
  );
  const [schoolNameInput, setSchoolNameInput] = useState<string>(
    currentTeacher?.schoolName || ''
  );
  const [gradeInput, setGradeInput] = useState<string>(
    currentTeacher?.grade || ''
  );
  const [classNumInput, setClassNumInput] = useState<string>(
    currentTeacher?.classNum || ''
  );
  const [teacherPasswordInput, setTeacherPasswordInput] = useState<string>('');

  // General Settings State
  const [classNameInput, setClassNameInput] = useState<string>(state.className);
  const [classCodeInput, setClassCodeInput] = useState<string>(state.classCode);
  const [currencyUnitInput, setCurrencyUnitInput] = useState<string>(state.currencyUnit || '원');
  const [totalRoundsInput, setTotalRoundsInput] = useState<number>(state.totalRounds);
  const [currentRoundSetting, setCurrentRoundSetting] = useState<number>(state.currentRound);
  const [languageInput, setLanguageInput] = useState<string>(state.language || 'ko');
  const [isLeaderboardPublicInput, setIsLeaderboardPublicInput] = useState<boolean>(
    state.isLeaderboardPublic !== false
  );

  // Selected student rows for batch deletion
  const [selectedStudentRowIds, setSelectedStudentRowIds] = useState<string[]>([]);

  // Leaderboard Search & Filter state
  const [leaderboardSearch, setLeaderboardSearch] = useState<string>('');
  const [leaderboardFilter, setLeaderboardFilter] = useState<'all' | 'online' | 'top3' | 'top10'>('all');
  const [syncNotice, setSyncNotice] = useState<string>('');

  // Asset History Table State
  const [assetHistoryStudentFilter, setAssetHistoryStudentFilter] = useState<string>('all');
  const [assetHistoryCategoryFilter, setAssetHistoryCategoryFilter] = useState<string>('all');
  const [assetHistorySearch, setAssetHistorySearch] = useState<string>('');
  const [selectedTxRowIds, setSelectedTxRowIds] = useState<string[]>([]);
  const [isDeletingTx, setIsDeletingTx] = useState<boolean>(false);

  // Shop Purchases & Coupon Verification State
  const [purchaseSearch, setPurchaseSearch] = useState<string>('');
  const [purchaseDateFilter, setPurchaseDateFilter] = useState<'all' | 'today' | '3days' | '7days' | 'custom'>('all');
  const [purchaseCustomDate, setPurchaseCustomDate] = useState<string>('');
  const [purchaseStatusFilter, setPurchaseStatusFilter] = useState<'all' | 'pending_request' | 'unconfirmed' | 'confirmed' | 'holding'>('all');
  const [purchaseUsageFilter, setPurchaseUsageFilter] = useState<'all' | 'used' | 'unused'>('all');
  const [purchaseItemFilter, setPurchaseItemFilter] = useState<string>('all');
  const [selectedPurchaseKeys, setSelectedPurchaseKeys] = useState<string[]>([]);
  const [purchaseViewMode, setPurchaseViewMode] = useState<'list' | 'by_student'>('list');
  const [purchaseActionNotice, setPurchaseActionNotice] = useState<string>('');

  const formatSyncTime = (date: Date | null) => {
    if (!date) return '방금 전';
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    return `${hours}:${minutes}:${seconds}`;
  };

  const handleManualSync = async () => {
    const success = await refreshClassData();
    if (success) {
      setSyncNotice('동기화 완료!');
      setTimeout(() => setSyncNotice(''), 3000);
    }
  };

  React.useEffect(() => {
    setClassNameInput(state.className);
    setClassCodeInput(state.classCode);
    setCurrencyUnitInput(state.currencyUnit || '원');
    setTotalRoundsInput(state.totalRounds);
    setCurrentRoundSetting(state.currentRound);
    setLanguageInput(state.language || 'ko');
    setIsLeaderboardPublicInput(state.isLeaderboardPublic !== false);
    if (currentTeacher?.name || state.teacherName) {
      setTeacherNameInput(currentTeacher?.name || state.teacherName || '');
    }
    if (currentTeacher?.email || state.teacherEmail) {
      setTeacherEmailInput(currentTeacher?.email || state.teacherEmail || '');
    }
    if (currentTeacher?.schoolName) {
      setSchoolNameInput(currentTeacher.schoolName);
    }
    if (currentTeacher?.grade) {
      setGradeInput(currentTeacher.grade);
    }
    if (currentTeacher?.classNum) {
      setClassNumInput(currentTeacher.classNum);
    }
  }, [state.className, state.classCode, state.currencyUnit, state.totalRounds, state.currentRound, state.language, state.teacherName, state.teacherEmail, state.isLeaderboardPublic, currentTeacher]);

  // Scenario state
  const [depositRate, setDepositRate] = useState<number>(state.depositInterestRate);
  const [stockPrices, setStockPrices] = useState<Record<string, number>>({});
  const [newsInput, setNewsInput] = useState<string>(
    state.newsMessage ? state.newsMessage.replace(/^📢\s*/, '') : '정부, 인공지능 기술 개발에 대규모 지원금 투입 확정! IT 관련 기업들의 가파른 성장이 기대됩니다.'
  );

  React.useEffect(() => {
    setDepositRate(state.depositInterestRate);
  }, [state.depositInterestRate]);

  React.useEffect(() => {
    if (state.newsMessage) {
      setNewsInput(state.newsMessage.replace(/^📢\s*/, ''));
    }
  }, [state.newsMessage]);

  // Sync stock prices state from context
  React.useEffect(() => {
    const map: Record<string, number> = {};
    state.stocks.forEach(s => {
      map[s.id] = s.currentPrice;
    });
    setStockPrices(map);
  }, [state.stocks]);

  // Add Stock Modal/Form state
  const [isAddStockOpen, setIsAddStockOpen] = useState(false);
  const [newStockName, setNewStockName] = useState('');
  const [newStockCategory, setNewStockCategory] = useState('');
  const [newStockPrice, setNewStockPrice] = useState<number>(5000);

  // Scheduled Round Scenarios (up to 5 upcoming rounds, auto-saved & time-triggered)
  const formatLocalDateTimeInput = (isoString?: string) => {
    const d = isoString ? new Date(isoString) : new Date(Date.now() + 60 * 60 * 1000);
    if (isNaN(d.getTime())) return '';
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const hh = String(d.getHours()).padStart(2, '0');
    const min = String(d.getMinutes()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}T${hh}:${min}`;
  };

  const upcomingTargetRounds = React.useMemo(() => {
    const list: number[] = [];
    for (let i = 1; i <= MAX_SCHEDULED_SCENARIOS; i++) {
      const r = state.currentRound + i;
      if (r <= Math.max(state.currentRound + MAX_SCHEDULED_SCENARIOS, state.totalRounds)) {
        list.push(r);
      }
    }
    return list;
  }, [state.currentRound, state.totalRounds]);

  const [selectedScheduleSlotIdx, setSelectedScheduleSlotIdx] = useState<number>(0);
  const activeTargetRound = upcomingTargetRounds[selectedScheduleSlotIdx] ?? (state.currentRound + 1);
  const existingScheduleForSlot = React.useMemo(
    () => (state.scheduledScenarios || []).find(s => s.targetRound === activeTargetRound),
    [state.scheduledScenarios, activeTargetRound]
  );

  const [scheduleDraftDate, setScheduleDraftDate] = useState<string>('');
  const [scheduleDraftDepositRate, setScheduleDraftDepositRate] = useState<number>(state.depositInterestRate);
  const [scheduleDraftStockPrices, setScheduleDraftStockPrices] = useState<Record<string, number>>({});
  const [scheduleDraftNews, setScheduleDraftNews] = useState<string>('');
  const [scheduleDraftNewsTitle, setScheduleDraftNewsTitle] = useState<string>('');
  const [scheduleDraftExecuteSettlement, setScheduleDraftExecuteSettlement] = useState<boolean>(true);
  const [scheduleAutoSaveStatus, setScheduleAutoSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [scheduleDirty, setScheduleDirty] = useState<boolean>(false);
  const [nowTick, setNowTick] = useState<number>(() => Date.now());

  // Sync scheduler draft when switching slot or loading saved data
  React.useEffect(() => {
    setScheduleDirty(false);
    setScheduleAutoSaveStatus(existingScheduleForSlot ? 'saved' : 'idle');
    if (existingScheduleForSlot) {
      setScheduleDraftDate(formatLocalDateTimeInput(existingScheduleForSlot.scheduledAt));
      setScheduleDraftDepositRate(existingScheduleForSlot.depositRate);
      const mergedPrices: Record<string, number> = {};
      state.stocks.forEach(st => {
        mergedPrices[st.id] = existingScheduleForSlot.stockPrices?.[st.id] ?? st.currentPrice;
      });
      setScheduleDraftStockPrices(mergedPrices);
      setScheduleDraftNews(existingScheduleForSlot.newsMessage || '');
      setScheduleDraftNewsTitle(existingScheduleForSlot.newsArticleTitle || '');
      setScheduleDraftExecuteSettlement(existingScheduleForSlot.executeSettlementOnTrigger !== false);
    } else {
      setScheduleDraftDate('');
      setScheduleDraftDepositRate(state.depositInterestRate);
      const basePrices: Record<string, number> = {};
      state.stocks.forEach(st => {
        basePrices[st.id] = st.currentPrice;
      });
      setScheduleDraftStockPrices(basePrices);
      setScheduleDraftNews('');
      setScheduleDraftNewsTitle(`Round ${activeTargetRound} 경제 속보`);
      setScheduleDraftExecuteSettlement(true);
    }
  }, [activeTargetRound, existingScheduleForSlot?.id]);

  // Keep live countdown refreshed every 10s
  React.useEffect(() => {
    const timer = setInterval(() => setNowTick(Date.now()), 10000);
    return () => clearInterval(timer);
  }, []);

  // Auto-save scheduler draft with 400ms debounce whenever edited and date is specified
  React.useEffect(() => {
    if (!scheduleDirty || !scheduleDraftDate) return;
    const parsedDate = new Date(scheduleDraftDate);
    if (isNaN(parsedDate.getTime())) return;

    setScheduleAutoSaveStatus('saving');
    const timer = setTimeout(() => {
      const res = upsertScheduledScenario({
        id: existingScheduleForSlot?.id,
        targetRound: activeTargetRound,
        scheduledAt: parsedDate.toISOString(),
        depositRate: scheduleDraftDepositRate,
        stockPrices: scheduleDraftStockPrices,
        newsMessage: scheduleDraftNews.trim() || `Round ${activeTargetRound} 예약 시나리오가 시작되었습니다!`,
        newsArticleTitle: scheduleDraftNewsTitle.trim() || `Round ${activeTargetRound} 경제 속보`,
        executeSettlementOnTrigger: scheduleDraftExecuteSettlement,
        status: existingScheduleForSlot?.status === 'executed' ? 'pending' : (existingScheduleForSlot?.status || 'pending')
      });
      if (res.success) {
        setScheduleAutoSaveStatus('saved');
        setScheduleDirty(false);
      } else {
        setScheduleAutoSaveStatus('idle');
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [
    scheduleDirty,
    scheduleDraftDate,
    scheduleDraftDepositRate,
    scheduleDraftStockPrices,
    scheduleDraftNews,
    scheduleDraftNewsTitle,
    scheduleDraftExecuteSettlement,
    activeTargetRound
  ]);

  const nextPendingSchedule = React.useMemo(() => {
    const pending = (state.scheduledScenarios || []).filter(s => s.status === 'pending');
    if (pending.length === 0) return null;
    return [...pending].sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime())[0];
  }, [state.scheduledScenarios]);

  const formatCountdown = (isoString: string) => {
    const diffMs = new Date(isoString).getTime() - nowTick;
    if (diffMs <= 0) return '곧 실행';
    const totalMins = Math.floor(diffMs / 60000);
    const days = Math.floor(totalMins / (60 * 24));
    const hours = Math.floor((totalMins % (60 * 24)) / 60);
    const mins = totalMins % 60;
    if (days > 0) return `${days}일 ${hours}시간 후`;
    if (hours > 0) return `${hours}시간 ${mins}분 후`;
    return `${Math.max(1, mins)}분 후`;
  };

  const applySchedulePresetMinutes = (minutesFromNow: number) => {
    const target = new Date(Date.now() + minutesFromNow * 60 * 1000);
    setScheduleDraftDate(formatLocalDateTimeInput(target.toISOString()));
    setScheduleDirty(true);
  };

  const applyScheduleTomorrowNineAm = () => {
    const target = new Date();
    target.setDate(target.getDate() + 1);
    target.setHours(9, 0, 0, 0);
    setScheduleDraftDate(formatLocalDateTimeInput(target.toISOString()));
    setScheduleDirty(true);
  };

  // Fine & Reward state
  const [targetType, setTargetType] = useState<'individual' | 'selected' | 'all'>('individual');
  const [selectedStudentId, setSelectedStudentId] = useState<string>('student_03');
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>(['student_01', 'student_03']);
  const [fineStudentSearch, setFineStudentSearch] = useState('');
  const [fineAmount, setFineAmount] = useState<number>(1000);
  const [fineReason, setFineReason] = useState<string>('숙제 미제출 벌금');
  const [fineSummaryModalData, setFineSummaryModalData] = useState<FineRewardResultSummary | null>(null);
  const [isFineSummaryModalOpen, setIsFineSummaryModalOpen] = useState<boolean>(false);

  // Selected targets for fine / reward
  const currentFineTargets = React.useMemo(() => {
    if (targetType === 'individual') {
      return state.students.filter(s => s.id === selectedStudentId);
    } else if (targetType === 'selected') {
      return state.students.filter(s => selectedStudentIds.includes(s.id));
    } else if (targetType === 'all') {
      return state.students;
    }
    return [];
  }, [targetType, selectedStudentId, selectedStudentIds, state.students]);

  // Live Fine Impact Simulation before applying
  const fineImpactSimulation = React.useMemo(() => {
    if (currentFineTargets.length === 0 || fineAmount <= 0) return null;
    let fullCashCount = 0;
    let savingsNeededCount = 0;
    let stockLiquidationCount = 0;
    let debtIncurredCount = 0;
    let totalPredictedDebt = 0;

    currentFineTargets.forEach(s => {
      let rem = fineAmount;
      const cash = Math.max(0, s.cash || 0);
      if (cash >= rem) {
        fullCashCount++;
        return;
      }
      rem -= cash;
      const savings = Math.max(0, s.savings || 0);
      if (savings >= rem) {
        savingsNeededCount++;
        return;
      }
      rem -= savings;
      if (savings > 0) savingsNeededCount++;

      // Check stock liquidation
      const stockVal = Math.round((state.stocks || []).reduce((sum, st) => sum + (s.stockShares[st.id] || 0) * (st.currentPrice || 0), 0));
      if (stockVal >= rem) {
        stockLiquidationCount++;
        return;
      }
      rem -= stockVal;
      if (stockVal > 0) stockLiquidationCount++;

      debtIncurredCount++;
      totalPredictedDebt += rem;
    });

    return {
      targetCount: currentFineTargets.length,
      fullCashCount,
      savingsNeededCount,
      stockLiquidationCount,
      debtIncurredCount,
      totalPredictedDebt
    };
  }, [currentFineTargets, fineAmount, state.stocks]);

  // Search & Filter
  const [studentSearch, setStudentSearch] = useState('');
  const [studentStatusFilter, setStudentStatusFilter] = useState<'all' | 'pin_reset' | 'debt'>('all');
  const [roundInput, setRoundInput] = useState<number>(state.currentRound + 1);

  // Modals
  const [isSettlementOpen, setIsSettlementOpen] = useState(false);
  const [isBulkStudentOpen, setIsBulkStudentOpen] = useState(false);
  const [isAddShopOpen, setIsAddShopOpen] = useState(false);
  const [isTeacherPinModalOpen, setIsTeacherPinModalOpen] = useState(false);
  const [teacherPinTargetStudent, setTeacherPinTargetStudent] = useState<Student | null>(null);
  const [teacherPinTargetStudents, setTeacherPinTargetStudents] = useState<Student[]>([]);
  const [showAllPins, setShowAllPins] = useState<boolean>(true);
  const [isResetAllModalOpen, setIsResetAllModalOpen] = useState(false);
  const [customResetPin, setCustomResetPin] = useState('1234');
  const [stockToastMessage, setStockToastMessage] = useState<string | null>(null);
  const [isMigrationModalOpen, setIsMigrationModalOpen] = useState(false);
  const [contactEmailCopied, setContactEmailCopied] = useState(false);
  const [inviteCopied, setInviteCopied] = useState(false);
  const [guideTextCopied, setGuideTextCopied] = useState(false);
  const [isRepairingConsistency, setIsRepairingConsistency] = useState(false);

  // JSON Full Backup & Restore for Permanent Archiving
  const backupFileInputRef = React.useRef<HTMLInputElement>(null);
  const [pendingBackupRestore, setPendingBackupRestore] = useState<{
    fileName: string;
    content: string;
    className: string;
    classCode: string;
    currentRound: number;
    studentCount: number;
  } | null>(null);
  const [isRestoringBackup, setIsRestoringBackup] = useState(false);
  const [backupRestoreFeedback, setBackupRestoreFeedback] = useState<{
    success: boolean;
    message: string;
  } | null>(null);

  const handleDownloadFullBackup = () => {
    try {
      const jsonStr = exportFullBackupJSON();
      const blob = new Blob([jsonStr], { type: 'application/json;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const dateStr = new Date().toISOString().slice(0, 10);
      link.setAttribute('download', `kidsrich_backup_${state.classCode || 'class'}_round${state.currentRound}_${dateStr}.json`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (e: any) {
      setBackupRestoreFeedback({
        success: false,
        message: '백업 파일 생성 실패: ' + (e?.message || '알 수 없는 오류')
      });
    }
  };

  const handleUploadFullBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (!content) return;
      try {
        const parsed = JSON.parse(content);
        const incoming = parsed.state || parsed;
        if (!incoming || !Array.isArray(incoming.students)) {
          setBackupRestoreFeedback({
            success: false,
            message: '올바른 키즈리치 학급 백업 JSON 파일이 아닙니다.'
          });
          return;
        }
        setPendingBackupRestore({
          fileName: file.name,
          content,
          className: incoming.className || '우리반',
          classCode: incoming.classCode || state.classCode || 'C-10001',
          currentRound: Number(incoming.currentRound) || 1,
          studentCount: incoming.students.length
        });
      } catch (err: any) {
        setBackupRestoreFeedback({
          success: false,
          message: 'JSON 파일을 읽는 중 오류가 발생했습니다: ' + (err?.message || '파일 형식을 확인해 주세요.')
        });
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleConfirmBackupRestore = async () => {
    if (!pendingBackupRestore || isRestoringBackup) return;
    setIsRestoringBackup(true);
    try {
      const res = await importFullBackupJSON(pendingBackupRestore.content);
      setPendingBackupRestore(null);
      setBackupRestoreFeedback({
        success: res.success,
        message: res.message
      });
    } catch (err: any) {
      setPendingBackupRestore(null);
      setBackupRestoreFeedback({
        success: false,
        message: '백업 복원 중 오류가 발생했습니다: ' + (err?.message || '알 수 없는 오류')
      });
    } finally {
      setIsRestoringBackup(false);
    }
  };

  // Stock Confirmation Modal State
  interface StockChangeItem {
    id: string;
    name: string;
    category: string;
    currentPrice: number;
    newPrice: number;
    changeRate: number;
    changeAmount: number;
  }

  interface StockConfirmData {
    title: string;
    subtitle?: string;
    presetBadge?: string;
    badgeType?: 'up' | 'down' | 'neutral' | 'accent';
    items: StockChangeItem[];
    onConfirm: () => void;
  }

  const [stockConfirmModal, setStockConfirmModal] = useState<StockConfirmData | null>(null);

  // Request single stock price update with confirmation modal
  const handleRequestSingleStockPrice = (stockId: string, targetPrice?: number) => {
    const st = state.stocks.find(s => s.id === stockId);
    if (!st) return;
    const price = targetPrice !== undefined ? targetPrice : (stockPrices[stockId] ?? st.currentPrice);
    if (price <= 0 || isNaN(price)) {
      setStockToastMessage('⚠️ 주가는 0원보다 커야 합니다.');
      setTimeout(() => setStockToastMessage(null), 3000);
      return;
    }
    const changeAmount = price - st.currentPrice;
    const changeRate = st.currentPrice > 0
      ? parseFloat(((changeAmount / st.currentPrice) * 100).toFixed(1))
      : 0;

    const item: StockChangeItem = {
      id: st.id,
      name: st.name,
      category: st.category,
      currentPrice: st.currentPrice,
      newPrice: price,
      changeRate,
      changeAmount
    };

    setStockConfirmModal({
      title: `[${st.name}] 주가 변동 확인`,
      subtitle: `입력하신 변경 주가를 실시간 증권 시장에 즉시 반영하시겠습니까?`,
      presetBadge: changeAmount === 0 ? '변동 없음' : changeAmount > 0 ? `▲ +${changeRate}% (+${changeAmount.toLocaleString()}원)` : `▼ ${changeRate}% (${changeAmount.toLocaleString()}원)`,
      badgeType: changeAmount > 0 ? 'up' : changeAmount < 0 ? 'down' : 'neutral',
      items: [item],
      onConfirm: () => {
        updateStockPrice(st.id, price);
        setStockConfirmModal(null);
        setStockToastMessage(`⚡ [${st.name}] 주가가 ${price.toLocaleString()}원으로 실시간 시장에 즉시 반영되었습니다!`);
        setTimeout(() => setStockToastMessage(null), 3500);
      }
    });
  };

  // Request batch modified stock prices update with confirmation modal
  const handleRequestBatchStockPrices = () => {
    const changedItems: StockChangeItem[] = [];
    const pricesToApply: Record<string, number> = {};

    state.stocks.forEach(st => {
      const newPrice = stockPrices[st.id] ?? st.currentPrice;
      pricesToApply[st.id] = newPrice;
      if (newPrice !== st.currentPrice) {
        const changeAmount = newPrice - st.currentPrice;
        const changeRate = st.currentPrice > 0
          ? parseFloat(((changeAmount / st.currentPrice) * 100).toFixed(1))
          : 0;
        changedItems.push({
          id: st.id,
          name: st.name,
          category: st.category,
          currentPrice: st.currentPrice,
          newPrice,
          changeRate,
          changeAmount
        });
      }
    });

    if (changedItems.length === 0) {
      setStockToastMessage('ℹ️ 현재 변경된 주가가 없습니다. (모든 종목이 현재가와 동일합니다)');
      setTimeout(() => setStockToastMessage(null), 3000);
      return;
    }

    setStockConfirmModal({
      title: `총 ${changedItems.length}개 종목 주가 일괄 변경 확인`,
      subtitle: `수정된 주가들을 실시간 증권 시장에 즉시 반영하시겠습니까?`,
      presetBadge: `${changedItems.length}개 종목 변경`,
      badgeType: 'accent',
      items: changedItems,
      onConfirm: () => {
        applyRoundScenario({
          stockPrices: pricesToApply
        });
        setStockConfirmModal(null);
        setStockToastMessage(`⚡ ${changedItems.length}개 종목의 주가가 실시간 증권 시장에 즉시 반영되었습니다!`);
        setTimeout(() => setStockToastMessage(null), 3500);
      }
    });
  };

  // Request market preset with confirmation modal
  const handleRequestMarketPreset = (type: 'random' | 'bull_10' | 'bear_10' | 'surge_30' | 'crash_30' | 'reset') => {
    const updatedMap: Record<string, number> = {};
    const changedItems: StockChangeItem[] = [];

    let presetTitle = '';
    let presetBadge = '';
    let badgeType: 'up' | 'down' | 'neutral' | 'accent' = 'accent';

    switch (type) {
      case 'random':
        presetTitle = '무작위 변동장 (-15% ~ +15%)';
        presetBadge = '🎲 무작위 변동';
        badgeType = 'accent';
        break;
      case 'bull_10':
        presetTitle = '상승장 (+5% ~ +10%)';
        presetBadge = '📈 상승장 (+10%)';
        badgeType = 'up';
        break;
      case 'bear_10':
        presetTitle = '하락장 (-5% ~ -10%)';
        presetBadge = '📉 하락장 (-10%)';
        badgeType = 'down';
        break;
      case 'surge_30':
        presetTitle = '상한가 (+30%) 폭등';
        presetBadge = '🚀 상한가 (+30%)';
        badgeType = 'up';
        break;
      case 'crash_30':
        presetTitle = '하한가 (-30%) 폭락';
        presetBadge = '💥 하한가 (-30%)';
        badgeType = 'down';
        break;
      case 'reset':
        presetTitle = '이전 기준가 복원';
        presetBadge = '🔄 이전가 복원';
        badgeType = 'neutral';
        break;
    }

    state.stocks.forEach(st => {
      let nextPrice = st.currentPrice;
      if (type === 'random') {
        const randPct = (Math.floor(Math.random() * 31) - 15) / 100;
        nextPrice = Math.max(100, Math.round(st.currentPrice * (1 + randPct) / 100) * 100);
      } else if (type === 'bull_10') {
        const randPct = (Math.floor(Math.random() * 6) + 5) / 100;
        nextPrice = Math.max(100, Math.round(st.currentPrice * (1 + randPct) / 100) * 100);
      } else if (type === 'bear_10') {
        const randPct = -(Math.floor(Math.random() * 6) + 5) / 100;
        nextPrice = Math.max(100, Math.round(st.currentPrice * (1 + randPct) / 100) * 100);
      } else if (type === 'surge_30') {
        nextPrice = Math.max(100, Math.round(st.currentPrice * 1.3 / 100) * 100);
      } else if (type === 'crash_30') {
        nextPrice = Math.max(100, Math.round(st.currentPrice * 0.7 / 100) * 100);
      } else if (type === 'reset') {
        nextPrice = st.previousPrice > 0 ? st.previousPrice : st.currentPrice;
      }

      updatedMap[st.id] = nextPrice;

      const changeAmount = nextPrice - st.currentPrice;
      const changeRate = st.currentPrice > 0
        ? parseFloat(((changeAmount / st.currentPrice) * 100).toFixed(1))
        : 0;

      changedItems.push({
        id: st.id,
        name: st.name,
        category: st.category,
        currentPrice: st.currentPrice,
        newPrice: nextPrice,
        changeRate,
        changeAmount
      });
    });

    // Preview in inputs
    setStockPrices(updatedMap);

    setStockConfirmModal({
      title: `${presetTitle} 주가 적용 확인`,
      subtitle: `계산된 시나리오 주가를 실시간 증권 시장에 즉시 반영하시겠습니까?`,
      presetBadge,
      badgeType,
      items: changedItems,
      onConfirm: () => {
        applyRoundScenario({
          stockPrices: updatedMap
        });
        setStockConfirmModal(null);
        setStockToastMessage(`⚡ ${presetTitle} 주가가 실시간 증권 시장에 즉시 반영되었습니다!`);
        setTimeout(() => setStockToastMessage(null), 3500);
      }
    });
  };

  const handleAdjustStockPricePct = (stockId: string, pct: number, applyImmediately: boolean = false) => {
    const currentVal = stockPrices[stockId] ?? state.stocks.find(s => s.id === stockId)?.currentPrice ?? 5000;
    const newPrice = Math.max(100, Math.round(currentVal * (1 + pct / 100) / 100) * 100);
    setStockPrices(prev => ({ ...prev, [stockId]: newPrice }));
    if (applyImmediately) {
      handleRequestSingleStockPrice(stockId, newPrice);
    }
  };

  // Calculate stats
  const totalStudents = state.students.length;
  const pinResetCount = state.students.filter(s => s.pinResetRequested).length;
  const debtStudentCount = state.students.filter(s => (s.debt || 0) > 0).length;
  const duplicateInfo = React.useMemo(() => {
    return deduplicateStudents(state.students || []);
  }, [state.students]);
  const duplicateCount = duplicateInfo.duplicateIds.length;

  const handleCleanDuplicates = async () => {
    const res = await removeDuplicateStudents();
    if (res.removedCount > 0) {
      alert(`중복된 학생 계정 ${res.removedCount}명 (${res.removedNames.slice(0, 5).join(', ')}${res.removedNames.length > 5 ? ' 외' : ''})이 성공적으로 삭제 및 정리되었습니다.`);
    } else {
      alert('현재 중복된 학생 계정이 없습니다. 모든 학생 번호(1~N)가 고유합니다.');
    }
  };

  const handleRepairBalancesConsistency = async () => {
    if (isRepairingConsistency) return;
    setIsRepairingConsistency(true);
    try {
      const res = await repairAllStudentBalancesConsistency();
      if (res.fixedCount > 0) {
        alert(`총 ${res.fixedCount}명의 학생 잔액/주식 수량 정합성을 검사 및 보정했습니다.\n\n${res.details.slice(0, 8).join('\n')}${res.details.length > 8 ? '\n...' : ''}`);
      } else {
        alert('모든 학생의 현금·예금·부채·주식 수량이 정수/안전 범위 기준 100% 정상입니다.');
      }
    } finally {
      setIsRepairingConsistency(false);
    }
  };

  const studentInviteUrl = React.useMemo(() => {
    if (typeof window === 'undefined') return '';
    return `${window.location.origin}${window.location.pathname}?class=${encodeURIComponent(state.classCode || 'C-10001')}`;
  }, [state.classCode]);

  const handleCopyInviteUrl = () => {
    if (!studentInviteUrl) return;
    navigator.clipboard.writeText(studentInviteUrl);
    setInviteCopied(true);
    setTimeout(() => setInviteCopied(false), 2500);
  };

  const handleGenerateNewClassCode = () => {
    const randomCode = 'C-' + Math.floor(10000 + Math.random() * 90000);
    setClassCodeInput(randomCode);
  };

  const handleSaveGeneralSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!teacherNameInput.trim()) {
      alert('선생님 성함(교사명)을 입력해주세요.');
      return;
    }
    if (!classNameInput.trim()) {
      alert('학반 이름을 입력해주세요.');
      return;
    }
    if (!classCodeInput.trim()) {
      alert('학급 접속 코드를 입력해주세요.');
      return;
    }
    if (!currencyUnitInput.trim()) {
      alert('화폐 단위를 입력해주세요.');
      return;
    }
    if (totalRoundsInput <= 0) {
      alert('총 라운드 수는 1 이상이어야 합니다.');
      return;
    }

    updateClassSettings({
      className: classNameInput,
      classCode: classCodeInput,
      teacherName: teacherNameInput.trim(),
      teacherEmail: teacherEmailInput.trim(),
      currencyUnit: currencyUnitInput,
      totalRounds: totalRoundsInput,
      currentRound: currentRoundSetting,
      language: languageInput,
      isLeaderboardPublic: isLeaderboardPublicInput
    });

    await updateTeacherProfile({
      name: teacherNameInput.trim(),
      email: teacherEmailInput.trim(),
      schoolName: schoolNameInput.trim(),
      grade: gradeInput.trim(),
      classNum: classNumInput.trim(),
      password: teacherPasswordInput.trim() ? teacherPasswordInput.trim() : undefined
    });

    alert(`교사 정보(${teacherNameInput.trim()} 선생님) 및 학급 기본 설정이 성공적으로 저장되었습니다!`);
  };

  const handleApplyScenario = () => {
    applyRoundScenario({
      depositRate,
      stockPrices,
      newsMessage: newsInput.trim()
    });
    alert('Round 시나리오 설정이 저장 및 실시간 적용되었습니다!');
  };

  const handleAddStock = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStockName.trim()) {
      alert('주식 종목명을 입력해주세요.');
      return;
    }
    if (newStockPrice <= 0) {
      alert('올바른 기준 주가를 입력해주세요.');
      return;
    }
    const ok = addStock(newStockName, newStockCategory || '일반주', newStockPrice);
    if (ok) {
      setNewStockName('');
      setNewStockCategory('');
      setNewStockPrice(5000);
      setIsAddStockOpen(false);
      alert('새 주식 종목이 증권 시장에 등록되었습니다!');
    } else {
      alert(`주식 종목은 최대 ${MAX_STOCKS}개까지만 등록 가능합니다.`);
    }
  };

  const handleDeleteStock = (stockId: string, stockName: string) => {
    if (state.stocks.length <= 1) {
      alert('최소 1개의 주식 종목은 유지되어야 합니다.');
      return;
    }
    if (confirm(`'${stockName}' 종목을 정말 삭제하시겠습니까?`)) {
      deleteStock(stockId);
    }
  };

  const handleApplyFine = async (type: 'fine' | 'reward') => {
    let targets: string[] = [];
    if (targetType === 'individual') {
      targets = selectedStudentId ? [selectedStudentId] : [];
    } else if (targetType === 'selected') {
      targets = selectedStudentIds;
    } else if (targetType === 'all') {
      targets = state.students.map(s => s.id);
    }
    if (targets.length === 0) {
      alert('대상 학생을 1명 이상 선택해 주세요.');
      return;
    }
    const summary = await applyFineOrReward(
      type,
      fineAmount,
      fineReason || (type === 'reward' ? '학급 활동 상금' : '학급 규칙 위반 벌금'),
      targets
    );
    if (summary) {
      setFineSummaryModalData(summary);
      setIsFineSummaryModalOpen(true);
    }
  };

  const exportToExcel = () => {
    const csvContent =
      'data:text/csv;charset=utf-8,' +
      '번호,이름,아이디,PIN,현금,예금,부채,순자산,상태\n' +
      state.students
        .map(
          s =>
            `${s.number},${s.name},${s.username},${s.pin},${s.cash},${s.savings},${s.debt || 0},${calculateTotalAssets(s)},${
              s.isOnline ? '접속중' : '오프라인'
            }`
        )
        .join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `키즈리치스쿨_학생명단_Round${state.currentRound}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Filtered Students
  const filteredStudents = (state.students || []).filter(s => {
    if (!s) return false;
    const query = studentSearch.trim().toLowerCase();
    const sName = String(s.name || '').toLowerCase();
    const sUsername = String(s.username || '').toLowerCase();
    const sNumber = String(s.number ?? '');

    const matchesSearch =
      !query ||
      sName.includes(query) ||
      sUsername.includes(query) ||
      sNumber.includes(query);

    if (!matchesSearch) return false;
    if (studentStatusFilter === 'pin_reset') return !!s.pinResetRequested;
    if (studentStatusFilter === 'debt') return (s.debt || 0) > 0;
    return true;
  });

  return (
    <div className="bg-[#f5f2ed] text-[#1a1a1a] min-h-[calc(100vh-40px)] flex flex-col font-sans antialiased">
      {/* Always-mounted hidden file input so restore buttons work from any tab */}
      <input
        type="file"
        ref={backupFileInputRef}
        onChange={handleUploadFullBackup}
        accept=".json,application/json"
        className="hidden"
      />
      {/* Top App Bar (Clean, Spacious, Uncluttered) */}
      <header className="bg-[#faf8f5] shadow-2xs sticky top-0 z-40 border-b border-[#1a1a1a]/15">
        <div className="max-w-[1440px] mx-auto px-4 md:px-8 h-16 flex items-center justify-between gap-4">
          {/* Left: Brand & Class Identification */}
          <div className="flex items-center gap-3 md:gap-5 shrink-0">
            <button
              onClick={() => setActiveTab('general')}
              title="대시보드 처음으로 이동"
              type="button"
              className="flex items-center gap-2 group cursor-pointer hover:opacity-85 transition-opacity text-left bg-transparent border-0 p-0 focus:outline-none"
            >
              <div className="h-8 w-8 bg-[#1a1a1a] text-white rounded-2xs flex items-center justify-center font-editorial font-bold italic text-base border border-[#1a1a1a] shadow-2xs group-hover:scale-105 transition-transform">
                K
              </div>
              <div className="flex items-center gap-1.5">
                <span className="font-editorial text-lg md:text-xl font-bold italic text-[#1a1a1a] whitespace-nowrap group-hover:underline">
                  Kids Rich
                </span>
                <span className="text-[10px] font-sans font-bold uppercase tracking-widest bg-[#1a1a1a] text-amber-300 px-1.5 py-0.5 rounded-2xs">
                  ADMIN
                </span>
              </div>
            </button>

            <div className="h-6 w-px bg-[#1a1a1a]/15 hidden sm:block"></div>

            {/* Class Info Pill */}
            <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-2xs border border-[#1a1a1a]/15 shadow-2xs shrink-0 whitespace-nowrap">
              <span className="text-sm">🏫</span>
              <span className="font-bold text-xs text-[#1a1a1a]">
                {state.className || '우리반'}
              </span>
              <span className="text-[11px] text-[#1a1a1a]/50 font-mono bg-[#faf8f5] px-1.5 py-0.5 rounded-2xs border border-[#1a1a1a]/10">
                {state.classCode}
              </span>
            </div>
          </div>

          {/* Right: Cloud Sync, Teacher Profile & Logout */}
          <div className="flex items-center gap-2 md:gap-3 shrink-0">
            {isSuperAdminSession && (
              <button
                type="button"
                onClick={returnToSuperAdmin}
                title="통합 관리자 총괄 화면으로 돌아가기"
                className="h-8 px-3 bg-[#1a1a1a] hover:bg-stone-800 text-amber-300 rounded-2xs font-bold text-xs flex items-center gap-1.5 transition-all shadow-2xs whitespace-nowrap btn-press"
              >
                <span className="material-symbols-outlined text-[15px]">admin_panel_settings</span>
                <span>통합 관리자로 복귀</span>
              </button>
            )}
            {/* On-Demand Data Refresh (Plan A) */}
            <button
              onClick={handleManualSync}
              disabled={isSyncing}
              title={`클라우드 최신 데이터 새로고침 (최근 갱신: ${formatSyncTime(lastSyncedAt)})`}
              className={`h-8 px-3 bg-emerald-50 border border-emerald-300 hover:bg-emerald-100 text-emerald-900 rounded-2xs font-bold text-xs flex items-center gap-1.5 transition-all shadow-2xs whitespace-nowrap ${
                isSyncing ? 'opacity-70 cursor-not-allowed' : 'btn-press'
              }`}
            >
              <span className={`material-symbols-outlined text-[16px] text-emerald-700 ${isSyncing ? 'animate-spin' : ''}`}>
                sync
              </span>
              <span>
                {isSyncing ? '가져오는 중...' : syncNotice ? `✓ ${syncNotice}` : '새로고침 🔄'}
              </span>
            </button>

            {/* Share & Inquiry Modal Button */}
            <button
              onClick={() => setIsMigrationModalOpen(true)}
              title="학생 초대 링크, 앱 공유 및 상세 문의 안내"
              className="h-8 px-2.5 bg-amber-50 hover:bg-amber-100 border border-amber-300 text-amber-900 rounded-2xs font-bold text-xs flex items-center gap-1.5 transition-all shadow-2xs whitespace-nowrap btn-press"
            >
              <span className="material-symbols-outlined text-[16px] text-amber-800">
                mail
              </span>
              <span className="hidden md:inline">공유 &amp; 상세 문의</span>
              <span className="md:hidden">공유·문의</span>
            </button>

            {/* Teacher Profile Chip */}
            <div className="hidden sm:flex items-center gap-1.5 bg-white px-3 py-1.5 rounded-2xs border border-[#1a1a1a]/15 shadow-2xs shrink-0 whitespace-nowrap">
              <span className="text-xs">👨‍🏫</span>
              <span className="font-bold text-xs text-[#1a1a1a]">
                {currentTeacher?.name ? `${currentTeacher.name} 선생님` : (state.teacherName ? `${state.teacherName} 선생님` : '담임 교사')}
              </span>
            </div>

            {/* Logout Button */}
            <button
              onClick={logout}
              title="로그아웃"
              className="h-8 px-2.5 bg-white hover:bg-stone-100 border border-[#1a1a1a]/20 text-[#1a1a1a] rounded-2xs font-bold text-xs flex items-center gap-1 transition-all shadow-2xs whitespace-nowrap btn-press"
            >
              <span className="material-symbols-outlined text-[15px]">logout</span>
              <span className="hidden sm:inline">로그아웃</span>
            </button>
          </div>
        </div>
      </header>

      {/* Undo Banner */}
      {state.undoAvailableUntil && Date.now() < state.undoAvailableUntil && (
        <div className="bg-[#1a1a1a] text-amber-200 w-full py-2 px-4 md:px-8 flex justify-center items-center gap-3 border-b border-amber-400/20 shadow-2xs relative z-30">
          <span className="material-symbols-outlined text-base text-amber-300">warning</span>
          <span className="font-medium text-xs tracking-wide">
            ⚠️ 정산을 실행했습니다. 이전 상태로 복구하시겠습니까?
          </span>
          <button
            onClick={restorePreviousState}
            className="bg-amber-300 text-stone-900 font-bold text-xs px-3 py-1 rounded-2xs hover:bg-amber-200 transition-colors flex items-center gap-1 uppercase tracking-wider"
          >
            <span className="material-symbols-outlined text-[14px]">undo</span>
            직전 상태로 복원
          </button>
        </div>
      )}

      {/* Main Workspace */}
      <main className="flex-1 max-w-[1440px] w-full mx-auto px-4 md:px-8 py-5 flex flex-col gap-5">
        {/* Sub-Header: Live Round Command Center */}
        <section className="bg-white rounded-sm border border-[#1a1a1a]/15 p-3.5 md:p-4 shadow-2xs flex flex-wrap items-center justify-between gap-3 md:gap-4">
          {/* Round Status & Student Online Count */}
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="bg-[#1a1a1a] text-white px-3 py-1.5 rounded-2xs flex items-center gap-2 shadow-2xs">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              <span className="font-bold text-xs tracking-wide">
                Round {state.currentRound} <span className="text-[#1a1a1a]/50 text-stone-400 font-normal">/ {state.totalRounds}</span> 진행 중
              </span>
            </div>

            <div className="bg-[#faf8f5] border border-[#1a1a1a]/15 px-3 py-1.5 rounded-2xs flex items-center gap-1.5 text-xs text-[#1a1a1a]">
              <span className="material-symbols-outlined text-[16px] text-[#1a1a1a]/70">group</span>
              <span className="font-medium">등록 학생:</span>
              <span className="font-bold text-[#1a1a1a]">{totalStudents}명</span>
            </div>

            {nextPendingSchedule && (
              <button
                type="button"
                onClick={() => setActiveTab('scenario')}
                className="bg-indigo-50 hover:bg-indigo-100 border border-indigo-300 px-3 py-1.5 rounded-2xs flex items-center gap-1.5 text-xs text-indigo-950 font-bold transition-colors"
                title="예약된 다음 라운드 시나리오 설정 보기"
              >
                <span className="material-symbols-outlined text-[15px] text-indigo-700">schedule</span>
                <span>
                  예약 R{nextPendingSchedule.targetRound}: {new Date(nextPendingSchedule.scheduledAt).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </span>
                <span className="px-1.5 py-0.2 bg-indigo-200/80 text-indigo-900 rounded-2xs text-[10px] font-mono">
                  {formatCountdown(nextPendingSchedule.scheduledAt)}
                </span>
              </button>
            )}
          </div>

          {/* Quick Operations: Market Freeze, Round Jump & End Round CTA */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Trading Freeze Toggle */}
            <div className="flex items-center gap-2 border border-[#1a1a1a]/15 rounded-2xs px-3 py-1 bg-[#faf8f5] shadow-2xs">
              <span className="font-bold text-xs text-[#1a1a1a]">거래</span>
              <span className={`text-[11px] font-bold ${state.isTradingFrozen ? 'text-red-900' : 'text-emerald-800'}`}>
                {state.isTradingFrozen ? '정지됨' : '정상'}
              </span>
              <button
                type="button"
                onClick={toggleTradingFreeze}
                title={state.isTradingFrozen ? '거래 정지 해제' : '거래 일시 정지'}
                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                  state.isTradingFrozen ? 'bg-red-900' : 'bg-stone-300'
                }`}
              >
                <span
                  className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                    state.isTradingFrozen ? 'translate-x-4' : 'translate-x-0.5'
                  }`}
                />
              </button>
            </div>

            {/* Leaderboard Public / Private Toggle */}
            <div
              className="flex items-center gap-2 border border-[#1a1a1a]/15 rounded-2xs px-3 py-1 bg-[#faf8f5] shadow-2xs"
              title="학생 화면에 학급 랭킹 및 순위 뱃지 공개 여부를 설정합니다"
            >
              <span className="font-bold text-xs text-[#1a1a1a] flex items-center gap-1">
                <span className="material-symbols-outlined text-[15px] text-stone-700">leaderboard</span>
                <span>랭킹</span>
              </span>
              <span className={`text-[11px] font-bold ${state.isLeaderboardPublic !== false ? 'text-emerald-800' : 'text-amber-900'}`}>
                {state.isLeaderboardPublic !== false ? '공개' : '비공개'}
              </span>
              <button
                type="button"
                onClick={toggleLeaderboardPublic}
                title={state.isLeaderboardPublic !== false ? '학급 랭킹을 비공개로 전환 (학생 화면에서 숨김)' : '학급 랭킹을 공개로 전환 (학생 화면에 표시)'}
                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                  state.isLeaderboardPublic !== false ? 'bg-emerald-700' : 'bg-amber-600'
                }`}
              >
                <span
                  className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                    state.isLeaderboardPublic !== false ? 'translate-x-4' : 'translate-x-0.5'
                  }`}
                />
              </button>
            </div>

            {/* Round Jump Input */}
            <div className="flex items-center bg-[#faf8f5] rounded-2xs border border-[#1a1a1a]/15 overflow-hidden shadow-2xs">
              <span className="text-[11px] font-medium text-[#1a1a1a]/60 pl-2.5 pr-1">이동:</span>
              <input
                type="number"
                min="1"
                max={state.totalRounds}
                value={roundInput}
                onChange={e => setRoundInput(Number(e.target.value))}
                className="w-10 h-7 text-center font-mono font-bold text-xs text-[#1a1a1a] bg-white border border-[#1a1a1a]/15 rounded-2xs my-0.5"
              />
              <button
                onClick={() => setRound(roundInput)}
                className="h-8 px-2.5 bg-[#faf8f5] hover:bg-stone-200 text-[11px] font-bold text-[#1a1a1a] transition-colors ml-1"
              >
                이동
              </button>
            </div>

            {/* Primary Settlement Button */}
            <button
              onClick={() => setIsSettlementOpen(true)}
              className="h-8 px-3.5 bg-red-900 hover:bg-red-950 text-white rounded-2xs font-bold text-xs uppercase tracking-wider transition-all shadow-2xs btn-press flex items-center gap-1.5 shrink-0"
            >
              <span className="material-symbols-outlined text-[16px]">stop_circle</span>
              <span>라운드 정산 및 종료</span>
            </button>
          </div>
        </section>
        {/* Tabs Navigation with Button-Only Movement (No Scrollbar) */}
        <div className="relative flex items-center gap-1.5 w-full bg-[#faf8f5]/80 p-1 rounded-sm border border-[#1a1a1a]/15 shadow-2xs">
          <button
            type="button"
            onClick={() => handleScrollNav('left')}
            className="shrink-0 w-8 h-9 bg-white hover:bg-stone-100 border border-[#1a1a1a]/20 rounded-2xs flex items-center justify-center text-[#1a1a1a] shadow-2xs transition-colors btn-press cursor-pointer"
            title="이전 메뉴로 이동"
            aria-label="이전 메뉴로 이동"
          >
            <span className="material-symbols-outlined text-[18px]">chevron_left</span>
          </button>

          <nav
            ref={navTabsRef}
            className="flex-1 flex gap-1 md:gap-1.5 border-b-2 border-[#1a1a1a]/15 pb-1.5 pt-0.5 overflow-x-auto no-scrollbar scroll-smooth"
          >
            <button
              onClick={() => setActiveTab('general')}
              className={`px-3.5 py-2 rounded-t-2xs font-bold text-xs uppercase tracking-wider flex items-center gap-1.5 transition-all shrink-0 whitespace-nowrap ${
                activeTab === 'general'
                  ? 'bg-[#1a1a1a] text-white shadow-2xs'
                  : 'text-[#1a1a1a]/70 hover:bg-[#1a1a1a]/5 hover:text-[#1a1a1a]'
              }`}
            >
              <span className="material-symbols-outlined text-[17px]">tune</span>
              학급 기본 설정
            </button>

            <button
              onClick={() => setActiveTab('scenario')}
              className={`px-3.5 py-2 rounded-t-2xs font-bold text-xs uppercase tracking-wider flex items-center gap-1.5 transition-all shrink-0 whitespace-nowrap ${
                activeTab === 'scenario'
                  ? 'bg-[#1a1a1a] text-white shadow-2xs'
                  : 'text-[#1a1a1a]/70 hover:bg-[#1a1a1a]/5 hover:text-[#1a1a1a]'
              }`}
            >
              <span className="material-symbols-outlined text-[17px]">settings_suggest</span>
              라운드 시나리오 설정
            </button>

            <button
              onClick={() => setActiveTab('newsletter')}
              className={`px-3.5 py-2 rounded-t-2xs font-bold text-xs uppercase tracking-wider flex items-center gap-1.5 transition-all shrink-0 whitespace-nowrap ${
                activeTab === 'newsletter'
                  ? 'bg-[#1a1a1a] text-white shadow-2xs'
                  : 'text-[#1a1a1a]/70 hover:bg-[#1a1a1a]/5 hover:text-[#1a1a1a]'
              }`}
            >
              <span className="material-symbols-outlined text-[17px]">newspaper</span>
              학급 뉴스룸 & 배급
              {(state.newsArticles?.length || 0) > 0 && (
                <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold ${activeTab === 'newsletter' ? 'bg-amber-400 text-[#1a1a1a]' : 'bg-stone-200 text-[#1a1a1a]'}`}>
                  {state.newsArticles?.length}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab('students')}
              className={`px-3.5 py-2 rounded-t-2xs font-bold text-xs uppercase tracking-wider flex items-center gap-1.5 transition-all shrink-0 whitespace-nowrap ${
                activeTab === 'students'
                  ? 'bg-[#1a1a1a] text-white shadow-2xs'
                  : 'text-[#1a1a1a]/70 hover:bg-[#1a1a1a]/5 hover:text-[#1a1a1a]'
              }`}
            >
              <span className="material-symbols-outlined text-[17px]">group</span>
              학생 계정 & PIN 관리
            </button>

            <button
              onClick={() => setActiveTab('student_asset_dashboard')}
              className={`px-3.5 py-2 rounded-t-2xs font-bold text-xs uppercase tracking-wider flex items-center gap-1.5 transition-all shrink-0 whitespace-nowrap ${
                activeTab === 'student_asset_dashboard'
                  ? 'bg-[#1a1a1a] text-white shadow-2xs'
                  : 'text-[#1a1a1a]/70 hover:bg-[#1a1a1a]/5 hover:text-[#1a1a1a]'
              }`}
            >
              <span className="material-symbols-outlined text-[17px]">query_stats</span>
              개인별 자산 변동 현황
            </button>

            <button
              onClick={() => setActiveTab('shop_fines')}
              className={`px-3.5 py-2 rounded-t-2xs font-bold text-xs uppercase tracking-wider flex items-center gap-1.5 transition-all shrink-0 whitespace-nowrap ${
                activeTab === 'shop_fines'
                  ? 'bg-[#1a1a1a] text-white shadow-2xs'
                  : 'text-[#1a1a1a]/70 hover:bg-[#1a1a1a]/5 hover:text-[#1a1a1a]'
              }`}
            >
              <span className="material-symbols-outlined text-[17px]">storefront</span>
              학급 상점 & 상벌금 관리
            </button>

            <button
              onClick={() => setActiveTab('leaderboard')}
              className={`px-3.5 py-2 rounded-t-2xs font-bold text-xs uppercase tracking-wider flex items-center gap-1.5 transition-all shrink-0 whitespace-nowrap ${
                activeTab === 'leaderboard'
                  ? 'bg-[#1a1a1a] text-white shadow-2xs'
                  : 'text-[#1a1a1a]/70 hover:bg-[#1a1a1a]/5 hover:text-[#1a1a1a]'
              }`}
            >
              <span className="material-symbols-outlined text-[17px]">leaderboard</span>
              <span>실시간 리더보드</span>
              <span
                className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold ${
                  state.isLeaderboardPublic !== false
                    ? activeTab === 'leaderboard'
                      ? 'bg-emerald-400 text-stone-950'
                      : 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                    : activeTab === 'leaderboard'
                      ? 'bg-amber-400 text-stone-950'
                      : 'bg-amber-100 text-amber-900 border border-amber-300'
                }`}
              >
                {state.isLeaderboardPublic !== false ? '공개' : '비공개'}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('asset_history')}
              className={`px-3.5 py-2 rounded-t-2xs font-bold text-xs uppercase tracking-wider flex items-center gap-1.5 transition-all shrink-0 whitespace-nowrap ${
                activeTab === 'asset_history'
                  ? 'bg-[#1a1a1a] text-white shadow-2xs'
                  : 'text-[#1a1a1a]/70 hover:bg-[#1a1a1a]/5 hover:text-[#1a1a1a]'
              }`}
            >
              <span className="material-symbols-outlined text-[17px]">receipt_long</span>
              학급 전체 거래 원장
            </button>
          </nav>

          <button
            type="button"
            onClick={() => handleScrollNav('right')}
            className="shrink-0 w-8 h-9 bg-white hover:bg-stone-100 border border-[#1a1a1a]/20 rounded-2xs flex items-center justify-center text-[#1a1a1a] shadow-2xs transition-colors btn-press cursor-pointer"
            title="다음 메뉴로 이동"
            aria-label="다음 메뉴로 이동"
          >
            <span className="material-symbols-outlined text-[18px]">chevron_right</span>
          </button>
        </div>

        {/* TAB 0: GENERAL CLASS SETTINGS */}
        {activeTab === 'general' && (
          <form onSubmit={handleSaveGeneralSettings} className="flex flex-col gap-6">
            <div className="bg-white rounded-sm p-6 shadow-2xs border border-[#1a1a1a]/15 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div>
                <h2 className="font-editorial text-xl font-bold text-[#1a1a1a] flex items-center gap-2">
                  <span className="material-symbols-outlined text-2xl">tune</span>
                  학급 운영 및 교사 회원 정보 설정
                </h2>
                <p className="text-xs text-[#1a1a1a]/60 mt-1">
                  선생님 성함(교사명), 계정 정보, 학반 이름, 화폐 단위, 학생 수, 라운드 계획을 설정합니다.
                </p>
              </div>
              <button
                type="submit"
                className="px-6 py-2.5 bg-[#1a1a1a] text-white font-bold text-xs uppercase tracking-wider rounded-2xs hover:bg-stone-800 transition-all shadow-2xs btn-press flex items-center gap-2"
              >
                <span className="material-symbols-outlined text-[18px]">save</span>
                교사 정보 & 학급 설정 저장
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-4 gap-6">
              {/* Card 0: Teacher Account & Profile */}
              <div className="bg-white rounded-sm p-6 shadow-2xs border-2 border-[#1a1a1a]/25 flex flex-col gap-4 relative">
                <div className="flex items-center gap-2.5 pb-3 border-b border-[#1a1a1a]/10">
                  <div className="w-9 h-9 rounded-2xs bg-amber-100 border border-amber-300 flex items-center justify-center font-bold text-lg text-amber-900">
                    👨‍🏫
                  </div>
                  <div>
                    <h3 className="font-editorial text-base font-bold text-[#1a1a1a]">교사 회원 정보</h3>
                    <p className="text-[11px] text-[#1a1a1a]/60">담임 교사 프로필 및 계정</p>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-[#1a1a1a] mb-1.5">
                    선생님 성함 (교사명) *
                  </label>
                  <input
                    type="text"
                    required
                    value={teacherNameInput}
                    onChange={e => setTeacherNameInput(e.target.value)}
                    placeholder="예: 홍길동 (또는 실제 선생님 성함)"
                    className="w-full px-3.5 py-2.5 bg-[#faf8f5] border border-[#1a1a1a]/25 rounded-2xs font-bold text-xs text-[#1a1a1a] focus:border-[#1a1a1a] focus:ring-0"
                  />
                  <p className="text-[11px] text-emerald-800 font-medium mt-1">
                    ✓ 학생 송금 수신자, 시스템 공지, 헤더에 즉시 반영됩니다.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-[#1a1a1a] mb-1.5">
                    교사 이메일 / 아이디 *
                  </label>
                  <input
                    type="email"
                    required
                    value={teacherEmailInput}
                    onChange={e => setTeacherEmailInput(e.target.value)}
                    placeholder="예: teacher@school.kr"
                    className="w-full px-3.5 py-2.5 bg-[#faf8f5] border border-[#1a1a1a]/20 rounded-2xs font-mono font-medium text-xs text-[#1a1a1a] focus:border-[#1a1a1a] focus:ring-0"
                  />
                </div>

                <div className="p-3 bg-amber-50/70 border border-amber-200/80 rounded-2xs">
                  <div className="flex items-center gap-1 text-[11px] font-bold text-amber-900 mb-1">
                    <span className="material-symbols-outlined text-[15px] text-amber-700">shield</span>
                    <span>비밀번호 찾기 본인 확인 정보</span>
                  </div>
                  <p className="text-[10px] text-amber-850 mb-2 leading-tight">
                    💡 비밀번호 분실 시 아래 학교명, 학년, 반 정보를 통해 본인 확인을 진행합니다.
                  </p>

                  <div className="flex flex-col gap-2">
                    <div>
                      <label className="block text-[11px] font-bold uppercase tracking-wider text-[#1a1a1a] mb-1">
                        소속 학교명 *
                      </label>
                      <input
                        type="text"
                        value={schoolNameInput}
                        onChange={e => setSchoolNameInput(e.target.value)}
                        placeholder="예: 서울초등학교 또는 해솔초"
                        className="w-full px-3 py-1.5 bg-white border border-amber-300 rounded-2xs font-medium text-xs text-[#1a1a1a] focus:border-[#1a1a1a] focus:ring-0"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[11px] font-bold uppercase tracking-wider text-[#1a1a1a] mb-1">
                          담당 학년 *
                        </label>
                        <input
                          type="text"
                          value={gradeInput}
                          onChange={e => setGradeInput(e.target.value)}
                          placeholder="예: 6 (또는 6학년)"
                          className="w-full px-3 py-1.5 bg-white border border-amber-300 rounded-2xs font-medium text-xs text-[#1a1a1a] focus:border-[#1a1a1a] focus:ring-0"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold uppercase tracking-wider text-[#1a1a1a] mb-1">
                          담당 반 *
                        </label>
                        <input
                          type="text"
                          value={classNumInput}
                          onChange={e => setClassNumInput(e.target.value)}
                          placeholder="예: 1 (또는 1반)"
                          className="w-full px-3 py-1.5 bg-white border border-amber-300 rounded-2xs font-medium text-xs text-[#1a1a1a] focus:border-[#1a1a1a] focus:ring-0"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-[#1a1a1a] mb-1.5">
                    비밀번호 변경 (선택)
                  </label>
                  <input
                    type="password"
                    value={teacherPasswordInput}
                    onChange={e => setTeacherPasswordInput(e.target.value)}
                    placeholder="변경 시에만 새 비밀번호 입력"
                    className="w-full px-3.5 py-2.5 bg-[#faf8f5] border border-[#1a1a1a]/20 rounded-2xs font-medium text-xs text-[#1a1a1a] focus:border-[#1a1a1a] focus:ring-0"
                  />
                </div>
              </div>

              {/* Card 1: Class Name & Language */}
              <div className="bg-white rounded-sm p-6 shadow-2xs border border-[#1a1a1a]/15 flex flex-col gap-4">
                <div className="flex items-center gap-2.5 pb-3 border-b border-[#1a1a1a]/10">
                  <div className="w-9 h-9 rounded-2xs bg-[#faf8f5] border border-[#1a1a1a]/15 flex items-center justify-center font-bold text-lg text-[#1a1a1a]">
                    🏫
                  </div>
                  <div>
                    <h3 className="font-editorial text-base font-bold text-[#1a1a1a]">학반 명칭 & 언어</h3>
                    <p className="text-[11px] text-[#1a1a1a]/60">학반 표시명 및 시스템 언어</p>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-[#1a1a1a] mb-1.5">
                    학반 이름 *
                  </label>
                  <input
                    type="text"
                    required
                    value={classNameInput}
                    onChange={e => setClassNameInput(e.target.value)}
                    placeholder="예: 6학년 1반, 미래초 5-2반"
                    className="w-full px-3.5 py-2.5 bg-[#faf8f5] border border-[#1a1a1a]/20 rounded-2xs font-bold text-xs text-[#1a1a1a] focus:border-[#1a1a1a] focus:ring-0"
                  />
                  <p className="text-[11px] text-[#1a1a1a]/50 mt-1">
                    상단 헤더, 학생 대시보드 및 리포트에 표시됩니다.
                  </p>
                </div>

                <div>
                  <div className="flex justify-between items-center mb-1.5">
                    <label className="block text-xs font-bold uppercase tracking-wider text-[#1a1a1a]">
                      학급 접속 코드 *
                    </label>
                    <button
                      type="button"
                      onClick={handleGenerateNewClassCode}
                      className="text-[11px] font-bold text-emerald-800 hover:text-emerald-900 bg-emerald-50 hover:bg-emerald-100 px-2 py-0.5 rounded-2xs border border-emerald-300/60 transition-colors flex items-center gap-1"
                    >
                      <span className="material-symbols-outlined text-[13px]">refresh</span>
                      새 코드 생성
                    </button>
                  </div>
                  <input
                    type="text"
                    required
                    value={classCodeInput}
                    onChange={e => setClassCodeInput(e.target.value)}
                    placeholder="예: C-60126"
                    className="w-full px-3.5 py-2.5 bg-[#faf8f5] border border-[#1a1a1a]/20 rounded-2xs font-mono font-bold text-xs text-[#1a1a1a] focus:border-[#1a1a1a] focus:ring-0"
                  />
                  <p className="text-[11px] text-[#1a1a1a]/50 mt-1">
                    학생 및 교사가 접속할 때 사용하는 고유 학급 코드입니다.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-[#1a1a1a] mb-1.5">
                    시스템 기본 언어 *
                  </label>
                  <select
                    value={languageInput}
                    onChange={e => setLanguageInput(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-[#faf8f5] border border-[#1a1a1a]/20 rounded-2xs font-bold text-xs text-[#1a1a1a] focus:border-[#1a1a1a] focus:ring-0"
                  >
                    <option value="ko">한국어 (Korean)</option>
                    <option value="en">English (영어)</option>
                    <option value="ja">日本語 (일본어)</option>
                    <option value="vi">Tiếng Việt (베트남어)</option>
                  </select>
                </div>
              </div>

              {/* Card 2: Currency Unit */}
              <div className="bg-white rounded-sm p-6 shadow-2xs border border-[#1a1a1a]/15 flex flex-col gap-4">
                <div className="flex items-center gap-2.5 pb-3 border-b border-[#1a1a1a]/10">
                  <div className="w-9 h-9 rounded-2xs bg-[#faf8f5] border border-[#1a1a1a]/15 flex items-center justify-center font-bold text-lg text-[#1a1a1a]">
                    💰
                  </div>
                  <div>
                    <h3 className="font-editorial text-base font-bold text-[#1a1a1a]">화폐 단위 설정</h3>
                    <p className="text-[11px] text-[#1a1a1a]/60">학급 경제 화폐 기호 / 명칭</p>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-[#1a1a1a] mb-1.5">
                    화폐 단위 (직접 입력 또는 선택) *
                  </label>
                  <input
                    type="text"
                    required
                    value={currencyUnitInput}
                    onChange={e => setCurrencyUnitInput(e.target.value)}
                    placeholder="예: 원, 미소, 달러, G, 포인트"
                    className="w-full px-3.5 py-2.5 bg-[#faf8f5] border border-[#1a1a1a]/20 rounded-2xs font-bold text-xs text-[#1a1a1a] focus:border-[#1a1a1a] focus:ring-0"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-[#1a1a1a]/60 mb-1.5">
                    추천 화폐 단위 선택
                  </label>
                  <div className="grid grid-cols-3 gap-1.5">
                    {['원', '미소', '미래화', '달러', 'G', '별'].map(unit => (
                      <button
                        key={unit}
                        type="button"
                        onClick={() => setCurrencyUnitInput(unit)}
                        className={`py-1.5 px-2 rounded-2xs font-bold text-xs border transition-colors ${
                          currencyUnitInput === unit
                            ? 'bg-[#1a1a1a] text-white border-[#1a1a1a]'
                            : 'bg-[#faf8f5] text-[#1a1a1a] border-[#1a1a1a]/15 hover:bg-[#f0ede6]'
                        }`}
                      >
                        {unit}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="p-3 bg-amber-500/10 rounded-2xs border border-amber-600/20 text-xs mt-auto">
                  <span className="font-bold text-amber-900 block mb-0.5">화폐 표기 미리보기</span>
                  <p className="font-mono font-bold text-sm text-[#1a1a1a]">
                    10,000<span className="ml-1 font-normal text-xs">{currencyUnitInput}</span>
                  </p>
                </div>
              </div>

              {/* Card 3: Student Management & Rounds */}
              <div className="bg-white rounded-sm p-6 shadow-2xs border border-[#1a1a1a]/15 flex flex-col gap-4">
                <div className="flex items-center gap-2.5 pb-3 border-b border-[#1a1a1a]/10">
                  <div className="w-9 h-9 rounded-2xs bg-[#faf8f5] border border-[#1a1a1a]/15 flex items-center justify-center font-bold text-lg text-[#1a1a1a]">
                    👥
                  </div>
                  <div>
                    <h3 className="font-editorial text-base font-bold text-[#1a1a1a]">학급 학생 & 라운드</h3>
                    <p className="text-[11px] text-[#1a1a1a]/60">현재 등록된 학생 현황 및 라운드 설정</p>
                  </div>
                </div>

                <div className="p-3.5 bg-[#faf8f5] rounded-2xs border border-[#1a1a1a]/15">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-[#1a1a1a]">등록된 학생 수</span>
                    <span className="font-editorial font-bold text-xl text-[#1a1a1a]">
                      {state.students.length} <span className="text-xs font-normal font-sans text-[#1a1a1a]/60">명</span>
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setIsBulkStudentOpen(true)}
                      className="flex-1 py-2 px-3 bg-[#1a1a1a] hover:bg-stone-800 text-white font-bold text-xs rounded-2xs flex items-center justify-center gap-1.5 shadow-2xs transition-colors"
                    >
                      <span className="material-symbols-outlined text-[15px]">person_add</span>
                      학생 등록 / 명단 입력
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveTab('students')}
                      className="py-2 px-3 bg-white hover:bg-stone-100 border border-[#1a1a1a]/20 text-[#1a1a1a] font-bold text-xs rounded-2xs transition-colors"
                    >
                      학생 관리
                    </button>
                  </div>
                  <p className="text-[10px] text-[#1a1a1a]/60 mt-2">
                    💡 학생 계정은 교사가 직접 이름으로 등록하거나 출석부를 복사해 일괄 생성합니다.
                  </p>
                </div>

                <div className="pt-2 border-t border-[#1a1a1a]/10">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold uppercase tracking-wider text-[#1a1a1a]/70 mb-1">
                        전체 라운드 수 *
                      </label>
                      <input
                        type="number"
                        required
                        min="1"
                        max="50"
                        value={totalRoundsInput}
                        onChange={e => setTotalRoundsInput(Number(e.target.value))}
                        className="w-full px-3 py-2 bg-[#faf8f5] border border-[#1a1a1a]/20 rounded-2xs font-mono font-bold text-xs text-[#1a1a1a] focus:border-[#1a1a1a] focus:ring-0"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold uppercase tracking-wider text-[#1a1a1a]/70 mb-1">
                        현재 진행 라운드 *
                      </label>
                      <input
                        type="number"
                        required
                        min="1"
                        max={totalRoundsInput}
                        value={currentRoundSetting}
                        onChange={e => setCurrentRoundSetting(Number(e.target.value))}
                        className="w-full px-3 py-2 bg-[#faf8f5] border border-[#1a1a1a]/20 rounded-2xs font-mono font-bold text-xs text-[#1a1a1a] focus:border-[#1a1a1a] focus:ring-0"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Card 4: Leaderboard Public/Private Visibility Setting */}
              <div className="bg-white rounded-sm p-6 shadow-2xs border border-[#1a1a1a]/15 flex flex-col gap-4">
                <div className="flex items-center gap-2.5 pb-3 border-b border-[#1a1a1a]/10">
                  <div className="w-9 h-9 rounded-2xs bg-[#faf8f5] border border-[#1a1a1a]/15 flex items-center justify-center font-bold text-lg text-[#1a1a1a]">
                    🏆
                  </div>
                  <div>
                    <h3 className="font-editorial text-base font-bold text-[#1a1a1a]">학급 랭킹 공개 설정</h3>
                    <p className="text-[11px] text-[#1a1a1a]/60">학생 대시보드의 실시간 순위 및 리더보드 노출 여부</p>
                  </div>
                </div>

                <div className="space-y-3">
                  <label className="block text-xs font-bold uppercase tracking-wider text-[#1a1a1a]">
                    랭킹 공개 방식 선택 *
                  </label>

                  {/* Option: Public */}
                  <label
                    className={`flex items-start gap-3 p-3 rounded-2xs border cursor-pointer transition-all ${
                      isLeaderboardPublicInput
                        ? 'bg-emerald-50/70 border-emerald-400 text-emerald-950 shadow-2xs'
                        : 'bg-[#faf8f5] border-[#1a1a1a]/15 text-[#1a1a1a]/70 hover:bg-[#f3f0ea]'
                    }`}
                  >
                    <input
                      type="radio"
                      name="isLeaderboardPublic"
                      checked={isLeaderboardPublicInput === true}
                      onChange={() => setIsLeaderboardPublicInput(true)}
                      className="mt-1 text-emerald-700 focus:ring-emerald-700"
                    />
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-xs text-[#1a1a1a]">🟢 전체 학생에게 공개</span>
                        <span className="px-1.5 py-0.2 rounded-2xs text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                          기본 권장
                        </span>
                      </div>
                      <p className="text-[11px] text-[#1a1a1a]/60 mt-0.5 leading-relaxed">
                        모든 학생이 학생 대시보드 상단 뱃지(예: 👑 1위) 및 [학급 랭킹] 탭에서 실시간 순위와 친구들의 총 자산 현황을 열람할 수 있습니다.
                      </p>
                    </div>
                  </label>

                  {/* Option: Private */}
                  <label
                    className={`flex items-start gap-3 p-3 rounded-2xs border cursor-pointer transition-all ${
                      !isLeaderboardPublicInput
                        ? 'bg-amber-50/70 border-amber-400 text-amber-950 shadow-2xs'
                        : 'bg-[#faf8f5] border-[#1a1a1a]/15 text-[#1a1a1a]/70 hover:bg-[#f3f0ea]'
                    }`}
                  >
                    <input
                      type="radio"
                      name="isLeaderboardPublic"
                      checked={isLeaderboardPublicInput === false}
                      onChange={() => setIsLeaderboardPublicInput(false)}
                      className="mt-1 text-amber-700 focus:ring-amber-700"
                    />
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-xs text-[#1a1a1a]">🔒 학생에게 비공개 (선생님만 열람)</span>
                        <span className="px-1.5 py-0.2 rounded-2xs text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                          비교 방지 모드
                        </span>
                      </div>
                      <p className="text-[11px] text-[#1a1a1a]/60 mt-0.5 leading-relaxed">
                        학생 대시보드에서 순위 뱃지와 리더보드 상세 순위가 숨겨집니다. 과도한 순위 경쟁 대신 학생 개개인의 저축, 투자, 소비 학습에 집중하도록 돕습니다.
                      </p>
                    </div>
                  </label>
                </div>

                {/* Status Notice & Direct Instant Toggle */}
                <div className="p-3 bg-[#faf8f5] rounded-2xs border border-[#1a1a1a]/15 text-xs flex items-center justify-between gap-3 mt-auto">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[18px] text-[#1a1a1a]/60">
                      {isLeaderboardPublicInput ? 'visibility' : 'visibility_off'}
                    </span>
                    <span className="text-[11px] text-[#1a1a1a]/70">
                      현재 상태: <strong className={isLeaderboardPublicInput ? 'text-emerald-800 font-bold' : 'text-amber-800 font-bold'}>{isLeaderboardPublicInput ? '전체 공개' : '비공개'}</strong>
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const next = !isLeaderboardPublicInput;
                      setIsLeaderboardPublicInput(next);
                      setLeaderboardPublic(next);
                    }}
                    className="px-2.5 py-1 text-[11px] font-bold rounded-2xs border border-[#1a1a1a]/20 bg-white hover:bg-stone-50 text-[#1a1a1a] transition-colors shadow-2xs"
                  >
                    즉시 {isLeaderboardPublicInput ? '비공개로' : '공개로'} 전환
                  </button>
                </div>
              </div>
            </div>

            {/* Invite Link & Inquiry Quick Card */}
            <div className="pt-6 border-t border-[#1a1a1a]/15">
              <div className="bg-indigo-50/70 rounded-sm p-6 border border-indigo-200 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2 text-indigo-950 font-bold text-sm">
                    <span className="material-symbols-outlined text-lg text-indigo-700">share</span>
                    학생 초대 링크 &amp; 상세 문의
                  </div>
                  <p className="text-xs text-indigo-900/80 leading-relaxed">
                    학생들에게 아래 전용 링크를 공유하면 학급 코드(<strong>{state.classCode}</strong>)가 자동으로 입력된 로그인 화면이 열립니다.<br />
                    서비스 이용 및 별도 도입 문의는 <strong>riolavie0516@naver.com</strong>으로 연락해 주세요.
                  </p>
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <code className="px-2.5 py-1 bg-white border border-indigo-200 rounded-2xs text-[11px] font-mono text-indigo-950 select-all">
                      {studentInviteUrl}
                    </code>
                  </div>
                </div>
                <div className="flex flex-wrap sm:flex-nowrap gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={handleCopyInviteUrl}
                    className="px-4 py-2.5 bg-indigo-700 hover:bg-indigo-800 text-white font-bold text-xs rounded-2xs shadow-xs transition-colors whitespace-nowrap flex items-center justify-center gap-1.5"
                  >
                    <span className="material-symbols-outlined text-base">content_copy</span>
                    {inviteCopied ? '✓ 링크 복사 완료!' : '학생 초대 링크 복사'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsMigrationModalOpen(true)}
                    className="px-4 py-2.5 bg-white hover:bg-stone-50 border border-indigo-300 text-indigo-950 font-bold text-xs rounded-2xs shadow-xs transition-colors whitespace-nowrap flex items-center justify-center gap-1.5"
                  >
                    <span className="material-symbols-outlined text-base">mail</span>
                    공유 &amp; 문의 안내
                  </button>
                </div>
              </div>
            </div>

            {/* Full Data Backup & Restore Card */}
            <div className="pt-6 border-t border-[#1a1a1a]/15">
              <div className="bg-emerald-50/80 rounded-sm p-6 border border-emerald-300 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 text-emerald-950 font-bold text-sm mb-1">
                    <span className="material-symbols-outlined text-lg text-emerald-800">cloud_download</span>
                    영구 보존용 전체 학급 데이터 백업 / 복원
                  </div>
                  <p className="text-xs text-emerald-900/80 leading-relaxed">
                    현재 Round {state.currentRound} 기준 등록된 <strong>학생 {state.students.length}명 전원</strong>의 보유 현금, 예금, 주식, 부채, 예약 시나리오 및 학급 설정을 1개의 JSON 파일로 영구 보관합니다.<br />
                    학기 말 데이터를 안전하게 보관하거나 백업 시점 상태로 되돌릴 때 이 파일 하나로 <strong>100% 원상 복원</strong>할 수 있습니다.
                  </p>
                </div>
                <div className="flex flex-wrap sm:flex-nowrap gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={handleDownloadFullBackup}
                    className="px-4 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs rounded-2xs shadow-xs transition-colors whitespace-nowrap flex items-center justify-center gap-1.5"
                    title="현재 학급 데이터를 JSON 파일로 다운로드합니다"
                  >
                    <span className="material-symbols-outlined text-base">download</span>
                    전체 백업 다운로드 (.json)
                  </button>
                  <button
                    type="button"
                    onClick={() => backupFileInputRef.current?.click()}
                    className="px-4 py-2.5 bg-white hover:bg-stone-50 border border-emerald-300 text-emerald-950 font-bold text-xs rounded-2xs shadow-xs transition-colors whitespace-nowrap flex items-center justify-center gap-1.5"
                    title="백업한 JSON 파일을 업로드하여 데이터를 복원합니다"
                  >
                    <span className="material-symbols-outlined text-base">upload_file</span>
                    백업 파일 복원
                  </button>
                </div>
              </div>
            </div>

            {/* Reset All Data Section */}
            <div className="pt-6 border-t border-[#1a1a1a]/15">
              <div className="bg-red-50/80 rounded-sm p-6 border border-red-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 text-red-800 font-bold text-sm mb-1">
                    <span className="material-symbols-outlined text-lg">warning</span>
                    전체 모의 학생 및 학급 데이터 삭제
                  </div>
                  <p className="text-xs text-red-700/80">
                    등록된 모든 모의 학생 계정, 거래 기록, 자산 및 학급 설정 내역을 완전히 삭제하고 초기화합니다.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (window.confirm('가입된 모든 모의 학생 정보와 학급 거래 기록이 삭제됩니다. 정말 삭제하시겠습니까?')) {
                      resetAllData();
                      alert('모든 모의 학생 및 교사 자료가 초기화되었습니다.');
                    }
                  }}
                  className="px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded-2xs shadow-xs transition-colors whitespace-nowrap flex items-center justify-center gap-1.5"
                >
                  <span className="material-symbols-outlined text-base">delete_forever</span>
                  모든 데이터 전체 삭제
                </button>
              </div>
            </div>
          </form>
        )}

        {/* TAB 1: SCENARIO SETTINGS & LEADERBOARD SPLIT VIEW */}
        {activeTab === 'scenario' && (
          <div className="flex flex-col lg:flex-row gap-6 flex-1 items-start">
            {/* Left Column: Scenario Controls */}
            <div className="w-full lg:w-[42%] flex flex-col gap-5">
              {/* Economic Environment Card */}
              <section className="bg-white rounded-sm p-6 shadow-2xs border border-[#1a1a1a]/15 relative overflow-hidden">
                <div className="flex justify-between items-center mb-5 pb-2 border-b border-[#1a1a1a]/10">
                  <h2 className="font-editorial text-lg font-bold text-[#1a1a1a] flex items-center gap-2">
                    경제 환경 설정
                  </h2>
                  <span className="bg-[#faf8f5] px-2.5 py-1 rounded-2xs text-[10px] font-mono font-bold text-[#1a1a1a]/70 border border-[#1a1a1a]/12">
                    Round {state.currentRound + 1} 적용 예정
                  </span>
                </div>

                <div className="space-y-5">
                  <div>
                    <div className="flex justify-between mb-1.5">
                      <label className="font-bold text-xs uppercase tracking-wider text-[#1a1a1a]">예금 이자율</label>
                      <span className="font-mono font-bold text-xs text-[#1a1a1a]">{depositRate.toFixed(1)}%</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="15"
                      step="0.5"
                      value={depositRate}
                      onChange={e => setDepositRate(Number(e.target.value))}
                      className="w-full h-2 bg-stone-200 rounded-2xs appearance-none cursor-pointer accent-[#1a1a1a]"
                    />
                  </div>
                </div>
              </section>

              {/* Stock Market Controls */}
              <section className="bg-white rounded-sm p-6 shadow-2xs border border-[#1a1a1a]/15">
                <div className="flex flex-wrap justify-between items-center mb-3 pb-2 border-b border-[#1a1a1a]/10 gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="font-editorial text-lg font-bold text-[#1a1a1a]">
                        증권 시장 주가 변동 설정
                      </h2>
                      <span className="inline-flex items-center gap-1 text-[10px] font-mono font-bold text-emerald-900 bg-emerald-100/90 border border-emerald-300 px-2 py-0.5 rounded-2xs">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-700 animate-pulse"></span>
                        실시간 시장 연동
                      </span>
                    </div>
                    <p className="text-[11px] text-[#1a1a1a]/60 mt-0.5">
                      등록 종목: {state.stocks.length}/{MAX_STOCKS}개 | 주가를 변경하고 <strong>[즉시 반영]</strong>을 누르면 학생 화면에 실시간으로 즉시 적용됩니다.
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => {
                        if (state.stocks.length >= MAX_STOCKS) {
                          alert(`주식 종목은 최대 ${MAX_STOCKS}개까지만 추가할 수 있습니다.`);
                        } else {
                          setIsAddStockOpen(true);
                        }
                      }}
                      disabled={state.stocks.length >= MAX_STOCKS}
                      className={`px-2.5 py-1.5 rounded-2xs font-bold text-xs uppercase tracking-wider transition-colors flex items-center gap-1 shadow-2xs ${
                        state.stocks.length >= MAX_STOCKS
                          ? 'bg-stone-200 text-stone-500 cursor-not-allowed'
                          : 'bg-[#faf8f5] text-[#1a1a1a] border border-[#1a1a1a]/20 hover:bg-stone-100'
                      }`}
                    >
                      <span className="material-symbols-outlined text-[15px]">add</span>
                      종목 추가
                    </button>
                    <button
                      onClick={() => handleRequestBatchStockPrices()}
                      className="px-3 py-1.5 bg-[#1a1a1a] hover:bg-stone-800 text-white font-bold text-xs uppercase tracking-wider rounded-2xs shadow-2xs transition-all flex items-center gap-1.5 btn-press"
                      title="모든 설정된 주가를 확인 후 학생 증권 시장에 즉시 반영"
                    >
                      <span className="material-symbols-outlined text-[15px] text-amber-300">bolt</span>
                      전체 주가 즉시 반영
                    </button>
                  </div>
                </div>

                {/* Stock Toast Notification */}
                {stockToastMessage && (
                  <div className="mb-3 p-2.5 bg-emerald-50 border border-emerald-300 rounded-2xs text-xs font-bold text-emerald-900 flex items-center justify-between animate-in fade-in duration-150">
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-[18px] text-emerald-700">check_circle</span>
                      <span>{stockToastMessage}</span>
                    </div>
                    <button
                      onClick={() => setStockToastMessage(null)}
                      className="text-emerald-700 hover:text-emerald-900 text-[11px]"
                    >
                      닫기
                    </button>
                  </div>
                )}

                {/* Market Quick Presets */}
                <div className="mb-4 bg-[#faf8f5] p-2.5 rounded-2xs border border-[#1a1a1a]/12">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#1a1a1a]/60 flex items-center gap-1">
                      <span className="material-symbols-outlined text-[14px]">auto_awesome</span>
                      원클릭 시장 시세 변동 프리셋 (확인 후 실시간 즉시 반영)
                    </span>
                  </div>
                  <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleRequestMarketPreset('random')}
                      className="py-1.5 px-1 bg-white hover:bg-stone-100 border border-[#1a1a1a]/15 text-[#1a1a1a] text-[10px] font-bold rounded-2xs shadow-2xs transition-colors flex items-center justify-center gap-1"
                      title="전체 종목에 -15% ~ +15% 범위의 무작위 변동을 적용합니다."
                    >
                      <span>🎲</span>
                      <span>랜덤 변동</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRequestMarketPreset('bull_10')}
                      className="py-1.5 px-1 bg-white hover:bg-emerald-50 border border-emerald-300 text-emerald-900 text-[10px] font-bold rounded-2xs shadow-2xs transition-colors flex items-center justify-center gap-1"
                      title="전체 종목에 +5% ~ +10% 상승을 적용합니다."
                    >
                      <span>📈</span>
                      <span>상승장 (+10%)</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRequestMarketPreset('bear_10')}
                      className="py-1.5 px-1 bg-white hover:bg-rose-50 border border-rose-300 text-rose-900 text-[10px] font-bold rounded-2xs shadow-2xs transition-colors flex items-center justify-center gap-1"
                      title="전체 종목에 -5% ~ -10% 조정을 적용합니다."
                    >
                      <span>📉</span>
                      <span>하락장 (-10%)</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRequestMarketPreset('surge_30')}
                      className="py-1.5 px-1 bg-white hover:bg-emerald-100 border border-emerald-400 text-emerald-900 text-[10px] font-bold rounded-2xs shadow-2xs transition-colors flex items-center justify-center gap-1"
                      title="전체 종목에 상한가(+30%)를 적용합니다."
                    >
                      <span>🚀</span>
                      <span>상한가 (+30%)</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRequestMarketPreset('crash_30')}
                      className="py-1.5 px-1 bg-white hover:bg-rose-100 border border-rose-400 text-rose-900 text-[10px] font-bold rounded-2xs shadow-2xs transition-colors flex items-center justify-center gap-1"
                      title="전체 종목에 하한가(-30%)를 적용합니다."
                    >
                      <span>💥</span>
                      <span>하한가 (-30%)</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRequestMarketPreset('reset')}
                      className="py-1.5 px-1 bg-white hover:bg-stone-100 border border-[#1a1a1a]/15 text-[#1a1a1a]/70 text-[10px] font-bold rounded-2xs shadow-2xs transition-colors flex items-center justify-center gap-1"
                      title="이전 기준가로 복구합니다."
                    >
                      <span>🔄</span>
                      <span>이전가 복원</span>
                    </button>
                  </div>
                </div>

                {/* Stock Items List */}
                <div className="space-y-3 max-h-[540px] overflow-y-auto pr-1">
                  {state.stocks.map((st, idx) => {
                    const price = stockPrices[st.id] ?? st.currentPrice;
                    const isModified = price !== st.currentPrice;
                    const changeRate = st.previousPrice > 0
                      ? parseFloat((((price - st.previousPrice) / st.previousPrice) * 100).toFixed(1))
                      : 0;

                    return (
                      <div
                        key={st.id}
                        className={`p-3 rounded-2xs border transition-all ${
                          isModified
                            ? 'bg-amber-50/70 border-amber-300 ring-1 ring-amber-300/60'
                            : 'bg-[#faf8f5] border-[#1a1a1a]/12'
                        }`}
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          {/* Stock Info */}
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="w-7 h-7 rounded-2xs bg-[#1a1a1a] text-white font-mono flex items-center justify-center font-bold text-xs flex-shrink-0">
                              {idx + 1}
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5">
                                <span className="text-[10px] font-bold text-[#1a1a1a]/50 uppercase bg-[#1a1a1a]/5 px-1 rounded-2xs">
                                  {st.category}
                                </span>
                                <p className="font-bold text-xs text-[#1a1a1a] truncate">{st.name}</p>
                                {isModified && (
                                  <span className="text-[9px] font-bold bg-amber-200 text-amber-900 px-1 rounded-2xs">
                                    미반영
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-2 text-[11px] font-mono text-[#1a1a1a]/70 mt-0.5">
                                <span>현재가: <strong className="text-[#1a1a1a]">{st.currentPrice.toLocaleString()}원</strong></span>
                                <span>|</span>
                                <span className="text-[#1a1a1a]/50">이전가: {st.previousPrice.toLocaleString()}원</span>
                              </div>
                            </div>
                          </div>

                          {/* Controls */}
                          <div className="flex items-center gap-2 flex-wrap justify-end">
                            {/* Quick % buttons */}
                            <div className="flex items-center gap-1 bg-white p-0.5 rounded-2xs border border-[#1a1a1a]/15">
                              <button
                                type="button"
                                onClick={() => handleAdjustStockPricePct(st.id, -10)}
                                className="px-1.5 py-0.5 text-[10px] font-mono font-bold text-rose-800 hover:bg-rose-50 rounded-2xs transition-colors"
                                title="-10% 하락 설정"
                              >
                                -10%
                              </button>
                              <button
                                type="button"
                                onClick={() => handleAdjustStockPricePct(st.id, -5)}
                                className="px-1.5 py-0.5 text-[10px] font-mono font-bold text-rose-800 hover:bg-rose-50 rounded-2xs transition-colors"
                                title="-5% 하락 설정"
                              >
                                -5%
                              </button>
                              <button
                                type="button"
                                onClick={() => handleAdjustStockPricePct(st.id, 5)}
                                className="px-1.5 py-0.5 text-[10px] font-mono font-bold text-emerald-800 hover:bg-emerald-50 rounded-2xs transition-colors"
                                title="+5% 상승 설정"
                              >
                                +5%
                              </button>
                              <button
                                type="button"
                                onClick={() => handleAdjustStockPricePct(st.id, 10)}
                                className="px-1.5 py-0.5 text-[10px] font-mono font-bold text-emerald-800 hover:bg-emerald-50 rounded-2xs transition-colors"
                                title="+10% 상승 설정"
                              >
                                +10%
                              </button>
                            </div>

                            {/* Price input & Change preview */}
                            <div className="flex items-center gap-1">
                              <div className="relative">
                                <input
                                  type="number"
                                  step="100"
                                  min="100"
                                  value={price}
                                  onChange={e => setStockPrices(prev => ({ ...prev, [st.id]: Number(e.target.value) }))}
                                  onKeyDown={e => {
                                    if (e.key === 'Enter') {
                                      e.preventDefault();
                                      handleRequestSingleStockPrice(st.id, price);
                                    }
                                  }}
                                  className="w-24 px-2 py-1 pr-5 border border-[#1a1a1a]/20 rounded-2xs font-mono font-bold text-xs text-right focus:border-[#1a1a1a] focus:ring-0 bg-white"
                                />
                                <span className="absolute right-1.5 top-1.5 text-[10px] text-stone-400 pointer-events-none font-medium">
                                  원
                                </span>
                              </div>

                              <span className={`font-bold text-[10px] font-mono w-14 text-right px-1 py-0.5 rounded-2xs border ${
                                changeRate >= 0
                                  ? 'text-emerald-800 bg-emerald-50 border-emerald-200'
                                  : 'text-rose-800 bg-rose-50 border-rose-200'
                              }`}>
                                {changeRate >= 0 ? `▲+${changeRate}%` : `▼${changeRate}%`}
                              </span>
                            </div>

                            {/* Instant Apply Button */}
                            <button
                              type="button"
                              onClick={() => handleRequestSingleStockPrice(st.id, price)}
                              className={`px-2 py-1 rounded-2xs text-[11px] font-bold uppercase transition-all flex items-center gap-0.5 ${
                                isModified
                                  ? 'bg-[#1a1a1a] text-white hover:bg-stone-800 shadow-2xs animate-pulse'
                                  : 'bg-white border border-[#1a1a1a]/20 text-[#1a1a1a] hover:bg-stone-100'
                              }`}
                              title="확인 후 이 종목의 주가를 즉시 실시간 시장에 반영합니다."
                            >
                              <span className="material-symbols-outlined text-[13px]">bolt</span>
                              반영
                            </button>

                            {/* Delete Stock */}
                            {state.stocks.length > 1 && (
                              <button
                                onClick={() => handleDeleteStock(st.id, st.name)}
                                className="text-stone-400 hover:text-rose-700 p-1 transition-colors"
                                title="종목 삭제"
                              >
                                <span className="material-symbols-outlined text-[16px]">delete</span>
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Bottom Full Apply Bar */}
                <div className="mt-4 pt-3 border-t border-[#1a1a1a]/10 flex flex-wrap justify-between items-center gap-2">
                  <span className="text-xs text-[#1a1a1a]/60">
                    💡 개별 종목의 <strong>[반영]</strong>을 누르거나 아래 버튼으로 변경된 모든 주가를 확인 후 즉시 적용할 수 있습니다.
                  </span>
                  <button
                    type="button"
                    onClick={() => handleRequestBatchStockPrices()}
                    className="px-4 py-2 bg-[#1a1a1a] hover:bg-stone-800 text-white font-bold text-xs uppercase tracking-wider rounded-2xs shadow-2xs transition-all flex items-center gap-1.5 btn-press"
                  >
                    <span className="material-symbols-outlined text-[16px] text-amber-300">bolt</span>
                    변경된 주가 실시간 시장에 즉시 적용하기
                  </button>
                </div>
              </section>

              {/* Economic News Publisher */}
              <section className="bg-white rounded-sm p-6 shadow-2xs border border-[#1a1a1a]/15">
                <h2 className="font-editorial text-lg font-bold text-[#1a1a1a] mb-3 pb-2 border-b border-[#1a1a1a]/10">
                  경제 뉴스 속보 발행
                </h2>
                <textarea
                  rows={3}
                  value={newsInput}
                  onChange={e => setNewsInput(e.target.value)}
                  placeholder="학생들 앱에 속보 알림으로 전송될 경제 기사 원고를 입력하세요."
                  className="w-full p-3 bg-[#faf8f5] border border-[#1a1a1a]/20 rounded-2xs text-xs text-[#1a1a1a] focus:border-[#1a1a1a] focus:ring-0 resize-none font-medium"
                />
                <div className="flex justify-end gap-2 mt-3">
                  <button
                    onClick={handleApplyScenario}
                    className="h-10 px-5 bg-[#1a1a1a] hover:bg-stone-800 text-white font-bold text-xs uppercase tracking-wider rounded-2xs shadow-2xs transition-all btn-press"
                  >
                    시나리오 적용 및 속보 발행
                  </button>
                </div>
              </section>

              {/* Scheduled Round Scenarios (up to 5 upcoming rounds, auto-saved & time-triggered) */}
              <section className="bg-white rounded-sm p-6 shadow-2xs border-2 border-indigo-200/80 relative">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-4 pb-2.5 border-b border-[#1a1a1a]/10">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-lg text-indigo-700">schedule_send</span>
                      <h2 className="font-editorial text-lg font-bold text-[#1a1a1a]">
                        다음 시나리오 예약 & 자동 실행
                      </h2>
                    </div>
                    <p className="text-[11px] text-[#1a1a1a]/60 mt-0.5">
                      최대 {MAX_SCHEDULED_SCENARIOS}개 라운드까지 입력 즉시 자동 저장되며, 지정 날짜·시간이 되면 다음 라운드로 자동 전환됩니다.
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {scheduleAutoSaveStatus === 'saving' && (
                      <span className="text-[11px] font-bold text-amber-800 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-2xs">
                        자동 저장 중...
                      </span>
                    )}
                    {scheduleAutoSaveStatus === 'saved' && (
                      <span className="text-[11px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-2xs flex items-center gap-1">
                        <span className="material-symbols-outlined text-[13px]">cloud_done</span>
                        자동 저장됨
                      </span>
                    )}
                  </div>
                </div>

                {/* 5 Round Slot Tabs */}
                <div className="grid grid-cols-5 gap-1.5 mb-4">
                  {upcomingTargetRounds.map((rNum, idx) => {
                    const slotItem = (state.scheduledScenarios || []).find(s => s.targetRound === rNum);
                    const isSelected = idx === selectedScheduleSlotIdx;
                    return (
                      <button
                        key={rNum}
                        type="button"
                        onClick={() => setSelectedScheduleSlotIdx(idx)}
                        className={`p-2 rounded-2xs border text-center transition-all flex flex-col items-center gap-0.5 ${
                          isSelected
                            ? 'bg-[#1a1a1a] text-white border-[#1a1a1a] shadow-2xs'
                            : slotItem?.status === 'pending'
                            ? 'bg-indigo-50 text-indigo-950 border-indigo-300 hover:bg-indigo-100'
                            : slotItem?.status === 'executed'
                            ? 'bg-emerald-50 text-emerald-900 border-emerald-300'
                            : 'bg-[#faf8f5] text-[#1a1a1a]/70 border-[#1a1a1a]/15 hover:bg-stone-100'
                        }`}
                      >
                        <span className="font-mono font-bold text-xs">R{rNum}</span>
                        <span className={`text-[9px] font-bold ${
                          isSelected ? 'text-amber-300' : slotItem?.status === 'pending' ? 'text-indigo-700' : 'text-stone-400'
                        }`}>
                          {slotItem?.status === 'pending'
                            ? '예약됨'
                            : slotItem?.status === 'executed'
                            ? '완료됨'
                            : slotItem?.status === 'failed'
                            ? '오류'
                            : '미설정'}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {/* Selected Slot Editor */}
                <div className="space-y-3.5 text-xs">
                  {/* Target DateTime & Quick Presets */}
                  <div className="p-3 bg-[#faf8f5] rounded-2xs border border-[#1a1a1a]/15 space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="font-bold text-[#1a1a1a] uppercase tracking-wider text-[11px]">
                        Round {activeTargetRound} 자동 전환 일시 지정
                      </label>
                      {scheduleDraftDate && (
                        <span className="font-mono text-[10px] font-bold text-indigo-800 bg-indigo-100 px-1.5 py-0.5 rounded-2xs">
                          {formatCountdown(new Date(scheduleDraftDate).toISOString())}
                        </span>
                      )}
                    </div>
                    <input
                      type="datetime-local"
                      value={scheduleDraftDate}
                      onChange={e => {
                        setScheduleDraftDate(e.target.value);
                        setScheduleDirty(true);
                      }}
                      className="w-full px-2.5 py-1.5 bg-white border border-[#1a1a1a]/20 rounded-2xs font-mono text-xs font-bold text-[#1a1a1a] focus:border-[#1a1a1a] focus:ring-0"
                    />
                    <div className="flex flex-wrap gap-1">
                      <button
                        type="button"
                        onClick={() => applySchedulePresetMinutes(5)}
                        className="px-2 py-1 bg-white hover:bg-indigo-50 border border-[#1a1a1a]/15 rounded-2xs text-[10px] font-bold text-[#1a1a1a]"
                      >
                        +5분 뒤
                      </button>
                      <button
                        type="button"
                        onClick={() => applySchedulePresetMinutes(10)}
                        className="px-2 py-1 bg-white hover:bg-indigo-50 border border-[#1a1a1a]/15 rounded-2xs text-[10px] font-bold text-[#1a1a1a]"
                      >
                        +10분 뒤
                      </button>
                      <button
                        type="button"
                        onClick={() => applySchedulePresetMinutes(30)}
                        className="px-2 py-1 bg-white hover:bg-indigo-50 border border-[#1a1a1a]/15 rounded-2xs text-[10px] font-bold text-[#1a1a1a]"
                      >
                        +30분 뒤
                      </button>
                      <button
                        type="button"
                        onClick={() => applySchedulePresetMinutes(60)}
                        className="px-2 py-1 bg-white hover:bg-indigo-50 border border-[#1a1a1a]/15 rounded-2xs text-[10px] font-bold text-[#1a1a1a]"
                      >
                        +1시간 뒤
                      </button>
                      <button
                        type="button"
                        onClick={applyScheduleTomorrowNineAm}
                        className="px-2 py-1 bg-white hover:bg-indigo-50 border border-[#1a1a1a]/15 rounded-2xs text-[10px] font-bold text-[#1a1a1a]"
                      >
                        내일 09:00
                      </button>
                    </div>
                  </div>

                  {/* Deposit Rate & Auto Settlement Option */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div className="p-2.5 bg-[#faf8f5] rounded-2xs border border-[#1a1a1a]/12">
                      <div className="flex justify-between items-center mb-1">
                        <span className="font-bold text-[11px] text-[#1a1a1a]">예금 이자율 (%)</span>
                        <span className="font-mono font-bold text-xs text-indigo-900">{scheduleDraftDepositRate.toFixed(1)}%</span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="15"
                        step="0.5"
                        value={scheduleDraftDepositRate}
                        onChange={e => {
                          setScheduleDraftDepositRate(Number(e.target.value));
                          if (!scheduleDraftDate) applySchedulePresetMinutes(60);
                          setScheduleDirty(true);
                        }}
                        className="w-full h-1.5 bg-stone-200 rounded-2xs appearance-none cursor-pointer accent-[#1a1a1a]"
                      />
                    </div>
                    <label className="p-2.5 bg-[#faf8f5] rounded-2xs border border-[#1a1a1a]/12 flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={scheduleDraftExecuteSettlement}
                        onChange={e => {
                          setScheduleDraftExecuteSettlement(e.target.checked);
                          if (!scheduleDraftDate) applySchedulePresetMinutes(60);
                          setScheduleDirty(true);
                        }}
                        className="w-4 h-4 rounded-2xs text-[#1a1a1a] focus:ring-[#1a1a1a]"
                      />
                      <span className="text-[11px] font-bold text-[#1a1a1a] leading-tight">
                        자동 전환 시 이전 라운드<br />예금 이자 정산 함께 실행
                      </span>
                    </label>
                  </div>

                  {/* Target Stock Prices for Scheduled Round */}
                  <div className="p-3 bg-[#faf8f5] rounded-2xs border border-[#1a1a1a]/12">
                    <div className="flex justify-between items-center mb-2">
                      <span className="font-bold text-[11px] uppercase tracking-wider text-[#1a1a1a]">
                        Round {activeTargetRound} 예약 주가 ({state.stocks.length}개 종목)
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          const synced: Record<string, number> = {};
                          state.stocks.forEach(st => {
                            synced[st.id] = stockPrices[st.id] ?? st.currentPrice;
                          });
                          setScheduleDraftStockPrices(synced);
                          if (!scheduleDraftDate) applySchedulePresetMinutes(60);
                          setScheduleDirty(true);
                        }}
                        className="text-[10px] font-bold text-indigo-700 hover:underline"
                      >
                        위 시세표 값 가져오기
                      </button>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-48 overflow-y-auto pr-1">
                      {state.stocks.map(st => {
                        const targetP = scheduleDraftStockPrices[st.id] ?? st.currentPrice;
                        return (
                          <div key={st.id} className="flex items-center justify-between gap-2 bg-white px-2 py-1 rounded-2xs border border-[#1a1a1a]/10">
                            <span className="text-[11px] font-bold text-[#1a1a1a] truncate">{st.name}</span>
                            <div className="flex items-center gap-1 shrink-0">
                              <input
                                type="number"
                                step="100"
                                min="100"
                                value={targetP}
                                onChange={e => {
                                  const val = Math.max(100, Number(e.target.value) || 100);
                                  setScheduleDraftStockPrices(prev => ({ ...prev, [st.id]: val }));
                                  if (!scheduleDraftDate) applySchedulePresetMinutes(60);
                                  setScheduleDirty(true);
                                }}
                                className="w-20 px-1.5 py-0.5 text-right font-mono font-bold text-[11px] border border-[#1a1a1a]/20 rounded-2xs bg-[#faf8f5]"
                              />
                              <span className="text-[10px] text-stone-400">원</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Scheduled News Title & Breaking Message */}
                  <div className="space-y-2">
                    <input
                      type="text"
                      value={scheduleDraftNewsTitle}
                      onChange={e => {
                        setScheduleDraftNewsTitle(e.target.value);
                        if (!scheduleDraftDate) applySchedulePresetMinutes(60);
                        setScheduleDirty(true);
                      }}
                      placeholder={`Round ${activeTargetRound} 뉴스레터 제목`}
                      className="w-full px-3 py-1.5 bg-[#faf8f5] border border-[#1a1a1a]/20 rounded-2xs text-xs font-bold text-[#1a1a1a]"
                    />
                    <textarea
                      rows={2}
                      value={scheduleDraftNews}
                      onChange={e => {
                        setScheduleDraftNews(e.target.value);
                        if (!scheduleDraftDate) applySchedulePresetMinutes(60);
                        setScheduleDirty(true);
                      }}
                      placeholder={`Round ${activeTargetRound} 시작 시 자동 발행될 경제 속보 내용`}
                      className="w-full p-2.5 bg-[#faf8f5] border border-[#1a1a1a]/20 rounded-2xs text-xs text-[#1a1a1a] resize-none"
                    />
                  </div>

                  {/* Action Buttons */}
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                    {existingScheduleForSlot ? (
                      <button
                        type="button"
                        onClick={() => {
                          if (confirm(`Round ${activeTargetRound} 예약을 삭제하시겠습니까?`)) {
                            deleteScheduledScenario(existingScheduleForSlot.id);
                            setScheduleDraftDate('');
                          }
                        }}
                        className="px-3 py-2 bg-rose-50 hover:bg-rose-100 border border-rose-300 text-rose-800 rounded-2xs text-xs font-bold flex items-center gap-1"
                      >
                        <span className="material-symbols-outlined text-[15px]">delete</span>
                        예약 삭제
                      </button>
                    ) : (
                      <span className="text-[11px] text-[#1a1a1a]/50">
                        날짜·시간을 선택하면 자동 저장됩니다.
                      </span>
                    )}

                    <div className="flex items-center gap-2">
                      {existingScheduleForSlot && (
                        <button
                          type="button"
                          onClick={async () => {
                            if (confirm(`Round ${activeTargetRound} 예약 시나리오를 지금 즉시 실행하시겠습니까?`)) {
                              const ok = await triggerScheduledScenarioNow(existingScheduleForSlot.id);
                              if (ok) alert(`Round ${activeTargetRound} 시나리오가 즉시 적용되었습니다!`);
                            }
                          }}
                          className="px-3.5 py-2 bg-indigo-700 hover:bg-indigo-800 text-white rounded-2xs text-xs font-bold flex items-center gap-1 shadow-2xs"
                        >
                          <span className="material-symbols-outlined text-[15px]">play_arrow</span>
                          지금 즉시 실행
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </section>
            </div>

            {/* Right Column: Real-time Leaderboard */}
            <div className="w-full lg:w-[58%] bg-white rounded-sm shadow-2xs border border-[#1a1a1a]/15 flex flex-col overflow-hidden">
              <div className="p-4 md:p-5 border-b border-[#1a1a1a]/15 flex flex-wrap justify-between items-center gap-3 bg-[#faf8f5]">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="font-editorial text-lg font-bold text-[#1a1a1a]">
                      실시간 자산 현황 (Round {state.currentRound})
                    </h2>
                    <span className="text-[10px] font-mono text-emerald-900 bg-emerald-100/80 border border-emerald-300 px-1.5 py-0.5 rounded-2xs font-semibold">
                      {formatSyncTime(lastSyncedAt)} 기준
                    </span>
                  </div>
                  <p className="text-[11px] text-[#1a1a1a]/60 mt-0.5">총 자산 순위 기준으로 실시간 자동 집계됩니다.</p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={handleManualSync}
                    disabled={isSyncing}
                    title="실시간 학생 자산 현황 새로고침"
                    className="h-8 px-2.5 bg-white hover:bg-stone-100 border border-[#1a1a1a]/20 text-[#1a1a1a] rounded-2xs text-xs font-bold flex items-center gap-1 shadow-2xs transition-all btn-press"
                  >
                    <span className={`material-symbols-outlined text-[15px] text-emerald-800 ${isSyncing ? 'animate-spin' : ''}`}>
                      sync
                    </span>
                    <span>{isSyncing ? '동기화...' : '자산 새로고침'}</span>
                  </button>
                  <input
                    type="text"
                    placeholder="학생 검색..."
                    value={studentSearch}
                    onChange={e => setStudentSearch(e.target.value)}
                    className="px-2.5 py-1.5 bg-white border border-[#1a1a1a]/20 rounded-2xs text-xs font-medium focus:border-[#1a1a1a] focus:ring-0 w-28 md:w-36"
                  />
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse min-w-[500px]">
                  <thead className="bg-[#faf8f5] border-b border-[#1a1a1a]/15 sticky top-0 z-10 text-[11px] font-bold uppercase tracking-wider text-[#1a1a1a]/60">
                    <tr>
                      <th className="py-3 px-4 text-center w-12">순위</th>
                      <th className="py-3 px-4">성명</th>
                      <th className="py-3 px-4 text-right">총 자산 (원)</th>
                      <th className="py-3 px-4 text-right w-32">현금 비중</th>
                      <th className="py-3 px-4 text-center w-16">상태</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#1a1a1a]/10 text-xs font-medium">
                    {[...filteredStudents]
                      .sort((a, b) => calculateTotalAssets(b) - calculateTotalAssets(a))
                      .map((st, idx) => {
                        const totalA = calculateTotalAssets(st);
                        const cashBarPct = totalA > 0 ? Math.round((st.cash / totalA) * 100) : 0;
                        return (
                          <tr key={st.id} className="hover:bg-[#faf8f5] transition-colors">
                            <td className="py-3 px-4 text-center font-editorial font-bold text-sm text-[#1a1a1a]">
                              {idx === 0 ? '🥇 1' : idx === 1 ? '🥈 2' : idx === 2 ? '🥉 3' : idx + 1}
                            </td>
                            <td className="py-3 px-4 font-bold text-[#1a1a1a]">
                              {st.name} <span className="text-[11px] font-mono text-[#1a1a1a]/50">({st.number}번)</span>
                            </td>
                            <td className="py-3 px-4 text-right font-mono font-bold text-[#1a1a1a]">
                              {totalA.toLocaleString()}
                            </td>
                            <td className="py-3 px-4 text-right">
                              <div className="w-full bg-stone-200 rounded-2xs h-1.5 mt-1 overflow-hidden border border-[#1a1a1a]/10">
                                <div
                                  className="bg-[#1a1a1a] h-full"
                                  style={{ width: `${cashBarPct}%` }}
                                ></div>
                              </div>
                              <span className="text-[10px] text-[#1a1a1a]/60 font-mono">{cashBarPct}%</span>
                            </td>
                            <td className="py-3 px-4 text-center">
                              <span
                                className={`inline-block w-2 h-2 rounded-full ${
                                  st.isOnline ? 'bg-emerald-700 ring-2 ring-emerald-300' : 'bg-stone-300'
                                }`}
                                title={st.isOnline ? '실시간 접속중' : '오프라인'}
                              ></span>
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>

              <div className="p-4 border-t border-[#1a1a1a]/15 bg-[#faf8f5] flex justify-between items-center text-xs text-[#1a1a1a] font-bold">
                <span>총 등록 학생: {totalStudents}명</span>
                <button
                  onClick={() => setActiveTab('leaderboard')}
                  className="flex items-center gap-1 text-[#1a1a1a] hover:underline uppercase tracking-wider text-[11px]"
                >
                  전체 리더보드 →
                </button>
              </div>
            </div>
          </div>
        )}

        {/* TAB: NEWSLETTER MANAGER */}
        {activeTab === 'newsletter' && (
          <TeacherNewsletterManager />
        )}

        {/* TAB 2: STUDENT ACCOUNTS & PIN MANAGEMENT */}
        {activeTab === 'students' && (
          <div className="space-y-6">
            {/* Header & Actions */}
            <div className="flex flex-wrap items-end justify-between border-b border-[#1a1a1a]/15 pb-4 gap-4">
              <div>
                <h1 className="font-editorial text-2xl font-bold text-[#1a1a1a]">학생 계정 & PIN 관리</h1>
                <p className="text-xs text-[#1a1a1a]/70 mt-1">
                  교사가 직접 학생 계정을 등록/삭제하고, PIN 번호 및 자산을 관리할 수 있습니다.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={handleDownloadFullBackup}
                  className="h-9 px-3.5 rounded-2xs bg-emerald-50 border border-emerald-300 text-emerald-900 font-bold text-xs hover:bg-emerald-100 transition-colors flex items-center gap-1.5 shadow-2xs"
                  title="등록된 학생들의 자산/주식/예금/거래기록/학급설정 전체를 영구 보존용 JSON 파일로 다운로드합니다"
                >
                  <span className="material-symbols-outlined text-sm text-emerald-800">save</span>
                  전체 백업 (JSON)
                </button>
                <button
                  type="button"
                  onClick={() => backupFileInputRef.current?.click()}
                  className="h-9 px-3.5 rounded-2xs bg-white border border-[#1a1a1a]/30 text-[#1a1a1a] font-bold text-xs hover:bg-[#faf8f5] transition-colors flex items-center gap-1.5 shadow-2xs"
                  title="이전에 다운로드한 JSON 백업 파일을 불러와 전체 학급 데이터를 복원합니다"
                >
                  <span className="material-symbols-outlined text-sm">upload_file</span>
                  백업 복원
                </button>
                <button
                  onClick={exportToExcel}
                  className="h-9 px-4 rounded-2xs border border-[#1a1a1a]/30 text-[#1a1a1a] font-bold text-xs uppercase tracking-wider hover:bg-[#faf8f5] transition-colors flex items-center gap-1.5"
                >
                  <span className="material-symbols-outlined text-sm">download</span>
                  명단 EXCEL
                </button>
                <button
                  type="button"
                  onClick={() => setShowAllPins(!showAllPins)}
                  className={`h-9 px-3.5 rounded-2xs border text-xs font-bold transition-all flex items-center gap-1.5 shadow-2xs ${
                    showAllPins
                      ? 'bg-blue-50 border-blue-200 text-blue-800'
                      : 'bg-white border-[#1a1a1a]/20 text-[#1a1a1a]/70 hover:bg-[#faf8f5]'
                  }`}
                  title={showAllPins ? '비밀번호를 가립니다' : '모든 학생의 비밀번호를 화면에 표시합니다'}
                >
                  <span className="material-symbols-outlined text-[16px]">
                    {showAllPins ? 'visibility' : 'visibility_off'}
                  </span>
                  <span>{showAllPins ? 'PIN 표시중' : 'PIN 숨김'}</span>
                </button>
                <button
                  onClick={() => setIsResetAllModalOpen(true)}
                  className="h-9 px-4 rounded-2xs bg-amber-800 text-white font-bold text-xs uppercase tracking-wider hover:bg-amber-900 transition-all flex items-center gap-1.5 shadow-2xs"
                  title="전체 학생 PIN 일괄 초기화"
                >
                  <span className="material-symbols-outlined text-sm">restart_alt</span>
                  전체 PIN 일괄 초기화
                </button>
                <button
                  type="button"
                  onClick={handleCleanDuplicates}
                  className={`h-9 px-3.5 rounded-2xs border text-xs font-bold transition-all flex items-center gap-1.5 shadow-2xs ${
                    duplicateCount > 0
                      ? 'bg-rose-50 border-rose-300 text-rose-800 hover:bg-rose-100 font-bold'
                      : 'bg-white border-[#1a1a1a]/20 text-[#1a1a1a]/70 hover:bg-[#faf8f5]'
                  }`}
                  title="1~5번 등 중복 학생 계정을 감지하고 중복을 일괄 삭제합니다"
                >
                  <span className="material-symbols-outlined text-[16px]">
                    cleaning_services
                  </span>
                  <span>{duplicateCount > 0 ? `중복 학생 정리 (${duplicateCount})` : '중복 학생 정리'}</span>
                </button>
                <button
                  type="button"
                  disabled={isRepairingConsistency}
                  onClick={handleRepairBalancesConsistency}
                  className="h-9 px-3.5 rounded-2xs border border-indigo-300 bg-indigo-50 hover:bg-indigo-100 text-indigo-900 text-xs font-bold transition-all flex items-center gap-1.5 shadow-2xs disabled:opacity-60"
                  title="모든 학생의 현금·예금·부채 소수점 및 비정상 값을 정수 기준으로 검사·보정합니다"
                >
                  <span className="material-symbols-outlined text-[16px]">
                    verified
                  </span>
                  <span>{isRepairingConsistency ? '검사 중...' : '🔍 데이터 정합성 검사/보정'}</span>
                </button>
                <button
                  onClick={() => setIsBulkStudentOpen(true)}
                  className="h-9 px-5 rounded-2xs bg-[#1a1a1a] text-white font-bold text-xs uppercase tracking-wider hover:bg-stone-800 transition-all shadow-2xs flex items-center gap-1.5"
                >
                  <span className="material-symbols-outlined text-sm">person_add</span>
                  + 학생 등록 / 명단 입력
                </button>
              </div>
            </div>

            {/* Duplication Warning Banner if duplicates exist */}
            {duplicateCount > 0 && (
              <div className="bg-rose-50 border border-rose-300 rounded-sm p-4 flex flex-wrap items-center justify-between gap-3 text-rose-900 shadow-2xs animate-in fade-in">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-2xs bg-rose-100 border border-rose-300 flex items-center justify-center shrink-0">
                    <span className="material-symbols-outlined text-rose-700 text-xl">warning</span>
                  </div>
                  <div>
                    <p className="text-xs font-bold text-rose-950">
                      1~5번 등 중복된 학생 계정 {duplicateCount}개가 감지되었습니다.
                    </p>
                    <p className="text-[11px] text-rose-800/80 mt-0.5">
                      중복 대상: {duplicateInfo.duplicateStudents.map(s => `${s.number}번 ${s.name}`).slice(0, 5).join(', ')}
                      {duplicateInfo.duplicateStudents.length > 5 ? ` 외 ${duplicateInfo.duplicateStudents.length - 5}명` : ''} (삭제 시 중복 계정만 안전하게 정리됩니다)
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleCleanDuplicates}
                  className="h-8 px-4 bg-rose-700 hover:bg-rose-800 text-white font-bold text-xs rounded-2xs flex items-center gap-1.5 shadow-2xs transition-colors"
                >
                  <span className="material-symbols-outlined text-sm">cleaning_services</span>
                  중복 학생 즉시 삭제
                </button>
              </div>
            )}

            {/* Bento Grid Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-white rounded-sm p-5 border border-[#1a1a1a]/15 shadow-2xs">
                <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#1a1a1a]/50">TOTAL STUDENTS</span>
                <div className="flex items-end gap-1.5 mt-1">
                  <span className="font-editorial font-bold text-3xl text-[#1a1a1a]">{totalStudents}</span>
                  <span className="text-xs text-[#1a1a1a]/60 mb-1">명 등록됨</span>
                </div>
              </div>

              <div className="bg-white rounded-sm p-5 border border-[#1a1a1a]/15 shadow-2xs">
                <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#1a1a1a]/50">PIN RESET REQUESTS</span>
                <div className="flex items-end gap-1.5 mt-1">
                  <span className="font-editorial font-bold text-3xl text-amber-800">{pinResetCount}</span>
                  <span className="text-xs text-[#1a1a1a]/60 mb-1">건 대기중</span>
                </div>
              </div>
            </div>

            {/* Student Table */}
            <div className="bg-white rounded-sm border border-[#1a1a1a]/15 shadow-2xs overflow-hidden">
              <div className="p-4 border-b border-[#1a1a1a]/15 bg-[#faf8f5] flex flex-wrap justify-between items-center gap-3">
                <div className="flex flex-wrap items-center gap-3">
                  <input
                    type="text"
                    placeholder="이름 또는 아이디 검색"
                    value={studentSearch}
                    onChange={e => setStudentSearch(e.target.value)}
                    className="w-56 h-9 px-3 rounded-2xs border border-[#1a1a1a]/20 focus:border-[#1a1a1a] focus:ring-0 text-xs font-medium bg-white"
                  />
                  {studentSearch && (
                    <button
                      onClick={() => setStudentSearch('')}
                      className="text-xs text-[#1a1a1a]/60 hover:text-[#1a1a1a] underline"
                    >
                      검색 초기화
                    </button>
                  )}

                  {/* Status Filter Tabs */}
                  <div className="flex flex-wrap items-center gap-1.5 bg-white p-1 rounded-2xs border border-[#1a1a1a]/15">
                    <button
                      type="button"
                      onClick={() => setStudentStatusFilter('all')}
                      className={`px-2.5 py-1 rounded-2xs text-xs font-bold transition-all ${
                        studentStatusFilter === 'all'
                          ? 'bg-[#1a1a1a] text-white shadow-2xs'
                          : 'text-[#1a1a1a]/70 hover:bg-[#faf8f5]'
                      }`}
                    >
                      전체 ({totalStudents})
                    </button>
                    {pinResetCount > 0 && (
                      <button
                        type="button"
                        onClick={() => setStudentStatusFilter('pin_reset')}
                        className={`px-2.5 py-1 rounded-2xs text-xs font-bold flex items-center gap-1.5 transition-all ${
                          studentStatusFilter === 'pin_reset'
                            ? 'bg-amber-800 text-white shadow-2xs'
                            : 'text-amber-900 hover:bg-amber-100'
                        }`}
                      >
                        <span>⚠️</span>
                        PIN요청 ({pinResetCount})
                      </button>
                    )}
                    {debtStudentCount > 0 && (
                      <button
                        type="button"
                        onClick={() => setStudentStatusFilter('debt')}
                        className={`px-2.5 py-1 rounded-2xs text-xs font-bold flex items-center gap-1.5 transition-all ${
                          studentStatusFilter === 'debt'
                            ? 'bg-rose-900 text-white shadow-2xs'
                            : 'text-rose-900 hover:bg-rose-100'
                        }`}
                      >
                        <span>🚨</span>
                        부채 보유 ({debtStudentCount})
                      </button>
                    )}
                  </div>
                </div>

                {/* Batch Actions */}
                {selectedStudentRowIds.length > 0 && (
                  <div className="flex flex-wrap items-center gap-2 animate-in fade-in">
                    <span className="text-xs font-bold text-blue-900 bg-blue-50 border border-blue-200 px-2.5 py-1 rounded-2xs">
                      {selectedStudentRowIds.length}명 선택됨
                    </span>
                    <button
                      onClick={() => {
                        const targets = state.students.filter(s => selectedStudentRowIds.includes(s.id));
                        setTeacherPinTargetStudents(targets);
                        setTeacherPinTargetStudent(null);
                        setIsTeacherPinModalOpen(true);
                      }}
                      className="h-9 px-3 bg-blue-700 hover:bg-blue-800 text-white font-bold text-xs rounded-2xs flex items-center gap-1 shadow-2xs transition-colors"
                      title="선택한 학생들의 PIN을 한번에 변경합니다"
                    >
                      <span className="material-symbols-outlined text-sm">key</span>
                      선택 학생 PIN 일괄 변경
                    </button>
                    <button
                      onClick={() => {
                        if (
                          confirm(
                            `선택한 ${selectedStudentRowIds.length}명 학생의 PIN을 1234로 일괄 초기화하시겠습니까?`
                          )
                        ) {
                          const res = updateMultipleStudentsPinByTeacher(selectedStudentRowIds, '1234');
                          alert(res.message || '1234로 초기화되었습니다.');
                        }
                      }}
                      className="h-9 px-3 bg-amber-800 hover:bg-amber-900 text-white font-bold text-xs rounded-2xs flex items-center gap-1 shadow-2xs transition-colors"
                      title="선택한 학생들의 PIN을 1234로 초기화합니다"
                    >
                      <span className="material-symbols-outlined text-sm">restart_alt</span>
                      선택 1234 초기화
                    </button>
                    <button
                      onClick={async () => {
                        if (
                          confirm(
                            `선택한 ${selectedStudentRowIds.length}명의 학생 계정을 삭제하시겠습니까?\n삭제된 데이터는 복구할 수 없습니다.`
                          )
                        ) {
                          const idsToDelete = [...selectedStudentRowIds];
                          setSelectedStudentRowIds([]);
                          await deleteMultipleStudents(idsToDelete);
                          alert('선택한 학생 계정이 삭제되었습니다.');
                        }
                      }}
                      className="h-9 px-3 bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded-2xs flex items-center gap-1 shadow-2xs transition-colors"
                    >
                      <span className="material-symbols-outlined text-sm">delete</span>
                      선택 학생 일괄 삭제
                    </button>
                    <button
                      onClick={() => setSelectedStudentRowIds([])}
                      className="h-9 px-2 text-xs text-[#1a1a1a]/60 hover:text-[#1a1a1a]"
                    >
                      선택 해제
                    </button>
                  </div>
                )}
              </div>

              <div className="overflow-x-auto max-h-[550px]">
                <table className="w-full text-left border-collapse min-w-[760px]">
                  <thead className="bg-[#faf8f5] border-b border-[#1a1a1a]/15 sticky top-0 z-10 text-[11px] font-bold uppercase tracking-wider text-[#1a1a1a]/60">
                    <tr>
                      <th className="py-3 px-3 w-12 text-center">
                        <input
                          type="checkbox"
                          aria-label="전체 학생 선택"
                          checked={
                            filteredStudents.length > 0 &&
                            filteredStudents.every(st => selectedStudentRowIds.includes(st.id))
                          }
                          onChange={e => {
                            if (e.target.checked) {
                              const allIds = filteredStudents.map(s => s.id);
                              setSelectedStudentRowIds(Array.from(new Set([...selectedStudentRowIds, ...allIds])));
                            } else {
                              const filteredIdSet = new Set(filteredStudents.map(s => s.id));
                              setSelectedStudentRowIds(selectedStudentRowIds.filter(id => !filteredIdSet.has(id)));
                            }
                          }}
                          className="rounded-2xs border-[#1a1a1a]/30 text-[#1a1a1a] focus:ring-0"
                        />
                      </th>
                      <th className="py-3 px-3 w-14 text-center">번호</th>
                      <th className="py-3 px-4 w-36">이름</th>
                      <th className="py-3 px-4 w-40">아이디</th>
                      <th className="py-3 px-4 w-48">PIN 비밀번호</th>
                      <th className="py-3 px-4 w-44 text-center">관리</th>
                    </tr>
                  </thead>
                  <tbody className="text-xs font-medium divide-y divide-[#1a1a1a]/10">
                    {filteredStudents.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-12 text-center text-[#1a1a1a]/50">
                          <p className="font-bold text-sm mb-1">등록된 학생이 없습니다.</p>
                          <p className="text-xs">상단의 '+ 학생 등록' 버튼을 눌러 학생 계정을 생성해 주세요.</p>
                        </td>
                      </tr>
                    ) : (
                      filteredStudents.map(st => {
                        const isChecked = selectedStudentRowIds.includes(st.id);
                        const displayPin = showAllPins ? (st.pin || '1234') : '••••';
                        return (
                          <tr
                            key={st.id}
                            className={`transition-colors ${isChecked ? 'bg-amber-50/60' : 'hover:bg-[#faf8f5]'}`}
                          >
                            <td className="py-3 px-3 text-center">
                              <input
                                type="checkbox"
                                aria-label={`${st.name} 선택`}
                                checked={isChecked}
                                onChange={e => {
                                  if (e.target.checked) {
                                    setSelectedStudentRowIds(prev => [...prev, st.id]);
                                  } else {
                                    setSelectedStudentRowIds(prev => prev.filter(id => id !== st.id));
                                  }
                                }}
                                className="rounded-2xs border-[#1a1a1a]/30 text-[#1a1a1a] focus:ring-0"
                              />
                            </td>
                            <td className="py-3 px-3 text-center font-mono text-[#1a1a1a]/70">{st.number}</td>
                            <td className="py-3 px-4 font-bold text-[#1a1a1a]">
                              <div className="flex items-center gap-1.5">
                                <span>{st.name}</span>
                                {(st.debt || 0) > 0 && (
                                  <span className="text-[10px] bg-rose-100 text-rose-900 border border-rose-300 font-mono font-bold px-1.5 py-0.2 rounded-2xs" title={`학급 부채 ${st.debt?.toLocaleString()}원`}>
                                    🚨 빚 {st.debt?.toLocaleString()}원
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="py-3 px-4 text-[#1a1a1a]/70 font-mono text-xs">{st.username}</td>
                            <td className="py-3 px-4">
                              {st.pinResetRequested ? (
                                <div className="flex flex-col gap-1">
                                  <div className="flex items-center gap-1 text-rose-800">
                                    <span className="font-bold text-[10px] bg-rose-100 border border-rose-200 px-1.5 py-0.5 rounded flex items-center gap-0.5">
                                      ⚠️ 재설정 요청
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-1 mt-0.5">
                                    <button
                                      onClick={() => {
                                        approvePinReset(st.id, '1234');
                                        alert(`${st.name} 학생의 PIN이 [1234]로 승인되었습니다.`);
                                      }}
                                      className="bg-emerald-700 text-white px-2 py-0.5 rounded text-[10px] font-bold hover:bg-emerald-800 shadow-2xs"
                                      title="1234로 초기화 승인"
                                    >
                                      1234 승인
                                    </button>
                                    <button
                                      onClick={() => {
                                        approvePinReset(st.id, '0000');
                                        alert(`${st.name} 학생의 PIN이 [0000]으로 승인되었습니다.`);
                                      }}
                                      className="bg-[#1a1a1a] text-white px-2 py-0.5 rounded text-[10px] font-bold hover:bg-stone-800 shadow-2xs"
                                      title="0000으로 초기화 승인"
                                    >
                                      0000 승인
                                    </button>
                                    <button
                                      onClick={() => {
                                        setTeacherPinTargetStudent(st);
                                        setTeacherPinTargetStudents([]);
                                        setIsTeacherPinModalOpen(true);
                                      }}
                                      className="bg-blue-700 text-white px-2 py-0.5 rounded text-[10px] font-bold hover:bg-blue-800 shadow-2xs"
                                      title="직접 새 PIN 지정"
                                    >
                                      직접 변경
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <div className="flex items-center gap-1.5">
                                  <span className="font-mono text-xs font-bold text-[#1a1a1a] bg-stone-100 border border-stone-200 px-2 py-0.5 rounded tracking-wider">
                                    {displayPin}
                                  </span>
                                  <span
                                    className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                                      st.isPinChanged
                                        ? 'bg-emerald-100 text-emerald-800'
                                        : 'bg-stone-100 text-stone-600'
                                    }`}
                                  >
                                    {st.isPinChanged ? '학생 변경' : '기본값'}
                                  </span>
                                  <button
                                    onClick={() => {
                                      setTeacherPinTargetStudent(st);
                                      setTeacherPinTargetStudents([]);
                                      setIsTeacherPinModalOpen(true);
                                    }}
                                    className="px-1.5 py-0.5 bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 rounded text-[10px] font-bold flex items-center gap-0.5 transition-colors"
                                    title="선생님이 PIN 직접 변경"
                                  >
                                    <span className="material-symbols-outlined text-[13px]">edit_square</span>
                                    <span>변경</span>
                                  </button>
                                </div>
                              )}
                            </td>
                            <td className="py-3 px-4 text-center">
                              <div className="flex items-center justify-center gap-1">
                                <button
                                  onClick={() => {
                                    setSelectedAnalyticsStudentId(st.id);
                                    setActiveTab('student_asset_dashboard');
                                  }}
                                  className="px-2 py-1 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 rounded-2xs text-[10px] font-bold uppercase tracking-wider text-emerald-900 flex items-center gap-0.5"
                                  title="이 학생의 자산 변동 현황 대시보드로 이동"
                                >
                                  <span className="material-symbols-outlined text-[13px]">query_stats</span>
                                  자산분석
                                </button>
                                {(st.debt || 0) > 0 && (
                                  <button
                                    onClick={async () => {
                                      const promptAmt = prompt(`${st.name} 학생의 부채 ${st.debt?.toLocaleString()}원 중 탕감(면제)할 금액을 입력하세요:`, String(st.debt));
                                      if (!promptAmt) return;
                                      const amt = parseInt(promptAmt.replace(/[^0-9]/g, ''), 10);
                                      if (amt && amt > 0) {
                                        const ok = await forgiveStudentDebt(st.id, amt);
                                        if (ok) {
                                          alert(`${st.name} 학생의 부채 ${amt.toLocaleString()}원이 탕감(면제)되었습니다.`);
                                        }
                                      }
                                    }}
                                    className="px-2 py-1 bg-rose-50 hover:bg-rose-100 border border-rose-300 rounded-2xs text-[10px] font-bold uppercase tracking-wider text-rose-900 flex items-center gap-0.5 transition-colors"
                                    title={`학급 부채 ${st.debt?.toLocaleString()}원 탕감`}
                                  >
                                    <span className="material-symbols-outlined text-[13px]">heart_check</span>
                                    부채탕감
                                  </button>
                                )}
                                <button
                                  onClick={() => {
                                    setTeacherPinTargetStudent(st);
                                    setTeacherPinTargetStudents([]);
                                    setIsTeacherPinModalOpen(true);
                                  }}
                                  className="px-2 py-1 bg-blue-50 hover:bg-blue-100 border border-blue-300 rounded-2xs text-[10px] font-bold uppercase tracking-wider text-blue-800 flex items-center gap-0.5"
                                  title="선생님이 PIN 직접 지정/변경"
                                >
                                  <span className="material-symbols-outlined text-[12px]">key</span>
                                  PIN변경
                                </button>
                                <button
                                  onClick={() => {
                                    if (confirm(`${st.name} 학생의 PIN을 1234로 초기화하시겠습니까?`)) {
                                      const res = updateStudentPinByTeacher(st.id, '1234');
                                      alert(res.message || `${st.name} 학생의 PIN이 1234로 초기화되었습니다.`);
                                    }
                                  }}
                                  className="px-2 py-1 bg-amber-50 hover:bg-amber-100 border border-amber-300 rounded-2xs text-[10px] font-bold uppercase tracking-wider text-amber-900"
                                  title="PIN을 1234로 초기화"
                                >
                                  1234초기화
                                </button>
                                <button
                                  onClick={async () => {
                                    if (confirm(`${st.name} (${st.username}) 학생 계정을 정말 삭제하시겠습니까?`)) {
                                      setSelectedStudentRowIds(prev => prev.filter(id => id !== st.id));
                                      await deleteStudent(st.id);
                                      alert(`${st.name} 학생 계정이 삭제되었습니다.`);
                                    }
                                  }}
                                  className="p-1 hover:bg-red-50 text-red-600 hover:text-red-800 border border-red-200 rounded-2xs transition-colors flex items-center justify-center"
                                  title="학생 계정 삭제"
                                >
                                  <span className="material-symbols-outlined text-[15px]">delete</span>
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: STUDENT INDIVIDUAL ASSET ANALYSIS DASHBOARD */}
        {activeTab === 'student_asset_dashboard' && (
          <TeacherStudentAssetDashboard
            initialStudentId={selectedAnalyticsStudentId}
            onSelectStudent={setSelectedAnalyticsStudentId}
          />
        )}

        {/* TAB 3: CLASSROOM SHOP & FINE / REWARD MANAGER & PURCHASE LEDGER */}
        {activeTab === 'shop_fines' && (() => {
          // Flatten all student purchases/coupons
          interface FlattenedPurchase {
            key: string;
            studentId: string;
            studentName: string;
            studentNumber: number;
            studentUsername: string;
            couponId: string;
            itemName: string;
            itemIcon: string;
            itemPrice: number;
            purchasedAt: string;
            requestedUse: boolean;
            requestedAt?: string;
            used: boolean;
            usedAt?: string;
            teacherConfirmed: boolean;
            teacherConfirmedAt?: string;
          }

          const allPurchases: FlattenedPurchase[] = (state.students || []).flatMap(st =>
            (st.couponsOwned || []).map(c => ({
              key: `${st.id}___${c.id}`,
              studentId: st.id,
              studentName: st.name,
              studentNumber: st.number,
              studentUsername: st.username,
              couponId: c.id,
              itemName: c.name,
              itemIcon: c.icon || '🎟️',
              itemPrice: c.price || 0,
              purchasedAt: c.purchasedAt || '최근',
              requestedUse: Boolean(c.requestedUse),
              requestedAt: c.requestedAt,
              used: Boolean(c.used),
              usedAt: c.usedAt,
              teacherConfirmed: Boolean(c.teacherConfirmed),
              teacherConfirmedAt: c.teacherConfirmedAt
            }))
          ).sort((a, b) => {
            // Sort unconfirmed items first, then by purchase date descending
            const aConfirmed = Boolean(a.teacherConfirmed || a.used);
            const bConfirmed = Boolean(b.teacherConfirmed || b.used);
            if (!aConfirmed && bConfirmed) return -1;
            if (aConfirmed && !bConfirmed) return 1;
            return (b.purchasedAt || '').localeCompare(a.purchasedAt || '');
          });

          // Calculate summary statistics
          const totalPurchasesCount = allPurchases.length;
          const totalPurchasesAmount = allPurchases.reduce((sum, p) => sum + p.itemPrice, 0);
          const confirmedCount = allPurchases.filter(p => p.teacherConfirmed || p.used).length;
          const unconfirmedCount = totalPurchasesCount - confirmedCount;

          // Helper for date filtering
          const now = new Date();
          const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

          const filteredPurchases = allPurchases.filter(p => {
            const isItemConfirmed = Boolean(p.teacherConfirmed || p.used);

            // Search query
            const q = purchaseSearch.trim().toLowerCase();
            if (q) {
              const matchName = (p.studentName || '').toLowerCase().includes(q);
              const matchUsername = (p.studentUsername || '').toLowerCase().includes(q);
              const matchNumber = String(p.studentNumber || '').includes(q);
              const matchItem = (p.itemName || '').toLowerCase().includes(q);
              if (!matchName && !matchUsername && !matchNumber && !matchItem) return false;
            }

            // Item Filter
            if (purchaseItemFilter !== 'all' && p.itemName !== purchaseItemFilter) {
              return false;
            }

            // Status (Confirmation) filter
            if (purchaseStatusFilter === 'confirmed' && !isItemConfirmed) return false;
            if (purchaseStatusFilter === 'unconfirmed' && isItemConfirmed) return false;

            // Date filter
            if (purchaseDateFilter === 'today') {
              if (!p.purchasedAt.startsWith(todayStr)) return false;
            } else if (purchaseDateFilter === '3days' || purchaseDateFilter === '7days') {
              const days = purchaseDateFilter === '3days' ? 3 : 7;
              const thresholdTime = now.getTime() - days * 24 * 60 * 60 * 1000;
              const parsed = new Date(p.purchasedAt.replace(' ', 'T')).getTime();
              if (!isNaN(parsed) && parsed < thresholdTime) return false;
            } else if (purchaseDateFilter === 'custom' && purchaseCustomDate) {
              if (!p.purchasedAt.startsWith(purchaseCustomDate)) return false;
            }

            return true;
          });

          // Student aggregated stats
          const studentAggregates = (state.students || []).map(st => {
            const list = st.couponsOwned || [];
            const count = list.length;
            const confirmed = list.filter(c => c.teacherConfirmed || c.used).length;
            const unconfirmed = count - confirmed;
            const spent = list.reduce((sum, c) => sum + (c.price || 0), 0);
            return {
              student: st,
              count,
              unconfirmed,
              confirmed,
              spent,
              coupons: list
            };
          }).filter(agg => {
            if (purchaseSearch.trim()) {
              const q = purchaseSearch.trim().toLowerCase();
              return (
                agg.student.name.toLowerCase().includes(q) ||
                agg.student.username.toLowerCase().includes(q) ||
                String(agg.student.number).includes(q)
              );
            }
            return true;
          });

          // Handlers for confirmation
          const handleToggleConfirm = (studentId: string, couponId: string, currentStatus: boolean) => {
            toggleCouponTeacherConfirm(studentId, couponId, !currentStatus);
            setPurchaseActionNotice(!currentStatus ? '확인 완료되었습니다. (학생 화면에서 사용 완료 처리됨)' : '확인이 취소되었습니다.');
            setTimeout(() => setPurchaseActionNotice(''), 2500);
          };

          const handleBatchConfirm = (confirmed: boolean) => {
            if (selectedPurchaseKeys.length === 0) return;
            const updates = selectedPurchaseKeys.map(key => {
              const [studentId, couponId] = key.split('___');
              return { studentId, couponId };
            });
            batchSetCouponsTeacherConfirm(updates, confirmed);
            setPurchaseActionNotice(
              confirmed
                ? `${selectedPurchaseKeys.length}건 확인 완료되었습니다. (학생 화면에서 사용 완료 처리됨)`
                : `${selectedPurchaseKeys.length}건의 확인이 취소되었습니다.`
            );
            setSelectedPurchaseKeys([]);
            setTimeout(() => setPurchaseActionNotice(''), 2500);
          };

          const exportPurchasesCSV = () => {
            if (allPurchases.length === 0) {
              alert('내보낼 구매 내역이 없습니다.');
              return;
            }
            const headers = ['구매일시', '학생번호', '학생이름', '아이디', '상품명', '결제금액(원)', '사용신청상태', '사용신청일시', '선생님승인여부', '선생님승인일시'];
            const rows = filteredPurchases.map(p => [
              `"${p.purchasedAt || ''}"`,
              p.studentNumber,
              `"${p.studentName}"`,
              `"${p.studentUsername}"`,
              `"${p.itemName}"`,
              p.itemPrice,
              `"${p.teacherConfirmed ? '승인완료(사용됨)' : p.requestedUse ? '사용 신청됨 (승인대기)' : '미신청 (보유중)'}"`,
              `"${p.requestedAt || '-'}"`,
              `"${p.teacherConfirmed ? '승인 완료' : p.requestedUse ? '승인 대기중' : '미신청'}"`,
              `"${p.teacherConfirmedAt || '-'}"`
            ]);

            const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.setAttribute('href', url);
            const dateTag = new Date().toISOString().slice(0, 10);
            link.setAttribute('download', `학급상점_구매및쿠폰확인장부_${state.classCode || 'Class'}_${dateTag}.csv`);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
          };

          // Unique item names for dropdown filter
          const existingItemNames = Array.from(
            new Set([
              ...state.shopItems.map(it => it.name),
              ...allPurchases.map(p => p.itemName)
            ])
          );

          return (
            <div className="space-y-6">
              {/* Top Section: Fine & Reward + Shop Item Manager */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Fine & Reward Manager Section */}
                <div className="bg-white rounded-sm p-6 shadow-2xs border border-[#1a1a1a]/15">
                  <h2 className="font-editorial text-xl font-bold text-[#1a1a1a] mb-4 pb-2 border-b border-[#1a1a1a]/10 flex items-center justify-between">
                    <span>상벌금 직접 부과 / 지급</span>
                    <span className="text-xs font-normal text-[#1a1a1a]/60">교사 직권 조정</span>
                  </h2>

                  {/* Target Selector */}
                  <div className="flex bg-[#faf8f5] p-1 rounded-2xs border border-[#1a1a1a]/15 mb-4">
                    <button
                      type="button"
                      onClick={() => setTargetType('individual')}
                      className={`flex-1 py-1.5 text-center rounded-2xs text-xs font-bold uppercase tracking-wider transition-all ${
                        targetType === 'individual' ? 'bg-[#1a1a1a] text-white shadow-2xs' : 'text-[#1a1a1a]/70 hover:text-[#1a1a1a]'
                      }`}
                    >
                      개인 1명
                    </button>
                    <button
                      type="button"
                      onClick={() => setTargetType('selected')}
                      className={`flex-1 py-1.5 text-center rounded-2xs text-xs font-bold uppercase tracking-wider transition-all ${
                        targetType === 'selected' ? 'bg-[#1a1a1a] text-white shadow-2xs' : 'text-[#1a1a1a]/70 hover:text-[#1a1a1a]'
                      }`}
                    >
                      선택 학생 (다중)
                    </button>
                    <button
                      type="button"
                      onClick={() => setTargetType('all')}
                      className={`flex-1 py-1.5 text-center rounded-2xs text-xs font-bold uppercase tracking-wider transition-all ${
                        targetType === 'all' ? 'bg-[#1a1a1a] text-white shadow-2xs' : 'text-[#1a1a1a]/70 hover:text-[#1a1a1a]'
                      }`}
                    >
                      반 전체 ({totalStudents}명)
                    </button>
                  </div>

                  {targetType === 'individual' && (
                    <div className="mb-4">
                      <label className="block text-xs font-bold uppercase tracking-wider text-[#1a1a1a] mb-1">대상 학생 선택</label>
                      <select
                        value={selectedStudentId}
                        onChange={e => setSelectedStudentId(e.target.value)}
                        className="w-full px-3 py-2 rounded-2xs border border-[#1a1a1a]/20 focus:border-[#1a1a1a] focus:ring-0 text-xs font-medium bg-[#faf8f5]"
                      >
                        {state.students.map(s => (
                          <option key={s.id} value={s.id}>
                            {s.number}번 {s.name} (현금: {s.cash.toLocaleString()}원)
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {targetType === 'selected' && (
                    <div className="mb-4 bg-[#faf8f5] p-3 rounded-2xs border border-[#1a1a1a]/15">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-xs font-bold uppercase tracking-wider text-[#1a1a1a]">
                          지급/부과 대상 선택 ({selectedStudentIds.length}명 선택됨)
                        </span>
                        <div className="flex gap-1.5">
                          <button
                            type="button"
                            onClick={() => setSelectedStudentIds(state.students.map(s => s.id))}
                            className="text-[10px] font-bold uppercase tracking-wider bg-white hover:bg-stone-200 border border-[#1a1a1a]/20 px-2 py-0.5 rounded-2xs text-[#1a1a1a]"
                          >
                            전체 선택
                          </button>
                          <button
                            type="button"
                            onClick={() => setSelectedStudentIds([])}
                            className="text-[10px] font-bold uppercase tracking-wider bg-white hover:bg-stone-200 border border-[#1a1a1a]/20 px-2 py-0.5 rounded-2xs text-[#1a1a1a]"
                          >
                            선택 해제
                          </button>
                        </div>
                      </div>

                      <input
                        type="text"
                        placeholder="이름 검색..."
                        value={fineStudentSearch}
                        onChange={e => setFineStudentSearch(e.target.value)}
                        className="w-full px-2.5 py-1 mb-2.5 rounded-2xs border border-[#1a1a1a]/20 text-xs bg-white focus:ring-0 focus:border-[#1a1a1a]"
                      />

                      <div className="max-h-48 overflow-y-auto grid grid-cols-2 gap-1.5 p-1 bg-white rounded-2xs border border-[#1a1a1a]/12">
                        {state.students
                          .filter(s => s.name.includes(fineStudentSearch) || s.number.toString().includes(fineStudentSearch))
                          .map(s => {
                            const isChecked = selectedStudentIds.includes(s.id);
                            return (
                              <label
                                key={s.id}
                                className={`flex items-center gap-2 px-2.5 py-1.5 rounded-2xs border cursor-pointer text-xs font-medium transition-colors ${
                                  isChecked
                                    ? 'bg-[#1a1a1a]/5 border-[#1a1a1a] font-bold text-[#1a1a1a]'
                                    : 'border-[#1a1a1a]/10 hover:bg-[#faf8f5] text-[#1a1a1a]/70'
                                }`}
                              >
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={e => {
                                    if (e.target.checked) {
                                      setSelectedStudentIds(prev => [...prev, s.id]);
                                    } else {
                                      setSelectedStudentIds(prev => prev.filter(id => id !== s.id));
                                    }
                                  }}
                                  className="w-3.5 h-3.5 rounded-2xs border-[#1a1a1a]/30 text-[#1a1a1a] focus:ring-[#1a1a1a]"
                                />
                                <span className="truncate">
                                  {s.number}번 {s.name}
                                </span>
                              </label>
                            );
                          })}
                      </div>
                    </div>
                  )}

                  <div className="space-y-4">
                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <label className="block text-xs font-bold uppercase tracking-wider text-[#1a1a1a]">
                          부과/지급 금액 (1원 단위)
                        </label>
                        <span className="text-[11px] font-mono text-[#1a1a1a]/60">
                          현재: {fineAmount.toLocaleString()}원
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setFineAmount(prev => Math.max(1, prev - 500))}
                          className="h-9 w-9 flex items-center justify-center rounded-2xs bg-[#faf8f5] border border-[#1a1a1a]/20 font-bold text-base text-[#1a1a1a] hover:bg-stone-200 transition-colors"
                        >
                          -
                        </button>
                        <input
                          type="number"
                          step="1"
                          min="1"
                          value={fineAmount}
                          onChange={e => setFineAmount(Math.max(1, parseInt(e.target.value, 10) || 1))}
                          className="flex-1 h-9 px-3 rounded-2xs border border-[#1a1a1a]/20 text-right font-mono font-bold focus:border-[#1a1a1a] focus:ring-0 bg-[#faf8f5]"
                        />
                        <span className="font-bold text-xs text-[#1a1a1a]">원</span>
                        <button
                          type="button"
                          onClick={() => setFineAmount(prev => prev + 500)}
                          className="h-9 w-9 flex items-center justify-center rounded-2xs bg-[#faf8f5] border border-[#1a1a1a]/20 font-bold text-base text-[#1a1a1a] hover:bg-stone-200 transition-colors"
                        >
                          +
                        </button>
                      </div>

                      {/* 1-Won Quick increment buttons */}
                      <div className="grid grid-cols-5 gap-1.5 mt-2">
                        {[100, 500, 1000, 5000, 10000].map(val => (
                          <button
                            key={val}
                            type="button"
                            onClick={() => setFineAmount(prev => prev + val)}
                            className="py-1 text-[11px] font-mono font-bold bg-[#faf8f5] hover:bg-stone-200 text-[#1a1a1a] border border-[#1a1a1a]/15 rounded-2xs transition-colors"
                          >
                            +{val >= 1000 ? `${val / 1000}천` : `${val}원`}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-[#1a1a1a] mb-1">사유 입력</label>
                      <input
                        type="text"
                        value={fineReason}
                        onChange={e => setFineReason(e.target.value)}
                        placeholder="예: 숙제 미제출 벌금 / 발표 우수 상금"
                        className="w-full h-9 px-3 rounded-2xs border border-[#1a1a1a]/20 text-xs font-medium focus:border-[#1a1a1a] focus:ring-0 bg-[#faf8f5]"
                      />
                    </div>

                    {/* Live Pre-Fine Impact Simulation (예상 청산 및 부채 영향 진단) */}
                    {fineImpactSimulation && (
                      <div className="p-3 bg-stone-50 border border-stone-200 rounded-2xs text-[11px] space-y-1.5">
                        <div className="flex items-center justify-between font-bold text-[#1a1a1a]">
                          <span className="flex items-center gap-1">
                            <span>🔍</span> 벌금 부과 시 예상 영향 진단
                          </span>
                          <span className="font-mono text-stone-600">
                            대상 {fineImpactSimulation.targetCount}명
                          </span>
                        </div>
                        <div className="grid grid-cols-2 gap-2 pt-1 font-mono text-[11px]">
                          <div className="bg-white p-2 rounded-2xs border border-stone-200">
                            <span className="text-[#1a1a1a]/60 block text-[10px] font-sans">현금 완납 가능</span>
                            <strong className="text-emerald-800 text-xs">{fineImpactSimulation.fullCashCount}명</strong>
                          </div>
                          <div className="bg-white p-2 rounded-2xs border border-stone-200">
                            <span className="text-[#1a1a1a]/60 block text-[10px] font-sans">저축 자동인출 필요</span>
                            <strong className="text-blue-800 text-xs">{fineImpactSimulation.savingsNeededCount}명</strong>
                          </div>
                          <div className="bg-white p-2 rounded-2xs border border-stone-200">
                            <span className="text-[#1a1a1a]/60 block text-[10px] font-sans">주식 자동매각 필요</span>
                            <strong className={fineImpactSimulation.stockLiquidationCount > 0 ? 'text-amber-800 text-xs' : 'text-stone-700 text-xs'}>
                              {fineImpactSimulation.stockLiquidationCount}명
                            </strong>
                          </div>
                          <div className="bg-white p-2 rounded-2xs border border-stone-200">
                            <span className="text-[#1a1a1a]/60 block text-[10px] font-sans">부채(빚) 발생 예상</span>
                            <strong className={fineImpactSimulation.debtIncurredCount > 0 ? 'text-rose-800 text-xs' : 'text-stone-700 text-xs'}>
                              {fineImpactSimulation.debtIncurredCount}명 {fineImpactSimulation.totalPredictedDebt > 0 ? `(+${fineImpactSimulation.totalPredictedDebt.toLocaleString()}원)` : ''}
                            </strong>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Auto-liquidation & Debt Notice */}
                    <div className="p-3 bg-amber-50/80 border border-amber-200 rounded-2xs text-[11px] text-amber-950 leading-relaxed">
                      <p className="font-bold flex items-center gap-1 text-amber-950 mb-0.5">
                        <span>💡</span> 4단계 벌금 자동 청산 & 부채(빚) 시스템
                      </p>
                      <p className="text-[#1a1a1a]/70">
                        1단계 <strong>현금 차감</strong> → 2단계 <strong>저축(예금) 자동 인출</strong> → 3단계 보유 <strong>주식 시장가 자동 매각</strong> → 4단계 미납 잔여액 <strong>학급 부채(빚)로 누적</strong>
                      </p>
                    </div>

                    <div className="flex gap-3 pt-2">
                      <button
                        onClick={() => handleApplyFine('fine')}
                        className="flex-1 h-10 rounded-2xs bg-rose-900 text-white font-bold text-xs uppercase tracking-wider hover:bg-rose-950 transition-colors shadow-2xs flex items-center justify-center gap-1"
                      >
                        <span className="material-symbols-outlined text-[16px]">gavel</span>
                        벌금 부과 (자동 청산 & 부채 누적)
                      </button>
                      <button
                        onClick={() => handleApplyFine('reward')}
                        className="flex-1 h-10 rounded-2xs bg-[#1a1a1a] text-white font-bold text-xs uppercase tracking-wider hover:bg-stone-800 transition-colors shadow-2xs flex items-center justify-center gap-1"
                      >
                        <span className="material-symbols-outlined text-[16px]">payments</span>
                        상금 지급 (부채 우선 상환)
                      </button>
                    </div>
                  </div>
                </div>

                {/* Shop Item Manager Section */}
                <div className="bg-white rounded-sm p-6 shadow-2xs border border-[#1a1a1a]/15">
                  <div className="flex justify-between items-center mb-4 pb-2 border-b border-[#1a1a1a]/10">
                    <div>
                      <h2 className="font-editorial text-xl font-bold text-[#1a1a1a]">
                        등록된 학급 상품 ({state.shopItems.length}개)
                      </h2>
                      <p className="text-xs text-[#1a1a1a]/60 mt-0.5">
                        학생들이 현금으로 구입할 수 있는 학급 쿠폰/특권 상품입니다.
                      </p>
                    </div>
                    <button
                      onClick={() => setIsAddShopOpen(true)}
                      className="px-3 py-1.5 bg-[#1a1a1a] text-white text-xs font-bold uppercase tracking-wider rounded-2xs hover:bg-stone-800 shadow-2xs flex items-center gap-1"
                    >
                      <span className="material-symbols-outlined text-sm">add_shopping_cart</span>
                      + 새 상품 등록
                    </button>
                  </div>

                  <div className="space-y-3 max-h-[360px] overflow-y-auto pr-1">
                    {state.shopItems.length === 0 ? (
                      <div className="p-8 text-center bg-[#faf8f5] rounded-2xs border border-dashed border-[#1a1a1a]/20 text-[#1a1a1a]/60">
                        <p className="text-xs font-bold mb-1">등록된 학급 상품이 없습니다.</p>
                        <p className="text-[11px]">+ 새 상품 등록 버튼을 눌러 상품을 추가하세요.</p>
                      </div>
                    ) : (
                      state.shopItems.map(item => (
                        <div
                          key={item.id}
                          className="p-3 bg-[#faf8f5] rounded-2xs border border-[#1a1a1a]/12 flex justify-between items-center hover:border-[#1a1a1a]/30 transition-colors"
                        >
                          <div className="flex items-center gap-3">
                            <span className="text-2xl w-9 h-9 rounded-full bg-white flex items-center justify-center border border-[#1a1a1a]/10 shadow-2xs">
                              {item.icon}
                            </span>
                            <div>
                              <div className="font-bold text-xs text-[#1a1a1a]">{item.name}</div>
                              <div className="text-[11px] text-[#1a1a1a]/60 line-clamp-1">{item.description}</div>
                              <div className="text-xs font-mono font-bold text-amber-900 mt-0.5">{item.price.toLocaleString()}원</div>
                            </div>
                          </div>
                          <button
                            onClick={() => {
                              if (confirm(`'${item.name}' 상품을 정말 삭제하시겠습니까?`)) {
                                deleteShopItem(item.id);
                              }
                            }}
                            className="text-rose-900 hover:bg-rose-100 px-2.5 py-1 rounded-2xs text-[11px] font-bold uppercase tracking-wider border border-rose-300 transition-colors"
                          >
                            삭제
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>

              {/* Comprehensive Student Purchase & Coupon Verification Section */}
              <div className="bg-white rounded-sm p-6 shadow-2xs border border-[#1a1a1a]/15 space-y-5">
                {/* Header & Main Actions */}
                <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-[#1a1a1a]/10">
                  <div>
                    <div className="flex items-center gap-3">
                      <h2 className="font-editorial text-2xl font-bold text-[#1a1a1a] flex items-center gap-2">
                        <span className="material-symbols-outlined text-amber-800 text-2xl">receipt_long</span>
                        학생 상품 구매 & 쿠폰 확인 장부
                      </h2>
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-900 border border-amber-300">
                        총 {totalPurchasesCount}건 구매됨
                      </span>
                    </div>
                    <p className="text-xs text-[#1a1a1a]/60 mt-1">
                      일자별로 학생들이 학급 상점에서 구입한 상품과 쿠폰 사용 내역을 조회하고, 선생님 승인(확인) 체크를 관리합니다.
                    </p>
                  </div>

                  <div className="flex items-center gap-2.5">
                    {purchaseActionNotice && (
                      <span className="text-xs font-bold text-emerald-800 bg-emerald-50 border border-emerald-300 px-3 py-1.5 rounded-2xs animate-fade-in flex items-center gap-1">
                        <span className="material-symbols-outlined text-sm">check_circle</span>
                        {purchaseActionNotice}
                      </span>
                    )}

                    <button
                      onClick={handleManualSync}
                      disabled={isSyncing}
                      className={`h-9 px-3.5 bg-stone-100 hover:bg-stone-200 border border-[#1a1a1a]/20 text-[#1a1a1a] rounded-2xs font-bold text-xs uppercase tracking-wider flex items-center gap-1.5 shadow-2xs transition-all ${
                        isSyncing ? 'opacity-60 cursor-not-allowed' : ''
                      }`}
                      title="실시간 구매 내역 새로고침"
                    >
                      <span className={`material-symbols-outlined text-base ${isSyncing ? 'animate-spin' : ''}`}>sync</span>
                      <span>{isSyncing ? '동기화 중...' : '새로고침'}</span>
                    </button>

                    <button
                      onClick={exportPurchasesCSV}
                      className="h-9 px-3.5 bg-[#1a1a1a] hover:bg-stone-800 text-white rounded-2xs font-bold text-xs uppercase tracking-wider flex items-center gap-1.5 shadow-2xs transition-all"
                      title="전체 구매 내역을 엑셀 CSV 파일로 다운로드"
                    >
                      <span className="material-symbols-outlined text-base">download</span>
                      <span>구매 장부 CSV 내보내기</span>
                    </button>
                  </div>
                </div>

                {/* 4 Bento Stat Cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="bg-[#faf8f5] p-3.5 rounded-2xs border border-[#1a1a1a]/12 shadow-2xs">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#1a1a1a]/50 block mb-0.5">총 구매 내역</span>
                    <div className="flex items-baseline gap-1.5">
                      <span className="font-editorial text-2xl font-bold text-[#1a1a1a]">{totalPurchasesCount}</span>
                      <span className="text-xs text-[#1a1a1a]/60">건</span>
                    </div>
                    <div className="text-[11px] font-mono text-[#1a1a1a]/70 mt-1">
                      총 {totalPurchasesAmount.toLocaleString()}원 결제
                    </div>
                  </div>

                  <div className={`p-3.5 rounded-2xs border shadow-2xs ${
                    unconfirmedCount > 0
                      ? 'bg-amber-50/90 border-amber-400 text-amber-950'
                      : 'bg-[#faf8f5] border-[#1a1a1a]/12 text-[#1a1a1a]'
                  }`}>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-amber-900/80 block mb-0.5">선생님 확인 대기 (사용 비활성화)</span>
                    <div className="flex items-baseline gap-1.5">
                      <span className="font-editorial text-2xl font-bold text-amber-900">{unconfirmedCount}</span>
                      <span className="text-xs text-amber-900/70">건 대기중</span>
                    </div>
                    <div className="text-[11px] font-bold text-amber-900 mt-1">
                      {unconfirmedCount > 0 ? '⏳ 교사 확인 대기 (확인 시 사용 완료)' : '✓ 모든 구매 확인 완료'}
                    </div>
                  </div>

                  <div className="bg-[#faf8f5] p-3.5 rounded-2xs border border-[#1a1a1a]/12 shadow-2xs">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#1a1a1a]/50 block mb-0.5">선생님 확인 완료 (사용 완료됨)</span>
                    <div className="flex items-baseline gap-1.5">
                      <span className="font-editorial text-2xl font-bold text-emerald-800">{confirmedCount}</span>
                      <span className="text-xs text-[#1a1a1a]/60">건 완료</span>
                    </div>
                    <div className="text-[11px] text-emerald-700 mt-1">
                      선생님 확인으로 사용 완료 처리됨
                    </div>
                  </div>

                  <div className="bg-[#faf8f5] p-3.5 rounded-2xs border border-[#1a1a1a]/12 shadow-2xs">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#1a1a1a]/50 block mb-0.5">확인 진행률</span>
                    <div className="flex items-baseline gap-1.5">
                      <span className="font-editorial text-2xl font-bold text-stone-700">
                        {totalPurchasesCount > 0 ? Math.round((confirmedCount / totalPurchasesCount) * 100) : 100}%
                      </span>
                      <span className="text-xs text-[#1a1a1a]/60">완료율</span>
                    </div>
                    <div className="text-[11px] text-stone-600 mt-1">
                      {confirmedCount} / {totalPurchasesCount}건 완료
                    </div>
                  </div>
                </div>

                {/* View Switcher & Filters */}
                <div className="space-y-3 bg-[#faf8f5] p-3.5 rounded-2xs border border-[#1a1a1a]/12">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    {/* View mode toggle */}
                    <div className="flex bg-white p-1 rounded-2xs border border-[#1a1a1a]/15">
                      <button
                        type="button"
                        onClick={() => setPurchaseViewMode('list')}
                        className={`px-3 py-1 rounded-2xs text-xs font-bold flex items-center gap-1.5 transition-all ${
                          purchaseViewMode === 'list'
                            ? 'bg-[#1a1a1a] text-white shadow-2xs'
                            : 'text-[#1a1a1a]/70 hover:text-[#1a1a1a]'
                        }`}
                      >
                        <span className="material-symbols-outlined text-sm">view_list</span>
                        일자별 전체 구매 및 확인 목록 ({filteredPurchases.length})
                      </button>
                      <button
                        type="button"
                        onClick={() => setPurchaseViewMode('by_student')}
                        className={`px-3 py-1 rounded-2xs text-xs font-bold flex items-center gap-1.5 transition-all ${
                          purchaseViewMode === 'by_student'
                            ? 'bg-[#1a1a1a] text-white shadow-2xs'
                            : 'text-[#1a1a1a]/70 hover:text-[#1a1a1a]'
                        }`}
                      >
                        <span className="material-symbols-outlined text-sm">group</span>
                        학생별 구매 집계 요약 ({studentAggregates.length})
                      </button>
                    </div>

                    {/* Quick date filter pills */}
                    <div className="flex flex-wrap items-center gap-1.5 text-xs">
                      <span className="font-bold text-[#1a1a1a]/60 mr-1 text-[11px] uppercase tracking-wider">기간:</span>
                      {[
                        { id: 'all', label: '전체' },
                        { id: 'today', label: '오늘' },
                        { id: '3days', label: '최근 3일' },
                        { id: '7days', label: '최근 7일' },
                        { id: 'custom', label: '직접 지정' }
                      ].map(df => (
                        <button
                          key={df.id}
                          type="button"
                          onClick={() => setPurchaseDateFilter(df.id as any)}
                          className={`px-2.5 py-1 rounded-2xs font-bold text-xs transition-all ${
                            purchaseDateFilter === df.id
                              ? 'bg-[#1a1a1a] text-white shadow-2xs'
                              : 'bg-white border border-[#1a1a1a]/15 text-[#1a1a1a]/70 hover:bg-stone-100'
                          }`}
                        >
                          {df.label}
                        </button>
                      ))}

                      {purchaseDateFilter === 'custom' && (
                        <input
                          type="date"
                          value={purchaseCustomDate}
                          onChange={e => setPurchaseCustomDate(e.target.value)}
                          className="h-8 px-2 py-0.5 rounded-2xs border border-[#1a1a1a]/20 text-xs bg-white focus:ring-0 focus:border-[#1a1a1a]"
                        />
                      )}
                    </div>
                  </div>

                  {/* Secondary filter bar: search + dropdowns */}
                  <div className="flex flex-wrap items-center gap-2.5 pt-1">
                    {/* Search box */}
                    <div className="relative flex-1 min-w-[220px]">
                      <input
                        type="text"
                        placeholder="학생 이름, 번호, 아이디 또는 상품명 검색..."
                        value={purchaseSearch}
                        onChange={e => setPurchaseSearch(e.target.value)}
                        className="w-full h-8 pl-8 pr-3 rounded-2xs border border-[#1a1a1a]/20 text-xs bg-white focus:border-[#1a1a1a] focus:ring-0"
                      />
                      <span className="material-symbols-outlined absolute left-2.5 top-2 text-sm text-[#1a1a1a]/40">search</span>
                      {purchaseSearch && (
                        <button
                          onClick={() => setPurchaseSearch('')}
                          className="absolute right-2.5 top-2 text-xs text-[#1a1a1a]/50 hover:text-[#1a1a1a]"
                        >
                          ✕
                        </button>
                      )}
                    </div>

                    {/* Item dropdown filter */}
                    <select
                      value={purchaseItemFilter}
                      onChange={e => setPurchaseItemFilter(e.target.value)}
                      className="h-8 px-2.5 rounded-2xs border border-[#1a1a1a]/20 text-xs bg-white font-medium focus:ring-0 focus:border-[#1a1a1a]"
                    >
                      <option value="all">전체 상품 ({existingItemNames.length}종)</option>
                      {existingItemNames.map(name => (
                        <option key={name} value={name}>
                          {name}
                        </option>
                      ))}
                    </select>

                    {/* Confirmation status dropdown */}
                    <select
                      value={purchaseStatusFilter}
                      onChange={e => setPurchaseStatusFilter(e.target.value as any)}
                      className="h-8 px-2.5 rounded-2xs border border-[#1a1a1a]/20 text-xs bg-white font-medium focus:ring-0 focus:border-[#1a1a1a]"
                    >
                      <option value="all">선생님 확인 상태 (전체 {totalPurchasesCount}건)</option>
                      <option value="unconfirmed">⏳ 확인 대기 ({unconfirmedCount}건 - 학생 사용버튼 비활성화)</option>
                      <option value="confirmed">✅ 확인 완료 ({confirmedCount}건 - 사용 완료됨)</option>
                    </select>

                    {(purchaseSearch || purchaseItemFilter !== 'all' || purchaseStatusFilter !== 'all' || purchaseDateFilter !== 'all') && (
                      <button
                        onClick={() => {
                          setPurchaseSearch('');
                          setPurchaseItemFilter('all');
                          setPurchaseStatusFilter('all');
                          setPurchaseDateFilter('all');
                          setPurchaseCustomDate('');
                        }}
                        className="text-xs text-[#1a1a1a]/60 hover:text-[#1a1a1a] underline ml-1"
                      >
                        필터 초기화
                      </button>
                    )}
                  </div>

                  {/* Batch Action Bar */}
                  {selectedPurchaseKeys.length > 0 && (
                    <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-[#1a1a1a]/10 animate-in fade-in">
                      <span className="text-xs font-bold text-blue-900 bg-blue-50 border border-blue-200 px-2.5 py-1 rounded-2xs">
                        {selectedPurchaseKeys.length}건 선택됨
                      </span>
                      <button
                        onClick={() => handleBatchConfirm(true)}
                        className="h-8 px-3 bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs rounded-2xs flex items-center gap-1 shadow-2xs transition-colors"
                        title="선택한 상품의 확인을 완료하여 '사용 완료' 처리합니다"
                      >
                        <span className="material-symbols-outlined text-sm">check_circle</span>
                        선택 항목 일괄 확인 완료 (사용 완료 처리)
                      </button>
                      <button
                        onClick={() => handleBatchConfirm(false)}
                        className="h-8 px-3 bg-stone-700 hover:bg-stone-800 text-white font-bold text-xs rounded-2xs flex items-center gap-1 shadow-2xs transition-colors"
                        title="선택한 상품의 확인을 취소합니다"
                      >
                        <span className="material-symbols-outlined text-sm">undo</span>
                        선택 항목 확인 취소
                      </button>
                      <button
                        onClick={() => setSelectedPurchaseKeys([])}
                        className="h-8 px-2 text-xs text-[#1a1a1a]/60 hover:text-[#1a1a1a]"
                      >
                        선택 해제
                      </button>
                    </div>
                  )}
                </div>

                {/* View 1: Detailed Purchase List Table */}
                {purchaseViewMode === 'list' && (
                  <div className="overflow-x-auto rounded-sm border border-[#1a1a1a]/15 max-h-[540px]">
                    <table className="w-full text-left border-collapse min-w-[880px]">
                      <thead className="bg-[#faf8f5] border-b border-[#1a1a1a]/15 sticky top-0 z-10 text-[11px] font-bold uppercase tracking-wider text-[#1a1a1a]/70">
                        <tr>
                          <th className="py-3 px-3 w-12 text-center">
                            <input
                              type="checkbox"
                              aria-label="전체 구매 내역 선택"
                              checked={
                                filteredPurchases.length > 0 &&
                                filteredPurchases.every(p => selectedPurchaseKeys.includes(p.key))
                              }
                              onChange={e => {
                                if (e.target.checked) {
                                  const allKeys = filteredPurchases.map(p => p.key);
                                  setSelectedPurchaseKeys(Array.from(new Set([...selectedPurchaseKeys, ...allKeys])));
                                } else {
                                  const filteredKeySet = new Set(filteredPurchases.map(p => p.key));
                                  setSelectedPurchaseKeys(selectedPurchaseKeys.filter(k => !filteredKeySet.has(k)));
                                }
                              }}
                              className="rounded-2xs border-[#1a1a1a]/30 text-[#1a1a1a] focus:ring-0"
                            />
                          </th>
                          <th className="py-3 px-3 w-40">날짜 (구매일 / 확인일)</th>
                          <th className="py-3 px-4 w-44">학생 이름 (번호)</th>
                          <th className="py-3 px-4 w-52">구입 상품명 & 가격</th>
                          <th className="py-3 px-4 w-48 text-center">쿠폰 사용 갯수 / 상태</th>
                          <th className="py-3 px-4 w-52 text-center">선생님 확인 (체크 시 사용 완료)</th>
                        </tr>
                      </thead>
                      <tbody className="text-xs font-medium divide-y divide-[#1a1a1a]/10">
                        {filteredPurchases.length === 0 ? (
                          <tr>
                            <td colSpan={6} className="py-12 text-center text-[#1a1a1a]/50">
                              <span className="material-symbols-outlined text-4xl text-[#1a1a1a]/30 mb-2 block">
                                shopping_bag
                              </span>
                              <p className="font-bold text-sm text-[#1a1a1a]/80 mb-1">
                                {totalPurchasesCount === 0
                                  ? '아직 학생들이 구입한 상점 상품이 없습니다.'
                                  : '검색 조건과 일치하는 구매 내역이 없습니다.'}
                              </p>
                              <p className="text-xs">
                                {totalPurchasesCount === 0
                                  ? '학생들이 로그인하여 상점에서 쿠폰을 구입하면 이곳에 실시간으로 기록됩니다.'
                                  : '상단의 검색어나 필터 설정을 변경해 보세요.'}
                              </p>
                            </td>
                          </tr>
                        ) : (
                          filteredPurchases.map(p => {
                            const isSelected = selectedPurchaseKeys.includes(p.key);
                            const isConfirmed = Boolean(p.teacherConfirmed || p.used);
                            const isUnconfirmed = !isConfirmed;

                            return (
                              <tr
                                key={p.key}
                                className={`transition-colors ${
                                  isSelected
                                    ? 'bg-blue-50/70'
                                    : isUnconfirmed
                                    ? 'bg-amber-50/50 hover:bg-amber-100/50'
                                    : 'hover:bg-stone-50'
                                }`}
                              >
                                <td className="py-3 px-3 text-center">
                                  <input
                                    type="checkbox"
                                    checked={isSelected}
                                    onChange={e => {
                                      if (e.target.checked) {
                                        setSelectedPurchaseKeys(prev => [...prev, p.key]);
                                      } else {
                                        setSelectedPurchaseKeys(prev => prev.filter(k => k !== p.key));
                                      }
                                    }}
                                    className="rounded-2xs border-[#1a1a1a]/30 text-[#1a1a1a] focus:ring-0"
                                  />
                                </td>

                                {/* 날짜 */}
                                <td className="py-3 px-3">
                                  <div className="font-mono text-xs font-bold text-[#1a1a1a]">
                                    {p.purchasedAt}
                                  </div>
                                  {isConfirmed && p.teacherConfirmedAt && (
                                    <div className="text-[10px] text-emerald-700 flex items-center gap-1 mt-0.5 font-medium">
                                      <span className="material-symbols-outlined text-[12px]">done_all</span>
                                      <span>확인: {p.teacherConfirmedAt}</span>
                                    </div>
                                  )}
                                  {isUnconfirmed && (
                                    <div className="text-[10px] text-amber-900 flex items-center gap-1 mt-0.5 font-medium">
                                      <span className="material-symbols-outlined text-[12px]">lock_clock</span>
                                      <span>교사 확인 대기 (비활성화)</span>
                                    </div>
                                  )}
                                </td>

                                {/* 학생 이름 */}
                                <td className="py-3 px-4">
                                  <div className="flex items-center gap-2">
                                    <span className="w-6 h-6 rounded-full bg-stone-100 border border-stone-200 text-stone-700 text-[10px] font-bold flex items-center justify-center font-mono">
                                      {p.studentNumber}
                                    </span>
                                    <div>
                                      <div className="font-bold text-[#1a1a1a]">{p.studentName}</div>
                                      <div className="text-[10px] font-mono text-[#1a1a1a]/50">@{p.studentUsername}</div>
                                    </div>
                                  </div>
                                </td>

                                {/* 상품명 & 가격 */}
                                <td className="py-3 px-4">
                                  <div className="flex items-center gap-2">
                                    <span className="text-xl">{p.itemIcon}</span>
                                    <div>
                                      <div className="font-bold text-[#1a1a1a]">{p.itemName}</div>
                                      <div className="font-mono text-[11px] text-amber-900 font-bold">
                                        {p.itemPrice.toLocaleString()}원 결제
                                      </div>
                                    </div>
                                  </div>
                                </td>

                                {/* 쿠폰 사용 갯수 / 상태 */}
                                <td className="py-3 px-4 text-center">
                                  {isConfirmed ? (
                                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-900 border border-emerald-300">
                                      <span className="material-symbols-outlined text-[13px]">check_circle</span>
                                      확인 및 사용 완료 (1개)
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-900 border border-amber-300 animate-pulse">
                                      <span className="material-symbols-outlined text-[13px]">lock_clock</span>
                                      확인 대기 (사용 비활성화)
                                    </span>
                                  )}
                                </td>

                                {/* 선생님 확인 (체크 및 사용 완료 처리) */}
                                <td className="py-3 px-4 text-center">
                                  <div className="flex items-center justify-center gap-2">
                                    <button
                                      type="button"
                                      onClick={() => handleToggleConfirm(p.studentId, p.couponId, isConfirmed)}
                                      className={`px-3 py-1.5 rounded-2xs text-xs font-bold flex items-center gap-1.5 transition-all shadow-2xs ${
                                        isConfirmed
                                          ? 'bg-emerald-700 hover:bg-emerald-800 text-white'
                                          : 'bg-amber-500 hover:bg-amber-600 text-white ring-2 ring-amber-300'
                                      }`}
                                      title={
                                        isConfirmed
                                          ? '확인 완료를 취소하고 다시 확인 대기 상태로 변경합니다'
                                          : '선생님이 확인을 완료하면 학생 화면에서 자동으로 사용 완료 처리됩니다'
                                      }
                                    >
                                      <input
                                        type="checkbox"
                                        checked={isConfirmed}
                                        onChange={() => {}} // handled by button onClick
                                        className="w-3.5 h-3.5 rounded-2xs border-[#1a1a1a]/30 pointer-events-none"
                                      />
                                      <span>
                                        {isConfirmed
                                          ? '✓ 확인 완료 (사용됨)'
                                          : '확인하기 (사용 완료 처리)'}
                                      </span>
                                    </button>
                                  </div>
                                  {isConfirmed && p.teacherConfirmedAt && (
                                    <div className="text-[10px] text-emerald-800 font-mono mt-1">
                                      ✓ {p.teacherConfirmedAt} 확인
                                    </div>
                                  )}
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* View 2: Student Aggregated Summary Table */}
                {purchaseViewMode === 'by_student' && (
                  <div className="overflow-x-auto rounded-sm border border-[#1a1a1a]/15 max-h-[540px]">
                    <table className="w-full text-left border-collapse min-w-[760px]">
                      <thead className="bg-[#faf8f5] border-b border-[#1a1a1a]/15 sticky top-0 z-10 text-[11px] font-bold uppercase tracking-wider text-[#1a1a1a]/70">
                        <tr>
                          <th className="py-3 px-4 w-16 text-center">번호</th>
                          <th className="py-3 px-4 w-44">학생 성명</th>
                          <th className="py-3 px-4 w-28 text-center">총 구매 수</th>
                          <th className="py-3 px-4 w-32 text-center">확인 대기 (비활성화)</th>
                          <th className="py-3 px-4 w-32 text-center">확인 완료 (사용됨)</th>
                          <th className="py-3 px-4 w-40 text-center">선생님 확인 현황</th>
                          <th className="py-3 px-4 w-36 text-right">총 결제 금액</th>
                        </tr>
                      </thead>
                      <tbody className="text-xs font-medium divide-y divide-[#1a1a1a]/10">
                        {studentAggregates.length === 0 ? (
                          <tr>
                            <td colSpan={7} className="py-12 text-center text-[#1a1a1a]/50">
                              등록된 학생이 없습니다.
                            </td>
                          </tr>
                        ) : (
                          studentAggregates.map(agg => (
                            <tr key={agg.student.id} className="hover:bg-stone-50 transition-colors">
                              <td className="py-3 px-4 text-center font-mono font-bold text-stone-600">
                                {agg.student.number}
                              </td>
                              <td className="py-3 px-4">
                                <div className="font-bold text-[#1a1a1a]">{agg.student.name}</div>
                                <div className="text-[10px] font-mono text-[#1a1a1a]/50">@{agg.student.username}</div>
                              </td>
                              <td className="py-3 px-4 text-center font-mono font-bold text-[#1a1a1a]">
                                {agg.count}개
                              </td>
                              <td className="py-3 px-4 text-center">
                                {agg.unconfirmed > 0 ? (
                                  <span className="font-mono font-bold text-amber-900 bg-amber-100 px-2.5 py-0.5 rounded-full">
                                    {agg.unconfirmed}개 대기
                                  </span>
                                ) : (
                                  <span className="font-mono text-stone-400">0</span>
                                )}
                              </td>
                              <td className="py-3 px-4 text-center">
                                <span className="font-mono font-bold text-emerald-800">{agg.confirmed}개 완료</span>
                              </td>
                              <td className="py-3 px-4 text-center">
                                {agg.count === 0 ? (
                                  <span className="text-[11px] text-[#1a1a1a]/40">-</span>
                                ) : agg.unconfirmed > 0 ? (
                                  <span className="px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-900 font-bold text-[11px] animate-pulse">
                                    {agg.unconfirmed}건 확인 대기 ({agg.confirmed}/{agg.count})
                                  </span>
                                ) : (
                                  <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-900 font-bold text-[11px]">
                                    전체 확인완료 ({agg.confirmed}/{agg.count})
                                  </span>
                                )}
                              </td>
                              <td className="py-3 px-4 text-right font-mono font-bold text-amber-900">
                                {agg.spent.toLocaleString()}원
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          );
        })()}

        {/* TAB 4: FULL LEADERBOARD */}
        {activeTab === 'leaderboard' && (() => {
          const rankedStudents = state.students
            .map(s => {
              const stockVal = Math.round(state.stocks.reduce((sum, st) => sum + (s.stockShares[st.id] || 0) * st.currentPrice, 0));
              const debt = Math.max(0, s.debt || 0);
              const total = Math.round(s.cash + s.savings + stockVal - debt);
              return {
                ...s,
                stockValue: stockVal,
                totalAssets: total
              };
            })
            .sort((a, b) => b.totalAssets - a.totalAssets);

          const filteredLeaderboard = (rankedStudents || []).filter((s, idx) => {
            if (!s) return false;
            const query = leaderboardSearch.trim().toLowerCase();
            const sName = String(s.name || '').toLowerCase();
            const sUsername = String(s.username || '').toLowerCase();
            const sNumber = String(s.number ?? '');

            const matchesSearch =
              !query ||
              sName.includes(query) ||
              sUsername.includes(query) ||
              sNumber.includes(query);

            if (!matchesSearch) return false;
            if (leaderboardFilter === 'top3') return idx < 3;
            if (leaderboardFilter === 'top10') return idx < 10;
            return true;
          });

          const totalClassAssets = rankedStudents.reduce((sum, s) => sum + s.totalAssets, 0);
          const avgClassAssets = rankedStudents.length > 0 ? Math.round(totalClassAssets / rankedStudents.length) : 0;
          const topStudent = rankedStudents[0];
          const stockInvestorCount = rankedStudents.filter(s => s.stockValue > 0).length;

          return (
            <div className="space-y-6">
              {/* Header & Controls */}
              <div className="bg-white rounded-sm p-6 shadow-2xs border border-[#1a1a1a]/15">
                <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-[#1a1a1a]/10">
                  <div>
                    <div className="flex items-center gap-3">
                      <h2 className="font-editorial text-2xl font-bold text-[#1a1a1a]">
                        실시간 학급 전체 자산 순위 리더보드
                      </h2>
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-900 border border-emerald-300">
                        <span className="w-2 h-2 rounded-full bg-emerald-600 animate-pulse"></span>
                        클라우드 실시간 동기화
                      </span>
                    </div>
                    <p className="text-xs text-[#1a1a1a]/60 mt-1">
                      현재 Round {state.currentRound} 기준 모든 학생의 현금, 저축 예금, 주식 평가액 및 종합 자산 순위입니다.
                    </p>
                  </div>

                  <div className="flex items-center gap-3">
                    <button
                      onClick={handleManualSync}
                      disabled={isSyncing}
                      className={`h-10 px-4 bg-[#1a1a1a] hover:bg-stone-800 text-white rounded-2xs font-bold text-xs uppercase tracking-wider flex items-center gap-2 shadow-2xs transition-all ${
                        isSyncing ? 'opacity-70 cursor-not-allowed' : 'btn-press'
                      }`}
                    >
                      <span className={`material-symbols-outlined text-[18px] text-amber-300 ${isSyncing ? 'animate-spin' : ''}`}>
                        sync
                      </span>
                      <span>{isSyncing ? '자산 동기화 중...' : '실시간 자산 동기화'}</span>
                    </button>

                    <button
                      onClick={exportToExcel}
                      className="h-10 px-4 bg-white hover:bg-stone-50 border border-[#1a1a1a]/20 text-[#1a1a1a] rounded-2xs font-bold text-xs uppercase tracking-wider flex items-center gap-1.5 shadow-2xs transition-all btn-press"
                    >
                      <span className="material-symbols-outlined text-[18px]">download</span>
                      <span>CSV 내보내기</span>
                    </button>
                  </div>
                </div>

                {/* Sub-header status bar */}
                <div className="flex flex-wrap items-center justify-between gap-3 pt-3 text-xs text-[#1a1a1a]/70 font-medium">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[16px] text-emerald-700">schedule</span>
                    <span>마지막 동기화 시각: <strong className="text-[#1a1a1a] font-mono">{formatSyncTime(lastSyncedAt)}</strong></span>
                    {syncNotice && (
                      <span className="ml-2 text-emerald-800 bg-emerald-50 border border-emerald-300 px-2 py-0.5 rounded-2xs font-bold text-[11px] animate-fade-in">
                        ✓ {syncNotice}
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-[#1a1a1a]/50">
                    * 학생들의 주식 매매, 저축 입출금, 송금 내역이 실시간으로 반영됩니다.
                  </div>
                </div>
              </div>

              {/* Leaderboard Public / Private Status Banner & Toggle */}
              <div className={`p-4 sm:p-5 rounded-sm border transition-all flex flex-wrap items-center justify-between gap-4 shadow-2xs ${
                state.isLeaderboardPublic !== false
                  ? 'bg-emerald-50/80 border-emerald-300 text-emerald-950'
                  : 'bg-amber-50/90 border-amber-300 text-amber-950'
              }`}>
                <div className="flex items-start gap-3.5 max-w-2xl">
                  <div className={`w-10 h-10 rounded-2xs flex items-center justify-center text-xl shrink-0 shadow-2xs border ${
                    state.isLeaderboardPublic !== false
                      ? 'bg-emerald-100 text-emerald-900 border-emerald-300'
                      : 'bg-amber-100 text-amber-900 border-amber-300'
                  }`}>
                    {state.isLeaderboardPublic !== false ? '👀' : '🔒'}
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-bold text-sm sm:text-base">
                        {state.isLeaderboardPublic !== false
                          ? '현재 학급 랭킹: 전체 학생 공개 중'
                          : '현재 학급 랭킹: 학생 비공개 모드 (선생님만 열람 가능)'}
                      </h3>
                      <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
                        state.isLeaderboardPublic !== false
                          ? 'bg-emerald-200 text-emerald-900 border border-emerald-400'
                          : 'bg-amber-200 text-amber-900 border border-amber-400'
                      }`}>
                        {state.isLeaderboardPublic !== false ? '학생 화면 노출' : '학생 화면 숨김'}
                      </span>
                    </div>
                    <p className="text-xs text-[#1a1a1a]/70 mt-1 leading-relaxed">
                      {state.isLeaderboardPublic !== false
                        ? '모든 학생이 학생 대시보드에서 실시간 학급 순위와 친구들의 총 자산 순위를 확인할 수 있습니다.'
                        : '학생 화면에서 랭킹 탭과 순위 뱃지가 숨겨집니다. 과열된 자산 비교를 방지하고 각자의 금융 습관 학습에 집중하도록 돕습니다.'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={toggleLeaderboardPublic}
                    className={`h-10 px-4 rounded-2xs font-bold text-xs uppercase tracking-wider flex items-center gap-2 shadow-2xs transition-all btn-press ${
                      state.isLeaderboardPublic !== false
                        ? 'bg-amber-700 hover:bg-amber-800 text-white'
                        : 'bg-emerald-700 hover:bg-emerald-800 text-white'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[18px]">
                      {state.isLeaderboardPublic !== false ? 'visibility_off' : 'visibility'}
                    </span>
                    <span>{state.isLeaderboardPublic !== false ? '랭킹 비공개로 전환' : '전체 공개로 전환'}</span>
                  </button>
                </div>
              </div>

              {/* Top 3 Podium Showcase */}
              {rankedStudents.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* 1st Place */}
                  {rankedStudents[0] && (
                    <div className="bg-gradient-to-b from-amber-50 to-white rounded-sm p-5 shadow-2xs border-2 border-amber-400 relative overflow-hidden order-1 md:order-2">
                      <div className="absolute top-2 right-3 text-2xl">👑</div>
                      <div className="flex items-center gap-2 mb-2">
                        <span className="bg-amber-400 text-stone-950 font-black text-xs px-2 py-0.5 rounded-2xs uppercase tracking-wider">
                          1위 (Gold)
                        </span>
                        <span className="text-xs font-mono text-stone-500">{rankedStudents[0].number}번</span>
                      </div>
                      <h3 className="font-editorial text-xl font-bold text-stone-900 mb-1">
                        {rankedStudents[0].name}
                      </h3>
                      <div className="font-mono text-2xl font-bold text-stone-900 mb-3">
                        {rankedStudents[0].totalAssets.toLocaleString()}<span className="text-sm font-sans font-normal ml-0.5">원</span>
                      </div>
                      <div className="grid grid-cols-3 gap-1.5 text-[11px] bg-amber-100/60 p-2 rounded-2xs border border-amber-300/40 text-center font-mono">
                        <div>
                          <div className="text-stone-500 text-[10px]">현금</div>
                          <div className="font-bold text-stone-800">{rankedStudents[0].cash.toLocaleString()}</div>
                        </div>
                        <div>
                          <div className="text-stone-500 text-[10px]">예금</div>
                          <div className="font-bold text-emerald-900">{rankedStudents[0].savings.toLocaleString()}</div>
                        </div>
                        <div>
                          <div className="text-stone-500 text-[10px]">주식</div>
                          <div className="font-bold text-blue-900">{rankedStudents[0].stockValue.toLocaleString()}</div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* 2nd Place */}
                  {rankedStudents[1] && (
                    <div className="bg-gradient-to-b from-stone-100 to-white rounded-sm p-5 shadow-2xs border border-stone-300 relative overflow-hidden order-2 md:order-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="bg-stone-300 text-stone-900 font-bold text-xs px-2 py-0.5 rounded-2xs uppercase tracking-wider">
                          2위 (Silver)
                        </span>
                        <span className="text-xs font-mono text-stone-500">{rankedStudents[1].number}번</span>
                      </div>
                      <h3 className="font-editorial text-lg font-bold text-stone-900 mb-1">
                        {rankedStudents[1].name}
                      </h3>
                      <div className="font-mono text-xl font-bold text-stone-900 mb-3">
                        {rankedStudents[1].totalAssets.toLocaleString()}<span className="text-sm font-sans font-normal ml-0.5">원</span>
                      </div>
                      <div className="grid grid-cols-3 gap-1.5 text-[11px] bg-stone-100 p-2 rounded-2xs border border-stone-200 text-center font-mono">
                        <div>
                          <div className="text-stone-500 text-[10px]">현금</div>
                          <div className="font-bold text-stone-800">{rankedStudents[1].cash.toLocaleString()}</div>
                        </div>
                        <div>
                          <div className="text-stone-500 text-[10px]">예금</div>
                          <div className="font-bold text-emerald-900">{rankedStudents[1].savings.toLocaleString()}</div>
                        </div>
                        <div>
                          <div className="text-stone-500 text-[10px]">주식</div>
                          <div className="font-bold text-blue-900">{rankedStudents[1].stockValue.toLocaleString()}</div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* 3rd Place */}
                  {rankedStudents[2] && (
                    <div className="bg-gradient-to-b from-orange-50 to-white rounded-sm p-5 shadow-2xs border border-orange-200 relative overflow-hidden order-3">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="bg-orange-300 text-orange-950 font-bold text-xs px-2 py-0.5 rounded-2xs uppercase tracking-wider">
                          3위 (Bronze)
                        </span>
                        <span className="text-xs font-mono text-stone-500">{rankedStudents[2].number}번</span>
                      </div>
                      <h3 className="font-editorial text-lg font-bold text-stone-900 mb-1">
                        {rankedStudents[2].name}
                      </h3>
                      <div className="font-mono text-xl font-bold text-stone-900 mb-3">
                        {rankedStudents[2].totalAssets.toLocaleString()}<span className="text-sm font-sans font-normal ml-0.5">원</span>
                      </div>
                      <div className="grid grid-cols-3 gap-1.5 text-[11px] bg-orange-100/50 p-2 rounded-2xs border border-orange-200/50 text-center font-mono">
                        <div>
                          <div className="text-stone-500 text-[10px]">현금</div>
                          <div className="font-bold text-stone-800">{rankedStudents[2].cash.toLocaleString()}</div>
                        </div>
                        <div>
                          <div className="text-stone-500 text-[10px]">예금</div>
                          <div className="font-bold text-emerald-900">{rankedStudents[2].savings.toLocaleString()}</div>
                        </div>
                        <div>
                          <div className="text-stone-500 text-[10px]">주식</div>
                          <div className="font-bold text-blue-900">{rankedStudents[2].stockValue.toLocaleString()}</div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Search & Filter Bar */}
              <div className="bg-white rounded-sm p-4 shadow-2xs border border-[#1a1a1a]/15 flex flex-wrap items-center justify-between gap-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-[#1a1a1a]/60 mr-1">필터:</span>
                  <button
                    onClick={() => setLeaderboardFilter('all')}
                    className={`px-3 py-1.5 rounded-2xs text-xs font-bold uppercase tracking-wider transition-all ${
                      leaderboardFilter === 'all'
                        ? 'bg-[#1a1a1a] text-white shadow-2xs'
                        : 'bg-[#faf8f5] text-[#1a1a1a]/70 hover:bg-stone-200 border border-[#1a1a1a]/15'
                    }`}
                  >
                    전체 ({rankedStudents.length}명)
                  </button>
                  <button
                    onClick={() => setLeaderboardFilter('top3')}
                    className={`px-3 py-1.5 rounded-2xs text-xs font-bold uppercase tracking-wider transition-all ${
                      leaderboardFilter === 'top3'
                        ? 'bg-amber-800 text-white shadow-2xs'
                        : 'bg-[#faf8f5] text-[#1a1a1a]/70 hover:bg-stone-200 border border-[#1a1a1a]/15'
                    }`}
                  >
                    TOP 3
                  </button>
                  <button
                    onClick={() => setLeaderboardFilter('top10')}
                    className={`px-3 py-1.5 rounded-2xs text-xs font-bold uppercase tracking-wider transition-all ${
                      leaderboardFilter === 'top10'
                        ? 'bg-[#1a1a1a] text-white shadow-2xs'
                        : 'bg-[#faf8f5] text-[#1a1a1a]/70 hover:bg-stone-200 border border-[#1a1a1a]/15'
                    }`}
                  >
                    TOP 10
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <div className="relative">
                    <span className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-stone-400 text-[18px]">
                      search
                    </span>
                    <input
                      type="text"
                      placeholder="학생 이름 / 번호 검색..."
                      value={leaderboardSearch}
                      onChange={e => setLeaderboardSearch(e.target.value)}
                      className="pl-8 pr-3 py-1.5 bg-[#faf8f5] border border-[#1a1a1a]/20 rounded-2xs text-xs font-medium focus:border-[#1a1a1a] focus:ring-0 w-48 md:w-60"
                    />
                  </div>
                  {leaderboardSearch && (
                    <button
                      onClick={() => setLeaderboardSearch('')}
                      className="text-xs font-bold text-[#1a1a1a]/60 hover:text-[#1a1a1a] underline"
                    >
                      초기화
                    </button>
                  )}
                </div>
              </div>

              {/* Leaderboard Table */}
              <div className="bg-white rounded-sm shadow-2xs border border-[#1a1a1a]/15 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse min-w-[700px]">
                    <thead className="bg-[#faf8f5] border-b border-[#1a1a1a]/15 text-[11px] font-bold uppercase tracking-wider text-[#1a1a1a]/60">
                      <tr>
                        <th className="py-3 px-4 w-16 text-center">순위</th>
                        <th className="py-3 px-4">학생 성명</th>
                        <th className="py-3 px-4 text-right">보유 현금</th>
                        <th className="py-3 px-4 text-right">은행 예금</th>
                        <th className="py-3 px-4 text-right">주식 평가액</th>
                        <th className="py-3 px-4 text-right">총 자산 평가액</th>
                        <th className="py-3 px-4 text-center w-36">자산 구성비</th>
                        <th className="py-3 px-4 text-center">최근 활동</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#1a1a1a]/10 text-xs font-medium">
                      {filteredLeaderboard.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="py-12 text-center text-[#1a1a1a]/50">
                            검색 및 필터 조건에 부합하는 학생이 없습니다.
                          </td>
                        </tr>
                      ) : (
                        filteredLeaderboard.map((s, idx) => {
                          const cashPct = s.totalAssets > 0 ? Math.round((s.cash / s.totalAssets) * 100) : 0;
                          const savingsPct = s.totalAssets > 0 ? Math.round((s.savings / s.totalAssets) * 100) : 0;
                          const stockPct = s.totalAssets > 0 ? Math.max(0, 100 - cashPct - savingsPct) : 0;
                          const rank = rankedStudents.findIndex(item => item.id === s.id) + 1;

                          return (
                            <tr key={s.id} className="hover:bg-[#faf8f5] transition-colors">
                              <td className="py-3.5 px-4 text-center font-editorial font-bold text-sm text-[#1a1a1a]">
                                {rank === 1 ? '🥇 1' : rank === 2 ? '🥈 2' : rank === 3 ? '🥉 3' : rank}
                              </td>
                              <td className="py-3.5 px-4">
                                <div className="font-bold text-[#1a1a1a] flex items-center gap-1.5">
                                  <span>{s.name}</span>
                                  <span className="text-[11px] font-mono text-[#1a1a1a]/50">({s.number}번)</span>
                                </div>
                                <div className="text-[10px] font-mono text-[#1a1a1a]/40">@{s.username}</div>
                              </td>
                              <td className="py-3.5 px-4 text-right font-mono font-medium text-stone-800">
                                {s.cash.toLocaleString()}원
                              </td>
                              <td className="py-3.5 px-4 text-right font-mono font-bold text-emerald-900">
                                {s.savings.toLocaleString()}원
                              </td>
                              <td className="py-3.5 px-4 text-right font-mono font-medium text-blue-900">
                                {s.stockValue.toLocaleString()}원
                              </td>
                              <td className="py-3.5 px-4 text-right font-mono font-bold text-base text-[#1a1a1a]">
                                <div>{s.totalAssets.toLocaleString()}<span className="text-xs font-normal font-sans ml-0.5">원</span></div>
                                {(s.debt || 0) > 0 && (
                                  <div className="text-[10px] text-rose-800 font-mono font-bold mt-0.5">
                                    부채 -{(s.debt || 0).toLocaleString()}원
                                  </div>
                                )}
                              </td>
                              <td className="py-3.5 px-4 text-center">
                                <div className="w-full bg-stone-200 rounded-2xs h-2 overflow-hidden flex border border-[#1a1a1a]/10">
                                  <div style={{ width: `${cashPct}%` }} className="bg-stone-800 h-full" title={`현금: ${cashPct}%`}></div>
                                  <div style={{ width: `${savingsPct}%` }} className="bg-emerald-600 h-full" title={`예금: ${savingsPct}%`}></div>
                                  <div style={{ width: `${stockPct}%` }} className="bg-blue-600 h-full" title={`주식: ${stockPct}%`}></div>
                                </div>
                                <div className="flex justify-between text-[9px] font-mono text-[#1a1a1a]/50 mt-1">
                                  <span>현{cashPct}%</span>
                                  <span>예{savingsPct}%</span>
                                  <span>주{stockPct}%</span>
                                </div>
                              </td>
                              <td className="py-3.5 px-4 text-center text-[11px] text-[#1a1a1a]/70">
                                <div>{s.recentActivity || '-'}</div>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSelectedAnalyticsStudentId(s.id);
                                    setActiveTab('student_asset_dashboard');
                                  }}
                                  className="mt-1 px-2 py-0.5 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 rounded-2xs text-[10px] font-bold text-emerald-900 inline-flex items-center gap-0.5 transition-colors"
                                  title="이 학생의 자산 변동 현황 대시보드로 이동"
                                >
                                  <span className="material-symbols-outlined text-[12px]">query_stats</span>
                                  <span>자산 분석</span>
                                </button>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Table Footer Stats Summary */}
                <div className="p-4 bg-[#faf8f5] border-t border-[#1a1a1a]/15 grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
                  <div>
                    <div className="text-[10px] text-[#1a1a1a]/60 uppercase tracking-wider font-semibold">학급 총 자산</div>
                    <div className="font-mono font-bold text-[#1a1a1a] text-sm">{totalClassAssets.toLocaleString()}원</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-[#1a1a1a]/60 uppercase tracking-wider font-semibold">1인당 평균 자산</div>
                    <div className="font-mono font-bold text-emerald-900 text-sm">{avgClassAssets.toLocaleString()}원</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-[#1a1a1a]/60 uppercase tracking-wider font-semibold">최고 자산 학생</div>
                    <div className="font-bold text-[#1a1a1a] text-sm">
                      {topStudent ? `${topStudent.name} (${topStudent.totalAssets.toLocaleString()}원)` : '-'}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] text-[#1a1a1a]/60 uppercase tracking-wider font-semibold">주식 투자 참여 학생</div>
                    <div className="font-bold text-blue-900 text-sm">
                      {stockInvestorCount}명 / {rankedStudents.length}명 ({rankedStudents.length > 0 ? Math.round((stockInvestorCount / rankedStudents.length) * 100) : 0}%)
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })()}

        {/* TAB 5: STUDENT ASSET CHANGE HISTORY & TRANSACTION LEDGER */}
        {activeTab === 'asset_history' && (() => {
          // Filter transactions
          const studentMap = new Map<string, Student>(state.students.map(s => [s.id, s]));
          
          let filteredTx = [...state.transactions].sort((a, b) => {
            return (b.id || '').localeCompare(a.id || '');
          });

          if (assetHistoryStudentFilter !== 'all') {
            filteredTx = filteredTx.filter(t => t.studentId === assetHistoryStudentFilter);
          }

          if (assetHistoryCategoryFilter !== 'all') {
            filteredTx = filteredTx.filter(t => {
              const type = t.type || '';
              if (assetHistoryCategoryFilter === 'savings') return type.includes('savings');
              if (assetHistoryCategoryFilter === 'stocks') return type.includes('stock');
              if (assetHistoryCategoryFilter === 'shop') return type.includes('shop') || type.includes('buy');
              if (assetHistoryCategoryFilter === 'transfer') return type.includes('transfer');
              if (assetHistoryCategoryFilter === 'reward_fine') return type.includes('reward') || type.includes('fine') || type.includes('salary');
              return true;
            });
          }

          if (assetHistorySearch.trim()) {
            const query = assetHistorySearch.toLowerCase().trim();
            filteredTx = filteredTx.filter(t => {
              const student = studentMap.get(t.studentId);
              const studentName = student ? student.name.toLowerCase() : '';
              const desc = (t.description || '').toLowerCase();
              const amountStr = String(t.amount);
              return studentName.includes(query) || desc.includes(query) || amountStr.includes(query);
            });
          }

          // Statistics calculations
          const totalCount = filteredTx.length;
          const totalVolume = filteredTx.reduce((sum, t) => sum + Math.abs(t.amount || 0), 0);
          const totalPlus = filteredTx.filter(t => (t.amount || 0) > 0).reduce((sum, t) => sum + t.amount, 0);
          const totalMinus = filteredTx.filter(t => (t.amount || 0) < 0).reduce((sum, t) => sum + Math.abs(t.amount), 0);

          const exportHistoryToCsv = () => {
            const header = '번호,학생명,학번,일시,구분,내용,금액(원)\n';
            const rows = filteredTx.map((t, idx) => {
              const student = studentMap.get(t.studentId);
              const sName = student ? student.name : '알수없음';
              const sNum = student ? student.number : '-';
              const cleanDesc = (t.description || '').replace(/,/g, ' ');
              return `${idx + 1},${sName},${sNum}번,${t.timestamp || '-'},${t.type || '거래'},"${cleanDesc}",${t.amount || 0}`;
            }).join('\n');

            const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + header + rows;
            const encodedUri = encodeURI(csvContent);
            const link = document.createElement('a');
            link.setAttribute('href', encodedUri);
            link.setAttribute('download', `학급_자산변동내역_${state.className || '학급'}_Round${state.currentRound}.csv`);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
          };

          return (
            <div className="flex flex-col gap-6">
              {/* Header & Controls */}
              <div className="bg-white rounded-sm p-6 shadow-2xs border border-[#1a1a1a]/15 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                  <h2 className="font-editorial text-xl font-bold text-[#1a1a1a] flex items-center gap-2">
                    <span className="material-symbols-outlined text-2xl">receipt_long</span>
                    학급 전체 학생 자산 변동 현황표 (거래 원장)
                  </h2>
                  <p className="text-xs text-[#1a1a1a]/60 mt-1">
                    학생들의 저축 입출금, 주식 매수/매도, 상점 구매, 송금, 보상/벌금 내역을 실시간으로 추적하고 검토합니다.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    disabled={isDeletingTx || filteredTx.length === 0}
                    onClick={async () => {
                      if (
                        confirm(
                          `현재 화면에 조회된 ${filteredTx.length}건의 자산 변동 내역을 모두 삭제하시겠습니까?\n삭제된 내역은 복구할 수 없습니다.`
                        )
                      ) {
                        setIsDeletingTx(true);
                        const ids = filteredTx.map(t => t.id).filter(Boolean);
                        setSelectedTxRowIds([]);
                        const ok = await deleteMultipleTransactions(ids);
                        setIsDeletingTx(false);
                        if (ok) {
                          alert(`${ids.length}건의 자산 변동 내역이 삭제되었습니다.`);
                        }
                      }
                    }}
                    className="h-10 px-3 bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-200 rounded-2xs font-bold text-xs flex items-center gap-1.5 transition-all shadow-2xs btn-press disabled:opacity-40"
                    title="현재 조회/필터된 내역 일괄 삭제"
                  >
                    <span className="material-symbols-outlined text-[18px]">delete_sweep</span>
                    <span>조회 내역 삭제 ({filteredTx.length}건)</span>
                  </button>

                  <button
                    type="button"
                    disabled={isDeletingTx || state.transactions.length === 0}
                    onClick={async () => {
                      if (
                        confirm(
                          `학급 전체의 모든 자산 변동 내역(${state.transactions.length}건)을 초기화(영구 삭제)하시겠습니까?\n\n※ 학생들의 현재 잔고는 유지되며, 지난 거래 기록만 완전히 비워집니다.`
                        )
                      ) {
                        setIsDeletingTx(true);
                        setSelectedTxRowIds([]);
                        const ok = await clearAllTransactions();
                        setIsDeletingTx(false);
                        if (ok) {
                          alert('모든 자산 변동 내역이 초기화되었습니다.');
                        }
                      }
                    }}
                    className="h-10 px-3 bg-stone-100 hover:bg-stone-200 text-stone-700 border border-stone-300 rounded-2xs font-bold text-xs flex items-center gap-1.5 transition-all shadow-2xs btn-press disabled:opacity-40"
                    title="전체 자산 변동 원장 비우기"
                  >
                    <span className="material-symbols-outlined text-[18px]">cleaning_services</span>
                    <span>전체 원장 비우기</span>
                  </button>

                  <button
                    type="button"
                    onClick={exportHistoryToCsv}
                    className="h-10 px-4 bg-emerald-800 hover:bg-emerald-900 text-white rounded-2xs font-bold text-xs flex items-center gap-2 transition-all shadow-2xs btn-press shrink-0"
                  >
                    <span className="material-symbols-outlined text-[18px]">download</span>
                    <span>원장 CSV 엑셀 다운로드</span>
                  </button>
                </div>
              </div>

              {/* Metrics Summary Row */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="bg-white rounded-sm p-4 border border-[#1a1a1a]/15 shadow-2xs">
                  <div className="text-[10px] uppercase font-bold text-[#1a1a1a]/50 tracking-wider">조회된 거래 건수</div>
                  <div className="font-mono font-bold text-xl text-[#1a1a1a] mt-1">{totalCount.toLocaleString()}건</div>
                </div>
                <div className="bg-white rounded-sm p-4 border border-[#1a1a1a]/15 shadow-2xs">
                  <div className="text-[10px] uppercase font-bold text-[#1a1a1a]/50 tracking-wider">총 거래 규모</div>
                  <div className="font-mono font-bold text-xl text-[#1a1a1a] mt-1">{totalVolume.toLocaleString()}원</div>
                </div>
                <div className="bg-white rounded-sm p-4 border border-[#1a1a1a]/15 shadow-2xs">
                  <div className="text-[10px] uppercase font-bold text-emerald-800 tracking-wider">자산 유입/지급 합계 (+)</div>
                  <div className="font-mono font-bold text-xl text-emerald-900 mt-1">+{totalPlus.toLocaleString()}원</div>
                </div>
                <div className="bg-white rounded-sm p-4 border border-[#1a1a1a]/15 shadow-2xs">
                  <div className="text-[10px] uppercase font-bold text-rose-800 tracking-wider">자산 지출/회수 합계 (-)</div>
                  <div className="font-mono font-bold text-xl text-rose-900 mt-1">-{totalMinus.toLocaleString()}원</div>
                </div>
              </div>

              {/* Filters Bar */}
              <div className="bg-white rounded-sm p-4 border border-[#1a1a1a]/15 shadow-2xs flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-3">
                  {/* Student Select */}
                  <div className="flex items-center gap-2">
                    <label className="text-xs font-bold text-[#1a1a1a] shrink-0">학생 선택:</label>
                    <select
                      value={assetHistoryStudentFilter}
                      onChange={e => setAssetHistoryStudentFilter(e.target.value)}
                      className="h-9 px-3 bg-[#faf8f5] border border-[#1a1a1a]/20 rounded-2xs text-xs font-bold text-[#1a1a1a] focus:outline-none focus:border-[#1a1a1a]"
                    >
                      <option value="all">전체 학생 ({state.students.length}명)</option>
                      {state.students.map(s => (
                        <option key={s.id} value={s.id}>
                          {s.number}번 {s.name} (@{s.username})
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Category Filter */}
                  <div className="flex items-center gap-2">
                    <label className="text-xs font-bold text-[#1a1a1a] shrink-0">거래 분류:</label>
                    <select
                      value={assetHistoryCategoryFilter}
                      onChange={e => setAssetHistoryCategoryFilter(e.target.value)}
                      className="h-9 px-3 bg-[#faf8f5] border border-[#1a1a1a]/20 rounded-2xs text-xs font-bold text-[#1a1a1a] focus:outline-none focus:border-[#1a1a1a]"
                    >
                      <option value="all">전체 거래</option>
                      <option value="savings">저축 입출금</option>
                      <option value="stocks">주식 매매</option>
                      <option value="shop">상점 결제</option>
                      <option value="transfer">학생간 송금</option>
                      <option value="reward_fine">보상 · 벌금 · 기본급</option>
                    </select>
                  </div>
                </div>

                {/* Search Bar */}
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <div className="relative flex-1 sm:w-64">
                    <span className="material-symbols-outlined absolute left-2.5 top-2 text-[#1a1a1a]/40 text-[18px]">
                      search
                    </span>
                    <input
                      type="text"
                      value={assetHistorySearch}
                      onChange={e => setAssetHistorySearch(e.target.value)}
                      placeholder="내용, 학생명, 금액 검색..."
                      className="w-full h-9 pl-9 pr-3 bg-[#faf8f5] border border-[#1a1a1a]/20 rounded-2xs text-xs font-medium focus:outline-none focus:border-[#1a1a1a]"
                    />
                  </div>
                  {assetHistorySearch && (
                    <button
                      type="button"
                      onClick={() => setAssetHistorySearch('')}
                      className="h-9 px-2.5 bg-stone-200 text-stone-700 rounded-2xs text-xs font-bold hover:bg-stone-300"
                    >
                      초기화
                    </button>
                  )}
                </div>
              </div>

              {/* Selected Items Action Bar */}
              {selectedTxRowIds.length > 0 && (
                <div className="bg-amber-50 border border-amber-300 rounded-sm p-3.5 flex flex-wrap items-center justify-between gap-3 text-xs shadow-2xs animate-in fade-in duration-150">
                  <div className="flex items-center gap-2 text-amber-950 font-bold">
                    <span className="material-symbols-outlined text-amber-800 text-[20px]">check_box</span>
                    <span>
                      선택한 자산 변동 내역: <span className="underline font-mono text-sm">{selectedTxRowIds.length}</span>건
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setSelectedTxRowIds([])}
                      className="px-3 py-1.5 bg-white hover:bg-stone-100 text-stone-700 border border-stone-300 rounded-2xs font-bold text-xs transition-colors"
                    >
                      선택 해제
                    </button>
                    <button
                      type="button"
                      disabled={isDeletingTx}
                      onClick={async () => {
                        if (
                          confirm(
                            `선택한 ${selectedTxRowIds.length}건의 자산 변동 내역을 영구 삭제하시겠습니까?\n삭제된 내역은 복구할 수 없습니다.`
                          )
                        ) {
                          setIsDeletingTx(true);
                          const toDelete = [...selectedTxRowIds];
                          setSelectedTxRowIds([]);
                          const ok = await deleteMultipleTransactions(toDelete);
                          setIsDeletingTx(false);
                          if (ok) {
                            alert('선택한 자산 변동 내역이 삭제되었습니다.');
                          }
                        }
                      }}
                      className="px-3.5 py-1.5 bg-rose-700 hover:bg-rose-800 text-white rounded-2xs font-bold text-xs flex items-center gap-1.5 shadow-2xs btn-press"
                    >
                      <span className="material-symbols-outlined text-[16px]">delete</span>
                      <span>선택한 {selectedTxRowIds.length}건 삭제</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Transactions Ledger Table */}
              <div className="bg-white rounded-sm border border-[#1a1a1a]/15 shadow-2xs overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-[#faf8f5] border-b border-[#1a1a1a]/15 text-[#1a1a1a] font-bold text-[11px] uppercase tracking-wider">
                        <th className="py-3 px-3 w-10 text-center">
                          <input
                            type="checkbox"
                            checked={filteredTx.length > 0 && filteredTx.every(t => selectedTxRowIds.includes(t.id))}
                            onChange={(e) => {
                              if (e.target.checked) {
                                const allIds = Array.from(new Set([...selectedTxRowIds, ...filteredTx.map(t => t.id).filter(Boolean)]));
                                setSelectedTxRowIds(allIds);
                              } else {
                                const filteredSet = new Set(filteredTx.map(t => t.id));
                                setSelectedTxRowIds(prev => prev.filter(id => !filteredSet.has(id)));
                              }
                            }}
                            className="rounded-2xs border-stone-300 text-[#1a1a1a] focus:ring-0 w-4 h-4 cursor-pointer"
                            title="현재 조회 목록 전체 선택/해제"
                          />
                        </th>
                        <th className="py-3 px-3 w-12 text-center">No</th>
                        <th className="py-3 px-4 w-28">일시</th>
                        <th className="py-3 px-4 w-36">학생 정보</th>
                        <th className="py-3 px-4 w-24 text-center">분류</th>
                        <th className="py-3 px-4">거래 상세 내역</th>
                        <th className="py-3 px-4 text-right w-36">변동 금액</th>
                        <th className="py-3 px-3 text-center w-16">삭제</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#1a1a1a]/10 font-sans">
                      {filteredTx.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="py-12 text-center text-[#1a1a1a]/50">
                            <span className="material-symbols-outlined text-3xl mb-1 block">receipt</span>
                            해당 조건에 일치하는 자산 변동 내역이 없습니다.
                          </td>
                        </tr>
                      ) : (
                        filteredTx.map((t, idx) => {
                          const student = studentMap.get(t.studentId);
                          const isPositive = (t.amount || 0) > 0;
                          const isZero = (t.amount || 0) === 0;

                          // Categorize badge
                          const type = t.type || '';
                          let badgeBg = 'bg-stone-100 text-stone-800 border-stone-300';
                          let badgeText = '일반';

                          if (type.includes('savings')) {
                            badgeBg = 'bg-emerald-50 text-emerald-900 border-emerald-300';
                            badgeText = '저축';
                          } else if (type.includes('stock')) {
                            badgeBg = 'bg-blue-50 text-blue-900 border-blue-300';
                            badgeText = '주식';
                          } else if (type.includes('shop') || type.includes('buy')) {
                            badgeBg = 'bg-purple-50 text-purple-900 border-purple-300';
                            badgeText = '상점';
                          } else if (type.includes('transfer')) {
                            badgeBg = 'bg-amber-50 text-amber-900 border-amber-300';
                            badgeText = '송금';
                          } else if (type.includes('reward') || type.includes('salary')) {
                            badgeBg = 'bg-teal-50 text-teal-900 border-teal-300';
                            badgeText = '보상/급여';
                          } else if (type.includes('fine') || type.includes('tax')) {
                            badgeBg = 'bg-rose-50 text-rose-900 border-rose-300';
                            badgeText = '벌금/세금';
                          }

                          return (
                            <tr
                              key={t.id || idx}
                              className={`hover:bg-[#faf8f5]/60 transition-colors ${
                                selectedTxRowIds.includes(t.id) ? 'bg-amber-50/50' : ''
                              }`}
                            >
                              <td className="py-3 px-3 text-center">
                                <input
                                  type="checkbox"
                                  checked={selectedTxRowIds.includes(t.id)}
                                  onChange={(e) => {
                                    if (e.target.checked) {
                                      setSelectedTxRowIds(prev => [...prev, t.id]);
                                    } else {
                                      setSelectedTxRowIds(prev => prev.filter(id => id !== t.id));
                                    }
                                  }}
                                  className="rounded-2xs border-stone-300 text-[#1a1a1a] focus:ring-0 w-4 h-4 cursor-pointer"
                                />
                              </td>
                              <td className="py-3 px-3 text-center font-mono text-[#1a1a1a]/50 text-[11px]">
                                {idx + 1}
                              </td>
                              <td className="py-3 px-4 font-mono text-[11px] text-[#1a1a1a]/70 whitespace-nowrap">
                                {t.timestamp || '-'}
                              </td>
                              <td className="py-3 px-4 whitespace-nowrap">
                                {student ? (
                                  <div>
                                    <span className="font-bold text-[#1a1a1a]">{student.name}</span>
                                    <span className="ml-1 text-[11px] font-mono text-[#1a1a1a]/50">
                                      ({student.number}번)
                                    </span>
                                  </div>
                                ) : (
                                  <span className="text-[#1a1a1a]/40">{t.studentName || '미지정 학생'}</span>
                                )}
                              </td>
                              <td className="py-3 px-4 text-center whitespace-nowrap">
                                <span className={`inline-block px-2 py-0.5 rounded-2xs text-[10px] font-bold border ${badgeBg}`}>
                                  {badgeText}
                                </span>
                              </td>
                              <td className="py-3 px-4">
                                <div className="font-medium text-[#1a1a1a] leading-snug">
                                  {t.description || '-'}
                                </div>
                              </td>
                              <td className="py-3 px-4 text-right whitespace-nowrap">
                                <span
                                  className={`font-mono font-bold text-sm ${
                                    isZero
                                      ? 'text-[#1a1a1a]/70'
                                      : isPositive
                                      ? 'text-emerald-800'
                                      : 'text-rose-800'
                                  }`}
                                >
                                  {isPositive ? '+' : ''}
                                  {(t.amount || 0).toLocaleString()}원
                                </span>
                              </td>
                              <td className="py-3 px-3 text-center whitespace-nowrap">
                                <button
                                  type="button"
                                  onClick={async () => {
                                    const sName = student ? student.name : t.studentName || '학생';
                                    if (
                                      confirm(
                                        `${sName}의 해당 자산 변동 내역("${t.description || '-'}", ${(t.amount || 0).toLocaleString()}원)을 삭제하시겠습니까?`
                                      )
                                    ) {
                                      setSelectedTxRowIds(prev => prev.filter(id => id !== t.id));
                                      await deleteTransaction(t.id);
                                      alert('해당 자산 변동 내역이 삭제되었습니다.');
                                    }
                                  }}
                                  className="p-1.5 text-stone-400 hover:text-rose-700 hover:bg-rose-50 rounded-2xs transition-colors"
                                  title="이 내역 삭제"
                                >
                                  <span className="material-symbols-outlined text-[18px]">delete</span>
                                </button>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          );
        })()}
      </main>

      {/* Modals */}
      <SettlementModal
        isOpen={isSettlementOpen}
        onClose={() => setIsSettlementOpen(false)}
        pendingDepositRate={depositRate}
        pendingStockPrices={stockPrices}
        pendingNewsMessage={newsInput.trim()}
      />
      <BulkStudentModal isOpen={isBulkStudentOpen} onClose={() => setIsBulkStudentOpen(false)} />
      <AddShopItemModal isOpen={isAddShopOpen} onClose={() => setIsAddShopOpen(false)} />

      {/* App Sharing, Copyright & Contact Inquiry Modal */}
      {isMigrationModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#1a1a1a]/50 backdrop-blur-2xs p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-sm max-w-xl w-full p-6 shadow-2xl border border-[#1a1a1a]/15 max-h-[90vh] overflow-y-auto relative">
            <button
              onClick={() => setIsMigrationModalOpen(false)}
              className="absolute top-4 right-4 text-[#1a1a1a]/50 hover:text-[#1a1a1a] w-8 h-8 flex items-center justify-center rounded-2xs hover:bg-[#faf8f5]"
            >
              <span className="material-symbols-outlined text-[18px]">close</span>
            </button>

            <div className="flex items-center gap-3 mb-4 pb-3 border-b border-[#1a1a1a]/10">
              <div className="w-10 h-10 rounded-2xs bg-amber-100 border border-amber-300 flex items-center justify-center text-xl text-amber-900">
                <span className="material-symbols-outlined text-[22px]">mail</span>
              </div>
              <div>
                <h3 className="font-editorial text-xl font-bold text-[#1a1a1a]">
                  앱 공유 및 상세 문의 안내
                </h3>
                <p className="text-xs text-[#1a1a1a]/70">
                  우리 반 학생 초대 링크 및 서비스 이용·도입 문의를 확인하실 수 있습니다.
                </p>
              </div>
            </div>

            <div className="space-y-4 text-xs leading-relaxed text-[#1a1a1a]/90">
              {/* Student Invite Link */}
              <div className="p-4 bg-indigo-50/80 rounded-2xs border border-indigo-300">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
                  <span className="font-bold text-sm text-indigo-950 flex items-center gap-1.5">
                    <span>🎒</span> 우리 반 학생 전용 초대 링크 (학급 코드 자동 입력)
                  </span>
                  <button
                    type="button"
                    onClick={handleCopyInviteUrl}
                    className="px-3 py-1.5 bg-indigo-700 hover:bg-indigo-800 text-white rounded-2xs font-bold text-xs shadow-2xs flex items-center gap-1"
                  >
                    <span className="material-symbols-outlined text-sm">content_copy</span>
                    {inviteCopied ? '✓ 복사 완료' : '학생 초대 링크 복사'}
                  </button>
                </div>
                <code className="block p-2 bg-white border border-indigo-200 rounded-2xs text-[11px] font-mono text-indigo-950 select-all break-all">
                  {studentInviteUrl}
                </code>
              </div>

              {/* Simple Service URL Share */}
              <div className="p-4 bg-emerald-50/80 rounded-2xs border border-emerald-300 space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-bold text-sm text-emerald-950">
                    👩‍🏫 동료 선생님 이용 안내 (학급 데이터 자동 분리)
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      const baseUrl = typeof window !== 'undefined' ? `${window.location.origin}${window.location.pathname}` : '';
                      const guideMsg = `[키즈리치 학급 경제 앱 안내]\n1. 접속 주소: ${baseUrl}\n2. 첫 화면에서 [교사 전용] -> [교사 회원가입]으로 본인 학급을 개설해 주세요.\n3. 상세 문의: riolavie0516@naver.com`;
                      navigator.clipboard.writeText(guideMsg);
                      setGuideTextCopied(true);
                      setTimeout(() => setGuideTextCopied(false), 2500);
                    }}
                    className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-2xs font-bold text-xs shadow-2xs flex items-center gap-1"
                  >
                    <span className="material-symbols-outlined text-sm">content_copy</span>
                    {guideTextCopied ? '✓ 안내문 복사됨' : '이용 안내문 복사'}
                  </button>
                </div>
                <p className="text-[11px] text-emerald-900">
                  현재 웹사이트 주소에서 선생님별로 고유 학급 코드를 발급받아 독립적으로 학급 경제를 운영할 수 있습니다.
                </p>
              </div>

              {/* Copyright & Contact Email Card */}
              <div className="p-4 bg-[#faf8f5] rounded-2xs border border-[#1a1a1a]/20 space-y-2.5">
                <div className="flex items-center gap-1.5 font-bold text-sm text-[#1a1a1a]">
                  <span className="material-symbols-outlined text-[18px]">copyright</span>
                  <span>저작권 안내 및 상세 문의</span>
                </div>
                <p className="text-[11px] text-[#1a1a1a]/75 leading-relaxed">
                  본 서비스의 소스 코드, 디자인 및 운영 구조에 대한 저작권은 제작자에게 있으며 무단 복제·재배포·임의 호스팅을 금지합니다.<br />
                  별도 도입, 학교 단위 운영, 계정 발급 및 기타 상세 문의는 아래 이메일로 연락해 주세요.
                </p>
                <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 bg-white border border-[#1a1a1a]/15 rounded-2xs">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-bold text-[#1a1a1a]/60">상세 문의 이메일</span>
                    <a
                      href="mailto:riolavie0516@naver.com"
                      className="font-mono font-bold text-xs text-[#005da7] hover:underline select-all"
                    >
                      riolavie0516@naver.com
                    </a>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText('riolavie0516@naver.com');
                      setContactEmailCopied(true);
                      setTimeout(() => setContactEmailCopied(false), 2500);
                    }}
                    className="px-2.5 py-1 bg-[#1a1a1a] hover:bg-stone-800 text-white rounded-2xs font-bold text-[11px] flex items-center gap-1"
                  >
                    <span className="material-symbols-outlined text-[13px]">content_copy</span>
                    {contactEmailCopied ? '✓ 복사됨' : '이메일 복사'}
                  </button>
                </div>
              </div>
            </div>

            <div className="mt-5 pt-3 border-t border-[#1a1a1a]/15 flex justify-end">
              <button
                onClick={() => setIsMigrationModalOpen(false)}
                className="px-5 py-2 bg-[#1a1a1a] text-white rounded-2xs font-bold text-xs uppercase tracking-wider hover:bg-stone-800 shadow-2xs"
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Stock Modal */}
      {isAddStockOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#1a1a1a]/40 backdrop-blur-2xs p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-sm max-w-md w-full p-6 shadow-2xl border border-[#1a1a1a]/15 relative">
            <button
              onClick={() => setIsAddStockOpen(false)}
              className="absolute top-4 right-4 text-[#1a1a1a]/50 hover:text-[#1a1a1a] w-8 h-8 flex items-center justify-center rounded-2xs hover:bg-[#faf8f5]"
            >
              <span className="material-symbols-outlined text-[18px]">close</span>
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-2xs bg-[#faf8f5] border border-[#1a1a1a]/15 flex items-center justify-center font-bold text-xl text-[#1a1a1a]">
                📈
              </div>
              <div>
                <h3 className="font-editorial text-xl font-bold text-[#1a1a1a]">새 주식 종목 추가</h3>
                <p className="text-[11px] text-[#1a1a1a]/60">증권 시장에 신규 상장할 종목을 등록합니다 (최대 {MAX_STOCKS}개)</p>
              </div>
            </div>

            <form onSubmit={handleAddStock} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-[#1a1a1a] mb-1">
                  종목명 *
                </label>
                <input
                  type="text"
                  required
                  placeholder="예: 미래기술주, 그린에너지, 우주항공 등"
                  value={newStockName}
                  onChange={e => setNewStockName(e.target.value)}
                  className="w-full px-3 py-2 bg-[#faf8f5] border border-[#1a1a1a]/20 rounded-2xs text-xs text-[#1a1a1a] focus:border-[#1a1a1a] focus:ring-0"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-[#1a1a1a] mb-1">
                  카테고리/섹터
                </label>
                <input
                  type="text"
                  placeholder="예: IT/기술주, 친환경, 테마주 (선택)"
                  value={newStockCategory}
                  onChange={e => setNewStockCategory(e.target.value)}
                  className="w-full px-3 py-2 bg-[#faf8f5] border border-[#1a1a1a]/20 rounded-2xs text-xs text-[#1a1a1a] focus:border-[#1a1a1a] focus:ring-0"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-[#1a1a1a] mb-1">
                  초기 상장 기준 주가 (원) *
                </label>
                <input
                  type="number"
                  required
                  step="100"
                  min="100"
                  value={newStockPrice}
                  onChange={e => setNewStockPrice(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-[#faf8f5] border border-[#1a1a1a]/20 rounded-2xs font-mono font-bold text-xs text-[#1a1a1a] focus:border-[#1a1a1a] focus:ring-0"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddStockOpen(false)}
                  className="flex-1 py-2.5 rounded-2xs font-bold text-xs uppercase tracking-wider text-[#1a1a1a]/70 hover:bg-[#faf8f5] transition-colors border border-[#1a1a1a]/15"
                >
                  취소
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-2xs font-bold text-xs uppercase tracking-wider bg-[#1a1a1a] hover:bg-stone-800 text-white transition-all shadow-2xs btn-press flex items-center justify-center gap-1"
                >
                  <span className="material-symbols-outlined text-[16px]">add_circle</span>
                  종목 추가 등록
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Teacher Student PIN Modal */}
      <TeacherStudentPinModal
        isOpen={isTeacherPinModalOpen}
        student={teacherPinTargetStudent}
        targetStudents={teacherPinTargetStudents}
        onClose={() => {
          setIsTeacherPinModalOpen(false);
          setTeacherPinTargetStudent(null);
          setTeacherPinTargetStudents([]);
        }}
      />

      {/* Reset All Pins Modal */}
      {isResetAllModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#1a1a1a]/50 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-8 shadow-2xl border border-stone-200 relative">
            <div className="flex items-center justify-between pb-4 mb-4 border-b border-stone-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-amber-50 text-amber-800 flex items-center justify-center text-xl">
                  🔑
                </div>
                <div>
                  <h3 className="font-extrabold text-xl text-stone-900">전체 학생 PIN 일괄 초기화</h3>
                  <p className="text-xs text-stone-500 font-medium">우리반 {totalStudents}명 모든 학생의 비밀번호를 재설정합니다</p>
                </div>
              </div>
              <button
                onClick={() => setIsResetAllModalOpen(false)}
                className="w-8 h-8 rounded-full bg-stone-100 text-stone-500 hover:bg-stone-200 flex items-center justify-center transition-colors"
              >
                <span className="material-symbols-outlined text-lg">close</span>
              </button>
            </div>

            <div className="space-y-4">
              <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-2xl text-amber-900 text-xs leading-relaxed">
                ⚠️ 초기화 시 학생들의 개별 변경 여부와 상관없이 모든 계정의 PIN 비밀번호가 지정한 값으로 일괄 변경 및 동기화됩니다.
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1.5">
                  전체 적용할 PIN 번호 (4~6자리 숫자)
                </label>
                <input
                  type="text"
                  maxLength={6}
                  value={customResetPin}
                  onChange={e => setCustomResetPin(e.target.value)}
                  className="w-full h-12 px-4 bg-stone-50 border-2 border-stone-200 focus:border-amber-600 focus:bg-white rounded-2xl text-base font-mono font-bold tracking-widest text-center focus:outline-none"
                  placeholder="1234"
                />
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setCustomResetPin('1234')}
                  className="flex-1 py-2 bg-stone-100 hover:bg-stone-200 rounded-xl text-xs font-bold text-stone-700 transition-colors"
                >
                  1234 (기본 권장)
                </button>
                <button
                  type="button"
                  onClick={() => setCustomResetPin('0000')}
                  className="flex-1 py-2 bg-stone-100 hover:bg-stone-200 rounded-xl text-xs font-bold text-stone-700 transition-colors"
                >
                  0000 (임시번호)
                </button>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsResetAllModalOpen(false)}
                  className="flex-1 h-12 bg-stone-100 hover:bg-stone-200 text-stone-700 font-bold text-sm rounded-2xl transition-colors"
                >
                  취소
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const cleanPin = customResetPin.trim();
                    if (cleanPin.length < 4 || cleanPin.length > 6 || !/^\d+$/.test(cleanPin)) {
                      alert('PIN은 4~6자리 숫자로 입력해 주세요.');
                      return;
                    }
                    if (confirm(`모든 학생(${totalStudents}명)의 PIN을 [${cleanPin}]으로 초기화하시겠습니까?`)) {
                      resetAllPins(cleanPin);
                      setIsResetAllModalOpen(false);
                      alert(`모든 학생의 PIN 번호가 [${cleanPin}]으로 일괄 초기화되었습니다.`);
                    }
                  }}
                  className="flex-1 h-12 bg-amber-800 hover:bg-amber-900 text-white font-bold text-sm rounded-2xl shadow-md transition-all flex items-center justify-center gap-1.5"
                >
                  <span className="material-symbols-outlined text-base">restart_alt</span>
                  <span>전체 초기화 실행</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Stock Price Change Confirmation Modal */}
      {stockConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#1a1a1a]/60 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="bg-white rounded-2xs max-w-lg w-full p-6 sm:p-7 shadow-2xl border border-[#1a1a1a]/20 relative flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="flex items-start justify-between pb-4 mb-4 border-b border-[#1a1a1a]/10">
              <div className="flex items-center gap-3">
                <div className={`w-11 h-11 rounded-2xs flex items-center justify-center text-2xl shadow-2xs border ${
                  stockConfirmModal.badgeType === 'up'
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                    : stockConfirmModal.badgeType === 'down'
                      ? 'bg-rose-50 text-rose-800 border-rose-300'
                      : 'bg-amber-50 text-amber-800 border-amber-300'
                }`}>
                  📈
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-editorial text-lg sm:text-xl font-bold text-[#1a1a1a]">
                      {stockConfirmModal.title}
                    </h3>
                    {stockConfirmModal.presetBadge && (
                      <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
                        stockConfirmModal.badgeType === 'up'
                          ? 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                          : stockConfirmModal.badgeType === 'down'
                            ? 'bg-rose-100 text-rose-900 border border-rose-300'
                            : 'bg-amber-100 text-amber-900 border border-amber-300'
                      }`}>
                        {stockConfirmModal.presetBadge}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-[#1a1a1a]/70 font-medium mt-0.5">
                    {stockConfirmModal.subtitle || '변경 내역을 실시간 증권 시장에 즉시 반영하시겠습니까?'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setStockConfirmModal(null)}
                className="w-8 h-8 rounded-full bg-stone-100 text-stone-500 hover:bg-stone-200 flex items-center justify-center transition-colors"
                title="닫기"
              >
                <span className="material-symbols-outlined text-lg">close</span>
              </button>
            </div>

            {/* Modal Body: Items List */}
            <div className="flex-1 overflow-y-auto pr-1 space-y-2 my-1">
              <div className="text-[11px] font-bold text-[#1a1a1a]/60 uppercase tracking-wider flex items-center justify-between px-1 mb-1">
                <span>반영 대상 종목 ({stockConfirmModal.items.length}개)</span>
                <span>기존가 ➔ 변경 주가 (변동률)</span>
              </div>

              {stockConfirmModal.items.map(item => (
                <div
                  key={item.id}
                  className="p-3 bg-[#faf8f5] rounded-2xs border border-[#1a1a1a]/12 flex items-center justify-between gap-2"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[9px] font-bold text-[#1a1a1a]/50 uppercase bg-[#1a1a1a]/5 px-1 rounded-2xs">
                        {item.category}
                      </span>
                      <strong className="text-xs font-bold text-[#1a1a1a] truncate">
                        {item.name}
                      </strong>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 font-mono text-right shrink-0">
                    <span className="text-xs text-stone-500 line-through">
                      {item.currentPrice.toLocaleString()}원
                    </span>
                    <span className="text-stone-400 text-xs">➔</span>
                    <span className="text-xs font-bold text-[#1a1a1a]">
                      {item.newPrice.toLocaleString()}원
                    </span>
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-2xs border ${
                      item.changeAmount > 0
                        ? 'text-emerald-800 bg-emerald-50 border-emerald-300'
                        : item.changeAmount < 0
                          ? 'text-rose-800 bg-rose-50 border-rose-300'
                          : 'text-stone-600 bg-stone-100 border-stone-300'
                    }`}>
                      {item.changeAmount > 0 ? `▲ +${item.changeRate}%` : item.changeAmount < 0 ? `▼ ${item.changeRate}%` : '0%'}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {/* Notice Callout */}
            <div className="mt-4 p-3 bg-amber-50/80 border border-amber-300/80 rounded-2xs text-amber-950 text-xs flex items-start gap-2">
              <span className="material-symbols-outlined text-[17px] text-amber-700 shrink-0 mt-0.5">info</span>
              <p className="leading-relaxed text-[11px]">
                <strong>즉시 반영 안내</strong>: [즉시 반영하기]를 누르면 Firestore 클라우드에 실시간 저장되며, 접속 중인 모든 학생의 <strong>보유 주식 평가액과 계좌 총자산이 지체 없이 즉시 갱신</strong>됩니다.
              </p>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2.5 pt-4 mt-2 border-t border-[#1a1a1a]/10">
              <button
                type="button"
                onClick={() => setStockConfirmModal(null)}
                className="flex-1 h-11 bg-stone-100 hover:bg-stone-200 text-[#1a1a1a] font-bold text-xs uppercase tracking-wider rounded-2xs transition-colors"
              >
                취소
              </button>
              <button
                type="button"
                onClick={() => stockConfirmModal.onConfirm()}
                className="flex-1 h-11 bg-[#1a1a1a] hover:bg-stone-800 text-white font-bold text-xs uppercase tracking-wider rounded-2xs shadow-2xs transition-all flex items-center justify-center gap-1.5 btn-press"
              >
                <span className="material-symbols-outlined text-[17px] text-amber-300">bolt</span>
                <span>즉시 반영하기</span>
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Fine / Reward Execution Result Modal */}
      {isFineSummaryModalOpen && fineSummaryModalData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#1a1a1a]/50 backdrop-blur-2xs p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-sm max-w-2xl w-full p-6 shadow-2xl border border-[#1a1a1a]/15 relative max-h-[90vh] flex flex-col">
            <button
              onClick={() => {
                setIsFineSummaryModalOpen(false);
                setFineSummaryModalData(null);
              }}
              className="absolute top-4 right-4 text-[#1a1a1a]/50 hover:text-[#1a1a1a] w-8 h-8 flex items-center justify-center rounded-2xs hover:bg-[#faf8f5]"
            >
              <span className="material-symbols-outlined text-[18px]">close</span>
            </button>

            <div className="flex items-center gap-3 mb-4 shrink-0">
              <div className={`w-11 h-11 rounded-2xs flex items-center justify-center font-bold text-2xl ${
                fineSummaryModalData.type === 'fine' ? 'bg-rose-100 text-rose-950 border border-rose-300' : 'bg-amber-100 text-amber-950 border border-amber-300'
              }`}>
                {fineSummaryModalData.type === 'fine' ? '🚨' : '🏆'}
              </div>
              <div>
                <h3 className="font-editorial text-xl font-bold text-[#1a1a1a]">
                  {fineSummaryModalData.type === 'fine' ? '벌금 부과 및 자산 청산 결과 리포트' : '상금 지급 및 부채 상환 결과 리포트'}
                </h3>
                <p className="text-xs text-[#1a1a1a]/70 mt-0.5">
                  사유: <strong>{fineSummaryModalData.reason}</strong> · 대상 <strong>{fineSummaryModalData.targetCount}명</strong> (인당 {fineSummaryModalData.amount.toLocaleString()}원)
                </p>
              </div>
            </div>

            {/* Aggregated KPI Cards */}
            {fineSummaryModalData.type === 'fine' ? (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4 shrink-0 font-mono text-xs">
                <div className="bg-[#faf8f5] p-2.5 rounded-2xs border border-[#1a1a1a]/10">
                  <span className="text-[10px] text-[#1a1a1a]/60 block font-sans">현금 차감</span>
                  <strong className="text-emerald-900 text-sm font-bold">
                    {fineSummaryModalData.totalCashDeducted.toLocaleString()}원
                  </strong>
                </div>
                <div className="bg-blue-50/50 p-2.5 rounded-2xs border border-blue-200">
                  <span className="text-[10px] text-blue-900 block font-sans">저축 자동인출</span>
                  <strong className="text-blue-900 text-sm font-bold">
                    {fineSummaryModalData.totalSavingsDeducted.toLocaleString()}원
                  </strong>
                </div>
                <div className="bg-amber-50/50 p-2.5 rounded-2xs border border-amber-200">
                  <span className="text-[10px] text-amber-950 block font-sans">주식 자동매각</span>
                  <strong className="text-amber-950 text-sm font-bold">
                    {fineSummaryModalData.totalStockLiquidated.toLocaleString()}원
                  </strong>
                </div>
                <div className="bg-rose-50/60 p-2.5 rounded-2xs border border-rose-300">
                  <span className="text-[10px] text-rose-900 block font-sans">신규 부채(빚) 발생</span>
                  <strong className="text-rose-950 text-sm font-bold">
                    +{fineSummaryModalData.totalNewDebt.toLocaleString()}원
                  </strong>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-2 mb-4 shrink-0 font-mono text-xs">
                <div className="bg-emerald-50/60 p-2.5 rounded-2xs border border-emerald-300">
                  <span className="text-[10px] text-emerald-900 block font-sans">총 상금</span>
                  <strong className="text-emerald-950 text-sm font-bold">
                    +{(fineSummaryModalData.amount * fineSummaryModalData.targetCount).toLocaleString()}원
                  </strong>
                </div>
                <div className="bg-blue-50/60 p-2.5 rounded-2xs border border-blue-300">
                  <span className="text-[10px] text-blue-900 block font-sans">부채 자동 상환</span>
                  <strong className="text-blue-950 text-sm font-bold">
                    -{fineSummaryModalData.totalDebtRepaid.toLocaleString()}원
                  </strong>
                </div>
                <div className="bg-amber-50/60 p-2.5 rounded-2xs border border-amber-300">
                  <span className="text-[10px] text-amber-900 block font-sans">현금 순지급</span>
                  <strong className="text-amber-950 text-sm font-bold">
                    +{((fineSummaryModalData.amount * fineSummaryModalData.targetCount) - fineSummaryModalData.totalDebtRepaid).toLocaleString()}원
                  </strong>
                </div>
              </div>
            )}

            {/* Individual Student Table */}
            <div className="flex-1 overflow-y-auto border border-[#1a1a1a]/15 rounded-2xs bg-[#faf8f5]/50">
              <table className="w-full text-left border-collapse text-xs">
                <thead className="bg-[#faf8f5] border-b border-[#1a1a1a]/10 font-bold text-[11px] text-[#1a1a1a]/70 uppercase tracking-wider sticky top-0">
                  <tr>
                    <th className="py-2.5 px-3">학생</th>
                    {fineSummaryModalData.type === 'fine' ? (
                      <>
                        <th className="py-2.5 px-3 text-right">현금차감</th>
                        <th className="py-2.5 px-3 text-right">저축인출</th>
                        <th className="py-2.5 px-3 text-left">주식 자동매각</th>
                        <th className="py-2.5 px-3 text-right">발생 부채</th>
                        <th className="py-2.5 px-3 text-right">최종 잔여빚</th>
                      </>
                    ) : (
                      <>
                        <th className="py-2.5 px-3 text-right">지급 상금</th>
                        <th className="py-2.5 px-3 text-right">부채 상환액</th>
                        <th className="py-2.5 px-3 text-right">현금 증가</th>
                        <th className="py-2.5 px-3 text-right">남은 부채</th>
                      </>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1a1a1a]/10">
                  {fineSummaryModalData.records.map(rec => (
                    <tr key={rec.studentId} className="hover:bg-white transition-colors">
                      <td className="py-2 px-3 font-bold text-[#1a1a1a]">
                        {rec.studentNumber}번 {rec.studentName}
                      </td>
                      {fineSummaryModalData.type === 'fine' ? (
                        <>
                          <td className="py-2 px-3 text-right font-mono font-medium text-emerald-900">
                            {rec.cashDeducted > 0 ? `-${rec.cashDeducted.toLocaleString()}원` : '-'}
                          </td>
                          <td className="py-2 px-3 text-right font-mono font-medium text-blue-900">
                            {rec.savingsDeducted > 0 ? `-${rec.savingsDeducted.toLocaleString()}원` : '-'}
                          </td>
                          <td className="py-2 px-3 text-left text-[11px]">
                            {rec.liquidatedStocks && rec.liquidatedStocks.length > 0 ? (
                              <div className="space-y-0.5">
                                {rec.liquidatedStocks.map((ls, idx) => (
                                  <span key={idx} className="inline-block bg-amber-100 text-amber-950 px-1.5 py-0.2 rounded-2xs font-mono mr-1">
                                    {ls.stockName} {Number.isInteger(ls.shares) ? ls.shares : parseFloat(ls.shares.toFixed(4))}주 ({ls.amount.toLocaleString()}원)
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <span className="text-[#1a1a1a]/30">-</span>
                            )}
                          </td>
                          <td className="py-2 px-3 text-right font-mono font-bold text-rose-900">
                            {rec.newDebtIncurred > 0 ? `+${rec.newDebtIncurred.toLocaleString()}원` : '-'}
                          </td>
                          <td className="py-2 px-3 text-right font-mono font-bold">
                            {rec.finalDebt > 0 ? (
                              <span className="text-rose-950 bg-rose-100 px-1.5 py-0.5 rounded-2xs border border-rose-300">
                                🚨 {rec.finalDebt.toLocaleString()}원
                              </span>
                            ) : (
                              <span className="text-emerald-800">0원 (부채없음)</span>
                            )}
                          </td>
                        </>
                      ) : (
                        <>
                          <td className="py-2 px-3 text-right font-mono font-bold text-emerald-900">
                            +{rec.amount.toLocaleString()}원
                          </td>
                          <td className="py-2 px-3 text-right font-mono font-bold text-blue-900">
                            {rec.debtRepaid > 0 ? `-${rec.debtRepaid.toLocaleString()}원` : '-'}
                          </td>
                          <td className="py-2 px-3 text-right font-mono font-bold text-emerald-950">
                            +{(rec.amount - rec.debtRepaid).toLocaleString()}원
                          </td>
                          <td className="py-2 px-3 text-right font-mono">
                            {rec.finalDebt > 0 ? (
                              <span className="text-rose-900 font-bold">{rec.finalDebt.toLocaleString()}원</span>
                            ) : (
                              <span className="text-emerald-800 font-bold">0원 (완제)</span>
                            )}
                          </td>
                        </>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="pt-4 mt-3 border-t border-[#1a1a1a]/10 flex justify-end shrink-0">
              <button
                type="button"
                onClick={() => {
                  setIsFineSummaryModalOpen(false);
                  setFineSummaryModalData(null);
                }}
                className="px-6 py-2.5 bg-[#1a1a1a] hover:bg-stone-800 text-white font-bold text-xs uppercase tracking-wider rounded-2xs shadow-2xs transition-colors"
              >
                확인 완료
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Backup Restore Confirmation Modal */}
      {pendingBackupRestore && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-[1px] flex items-center justify-center p-4">
          <div className="bg-white border border-[#1a1a1a]/20 rounded-sm shadow-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined">upload_file</span>
              </div>
              <div>
                <h3 className="text-base font-bold text-[#1a1a1a]">백업 데이터 복원 확인</h3>
                <p className="text-xs text-[#1a1a1a]/70 mt-1">
                  선택한 백업 파일의 내용으로 현재 학급과 학생 자산을 복원합니다.
                </p>
              </div>
            </div>

            <div className="bg-[#faf8f5] border border-[#1a1a1a]/10 rounded-2xs p-3.5 text-xs space-y-1.5">
              <div className="flex justify-between gap-2">
                <span className="text-[#1a1a1a]/60">파일명</span>
                <span className="font-mono font-semibold text-right break-all">{pendingBackupRestore.fileName}</span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-[#1a1a1a]/60">학급 / 코드</span>
                <span className="font-bold">{pendingBackupRestore.className} ({pendingBackupRestore.classCode})</span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-[#1a1a1a]/60">라운드 / 학생 수</span>
                <span className="font-bold text-emerald-800">
                  Round {pendingBackupRestore.currentRound} · {pendingBackupRestore.studentCount}명
                </span>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                disabled={isRestoringBackup}
                onClick={() => setPendingBackupRestore(null)}
                className="px-4 py-2 text-xs font-bold border border-[#1a1a1a]/20 rounded-2xs hover:bg-stone-100 transition-colors disabled:opacity-50"
              >
                취소
              </button>
              <button
                type="button"
                disabled={isRestoringBackup}
                onClick={handleConfirmBackupRestore}
                className="px-5 py-2 text-xs font-bold bg-emerald-700 hover:bg-emerald-800 text-white rounded-2xs shadow-2xs transition-colors disabled:opacity-50"
              >
                {isRestoringBackup ? '복원 중...' : '복원 실행'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Backup Restore Result Modal */}
      {backupRestoreFeedback && (
        <div className="fixed inset-0 z-50 bg-black/45 backdrop-blur-[1px] flex items-center justify-center p-4">
          <div className="bg-white border border-[#1a1a1a]/20 rounded-sm shadow-2xl max-w-sm w-full p-6 space-y-4">
            <div className="flex items-start gap-3">
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                  backupRestoreFeedback.success
                    ? 'bg-emerald-100 text-emerald-800'
                    : 'bg-red-100 text-red-800'
                }`}
              >
                <span className="material-symbols-outlined">
                  {backupRestoreFeedback.success ? 'check_circle' : 'error'}
                </span>
              </div>
              <div>
                <h3 className="text-base font-bold text-[#1a1a1a]">
                  {backupRestoreFeedback.success ? '백업 복원 완료' : '백업 처리 실패'}
                </h3>
                <p className="text-xs text-[#1a1a1a]/80 mt-1 leading-relaxed">
                  {backupRestoreFeedback.message}
                </p>
              </div>
            </div>
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setBackupRestoreFeedback(null)}
                className="px-5 py-2 text-xs font-bold bg-[#1a1a1a] hover:bg-stone-800 text-white rounded-2xs transition-colors"
              >
                확인
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
