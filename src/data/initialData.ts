import { ClassEconomyState, ShopItem, Student, StockInfo, NewsArticle } from '../types';

export const initialShopItems: ShopItem[] = [
  {
    id: 'shop-1',
    name: '자리 교환권',
    price: 5000,
    icon: '🪑',
    description: '일주일 동안 원하는 자리에 앉을 수 있는 일등 권리!'
  },
  {
    id: 'shop-2',
    name: '숙제 면제권',
    price: 10000,
    icon: '📝',
    description: '하루 일기 또는 일일 과제를 1회 면제받습니다.'
  },
  {
    id: 'shop-3',
    name: '청소 면제권',
    price: 8000,
    icon: '🧹',
    description: '담당 청소 구역에서 하루 자유롭게 쉽니다.'
  },
  {
    id: 'shop-4',
    name: '급식 우선권',
    price: 3000,
    icon: '🍱',
    description: '점심시간에 가장 먼저 줄을 서서 급식을 받습니다.'
  },
  {
    id: 'shop-5',
    name: '자유시간 10분권',
    price: 7000,
    icon: '⏰',
    description: '쉬는 시간에 10분 추가 자유시간을 누립니다.'
  }
];

export const initialStocks: StockInfo[] = [
  {
    id: 'stockA',
    name: '미래 IT (기술주)',
    category: '기술주',
    currentPrice: 10000,
    previousPrice: 10000,
    changeRate: 0.0
  },
  {
    id: 'stockB',
    name: '에코 에너지 (친환경)',
    category: '친환경',
    currentPrice: 10000,
    previousPrice: 10000,
    changeRate: 0.0
  }
];

export const initialStudents: Student[] = [
  { id: 'student-1', number: 1, name: '김민준', username: 'student_01', pin: '1234', cash: 30000, savings: 0, stockShares: {}, lastActive: '접속 이력 없음', isOnline: false, pinResetRequested: false, recentActivity: '계정 생성됨', couponsOwned: [] },
  { id: 'student-2', number: 2, name: '이서아', username: 'student_02', pin: '1234', cash: 30000, savings: 0, stockShares: {}, lastActive: '접속 이력 없음', isOnline: false, pinResetRequested: false, recentActivity: '계정 생성됨', couponsOwned: [] },
  { id: 'student-3', number: 3, name: '박도윤', username: 'student_03', pin: '1234', cash: 30000, savings: 0, stockShares: {}, lastActive: '접속 이력 없음', isOnline: false, pinResetRequested: false, recentActivity: '계정 생성됨', couponsOwned: [] },
  { id: 'student-4', number: 4, name: '최지우', username: 'student_04', pin: '1234', cash: 30000, savings: 0, stockShares: {}, lastActive: '접속 이력 없음', isOnline: false, pinResetRequested: false, recentActivity: '계정 생성됨', couponsOwned: [] },
  { id: 'student-5', number: 5, name: '정예준', username: 'student_05', pin: '1234', cash: 30000, savings: 0, stockShares: {}, lastActive: '접속 이력 없음', isOnline: false, pinResetRequested: false, recentActivity: '계정 생성됨', couponsOwned: [] },
  { id: 'student-6', number: 6, name: '강하은', username: 'student_06', pin: '1234', cash: 30000, savings: 0, stockShares: {}, lastActive: '접속 이력 없음', isOnline: false, pinResetRequested: false, recentActivity: '계정 생성됨', couponsOwned: [] },
  { id: 'student-7', number: 7, name: '조은우', username: 'student_07', pin: '1234', cash: 30000, savings: 0, stockShares: {}, lastActive: '접속 이력 없음', isOnline: false, pinResetRequested: false, recentActivity: '계정 생성됨', couponsOwned: [] },
  { id: 'student-8', number: 8, name: '윤서진', username: 'student_08', pin: '1234', cash: 30000, savings: 0, stockShares: {}, lastActive: '접속 이력 없음', isOnline: false, pinResetRequested: false, recentActivity: '계정 생성됨', couponsOwned: [] },
  { id: 'student-9', number: 9, name: '임지호', username: 'student_09', pin: '1234', cash: 30000, savings: 0, stockShares: {}, lastActive: '접속 이력 없음', isOnline: false, pinResetRequested: false, recentActivity: '계정 생성됨', couponsOwned: [] },
  { id: 'student-10', number: 10, name: '송하윤', username: 'student_10', pin: '1234', cash: 30000, savings: 0, stockShares: {}, lastActive: '접속 이력 없음', isOnline: false, pinResetRequested: false, recentActivity: '계정 생성됨', couponsOwned: [] },
  { id: 'student-11', number: 11, name: '한지안', username: 'student_11', pin: '1234', cash: 30000, savings: 0, stockShares: {}, lastActive: '접속 이력 없음', isOnline: false, pinResetRequested: false, recentActivity: '계정 생성됨', couponsOwned: [] },
  { id: 'student-12', number: 12, name: '백도현', username: 'student_12', pin: '1234', cash: 30000, savings: 0, stockShares: {}, lastActive: '접속 이력 없음', isOnline: false, pinResetRequested: false, recentActivity: '계정 생성됨', couponsOwned: [] },
  { id: 'student-13', number: 13, name: '권유나', username: 'student_13', pin: '1234', cash: 30000, savings: 0, stockShares: {}, lastActive: '접속 이력 없음', isOnline: false, pinResetRequested: false, recentActivity: '계정 생성됨', couponsOwned: [] },
  { id: 'student-14', number: 14, name: '신수아', username: 'student_14', pin: '1234', cash: 30000, savings: 0, stockShares: {}, lastActive: '접속 이력 없음', isOnline: false, pinResetRequested: false, recentActivity: '계정 생성됨', couponsOwned: [] },
  { id: 'student-15', number: 15, name: '배시우', username: 'student_15', pin: '1234', cash: 30000, savings: 0, stockShares: {}, lastActive: '접속 이력 없음', isOnline: false, pinResetRequested: false, recentActivity: '계정 생성됨', couponsOwned: [] },
  { id: 'student-16', number: 16, name: '오준우', username: 'student_16', pin: '1234', cash: 30000, savings: 0, stockShares: {}, lastActive: '접속 이력 없음', isOnline: false, pinResetRequested: false, recentActivity: '계정 생성됨', couponsOwned: [] },
  { id: 'student-17', number: 17, name: '안서현', username: 'student_17', pin: '1234', cash: 30000, savings: 0, stockShares: {}, lastActive: '접속 이력 없음', isOnline: false, pinResetRequested: false, recentActivity: '계정 생성됨', couponsOwned: [] },
  { id: 'student-18', number: 18, name: '황예린', username: 'student_18', pin: '1234', cash: 30000, savings: 0, stockShares: {}, lastActive: '접속 이력 없음', isOnline: false, pinResetRequested: false, recentActivity: '계정 생성됨', couponsOwned: [] },
  { id: 'student-19', number: 19, name: '서민서', username: 'student_19', pin: '1234', cash: 30000, savings: 0, stockShares: {}, lastActive: '접속 이력 없음', isOnline: false, pinResetRequested: false, recentActivity: '계정 생성됨', couponsOwned: [] },
  { id: 'student-20', number: 20, name: '류승우', username: 'student_20', pin: '1234', cash: 30000, savings: 0, stockShares: {}, lastActive: '접속 이력 없음', isOnline: false, pinResetRequested: false, recentActivity: '계정 생성됨', couponsOwned: [] },
  { id: 'student-21', number: 21, name: '홍길동', username: 'student_21', pin: '1234', cash: 30000, savings: 0, stockShares: {}, lastActive: '접속 이력 없음', isOnline: false, pinResetRequested: false, recentActivity: '계정 생성됨', couponsOwned: [] },
  { id: 'student-22', number: 22, name: '문지환', username: 'student_22', pin: '1234', cash: 30000, savings: 0, stockShares: {}, lastActive: '접속 이력 없음', isOnline: false, pinResetRequested: false, recentActivity: '계정 생성됨', couponsOwned: [] },
  { id: 'student-23', number: 23, name: '양소율', username: 'student_23', pin: '1234', cash: 30000, savings: 0, stockShares: {}, lastActive: '접속 이력 없음', isOnline: false, pinResetRequested: false, recentActivity: '계정 생성됨', couponsOwned: [] },
  { id: 'student-24', number: 24, name: '손태양', username: 'student_24', pin: '1234', cash: 30000, savings: 0, stockShares: {}, lastActive: '접속 이력 없음', isOnline: false, pinResetRequested: false, recentActivity: '계정 생성됨', couponsOwned: [] },
  { id: 'student-25', number: 25, name: '노하늘', username: 'student_25', pin: '1234', cash: 30000, savings: 0, stockShares: {}, lastActive: '접속 이력 없음', isOnline: false, pinResetRequested: false, recentActivity: '계정 생성됨', couponsOwned: [] },
  { id: 'student-26', number: 26, name: '곽도원', username: 'student_26', pin: '1234', cash: 30000, savings: 0, stockShares: {}, lastActive: '접속 이력 없음', isOnline: false, pinResetRequested: false, recentActivity: '계정 생성됨', couponsOwned: [] },
  { id: 'student-27', number: 27, name: '진보라', username: 'student_27', pin: '1234', cash: 30000, savings: 0, stockShares: {}, lastActive: '접속 이력 없음', isOnline: false, pinResetRequested: false, recentActivity: '계정 생성됨', couponsOwned: [] },
  { id: 'student-28', number: 28, name: '엄태윤', username: 'student_28', pin: '1234', cash: 30000, savings: 0, stockShares: {}, lastActive: '접속 이력 없음', isOnline: false, pinResetRequested: false, recentActivity: '계정 생성됨', couponsOwned: [] },
  { id: 'student-29', number: 29, name: '채다인', username: 'student_29', pin: '1234', cash: 30000, savings: 0, stockShares: {}, lastActive: '접속 이력 없음', isOnline: false, pinResetRequested: false, recentActivity: '계정 생성됨', couponsOwned: [] },
  { id: 'student-30', number: 30, name: '표지후', username: 'student_30', pin: '1234', cash: 30000, savings: 0, stockShares: {}, lastActive: '접속 이력 없음', isOnline: false, pinResetRequested: false, recentActivity: '계정 생성됨', couponsOwned: [] }
];

export const initialNewsArticles: NewsArticle[] = [
  {
    id: 'news-1',
    title: '정부, 차세대 인공지능(AI) 및 미래 테크 산업에 1조 원 지원 발표',
    summary: '정부와 교육부가 AI 테크 소프트웨어 기술 육성을 위해 대규모 지원을 확정하면서 IT 대장주들의 성장세가 주목받고 있습니다.',
    content: `[학급경제신문 = 경제부] 정부와 미래혁신위원회가 오늘 차세대 초거대 인공지능(AI)과 클라우드 소프트웨어 산업 육성을 위해 1조 원 규모의 대규모 펀드 조성을 공식 발표했습니다.\n\n이번 투자 계획에 따라 인공지능 소프트웨어 및 반도체 관련 기술을 보유한 혁신 기업들이 직접적인 수혜를 입을 것으로 기대되며, 증권가 전문가들은 IT 산업의 영업이익과 매출이 큰 폭으로 증가할 것으로 전망하고 있습니다.\n\n한 경제 전문가는 "국가적 차원의 전폭적인 지원이 예정된 만큼 관련 기술주에 대한 투자자들의 관심이 뜨겁다"고 밝혔습니다.`,
    category: 'stock',
    relatedStockId: 'stock-1',
    relatedStockName: '테크전자',
    impact: 'positive',
    publishedRound: 1,
    publishedAt: '2026-09-01 09:00',
    author: '학급경제신문 IT전문기자',
    isBreaking: true
  },
  {
    id: 'news-2',
    title: '중앙은행, 물가 안정과 소비 촉진을 위한 기준금리 5.0% 유지 발표',
    summary: '중앙은행 금융통화위원회가 이번 회차 기준금리를 연 5.0%로 안정적으로 유지하기로 결정했습니다.',
    content: `[학급중앙일보 = 금융팀] 중앙은행은 오늘 개최된 금융통화위원회 정례회의에서 정기예금 기준금리를 현행 연 5.0%로 동결한다고 발표했습니다.\n\n최근 소비 심리와 학급 화폐 유통량을 종합적으로 분석한 결과, 안정적인 경제 성장을 견인하기 위해 적정 수준의 저축 금리를 유지하는 것이 바람직하다는 결론을 내렸습니다.\n\n학생들은 안전한 자산 증식을 위해 은행 정기예금 저축을 적극 활용하거나, 주식 시장의 우량주에 분산 투자하는 포트폴리오 전략을 구사하는 것이 유리할 것으로 예상됩니다.`,
    category: 'policy',
    impact: 'neutral',
    publishedRound: 1,
    publishedAt: '2026-09-01 08:30',
    author: '한국은행 경제연구원',
    isBreaking: false
  },
  {
    id: 'news-3',
    title: '바이오헬스, 혁신 신약 글로벌 3상 임상시험 성공적 진입',
    summary: '신약 파이프라인 개발에 집중해 온 바이오헬스가 임상 3상 시험 승인을 획득하며 글로벌 시장 진출에 청신호가 켜졌습니다.',
    content: `[학급경제신문 = 제약바이오팀] 제약·바이오 대표 기업인 바이오헬스가 신약 개발 임상 3상 시험에 본격 착수했다고 밝혔습니다.\n\n이번 신약은 기존 치료제 대비 효능과 안전성이 30% 이상 향상된 것으로 평가받고 있으며, 글로벌 제약사들과의 기술 수출 계약 논의도 활발히 진행 중입니다.\n\n다만 임상 결과 발표까지는 변동성이 존재할 수 있으므로 신중한 분할 매수 전략이 필요하다는 의견도 제시되고 있습니다.`,
    category: 'stock',
    relatedStockId: 'stock-2',
    relatedStockName: '바이오헬스',
    impact: 'positive',
    publishedRound: 1,
    publishedAt: '2026-09-01 08:00',
    author: '신약개발 전문기자',
    isBreaking: false
  },
  {
    id: 'news-4',
    title: '신재생그린, 친환경 탄소중립 정책 수혜로 신규 태양광 수주 잇따라',
    summary: '탄소중립 2050 로드맵 추진으로 친환경 에너지 인프라 수요가 급증하고 있습니다.',
    content: `[학급일보 = 산업부] 친환경 에너지 솔루션 선도기업 신재생그린이 대규모 태양광 및 풍력 발전 단지 공급 계약을 체결했습니다.\n\n정부의 친환경 에너지 전환 정책과 맞물려 신재생에너지 부문의 연간 매출이 20% 이상 증가할 것으로 기대됩니다. 지속 가능한 ESG 투자에 관심 있는 학생 투자자들의 주목을 받고 있습니다.`,
    category: 'stock',
    relatedStockId: 'stock-3',
    relatedStockName: '신재생그린',
    impact: 'positive',
    publishedRound: 1,
    publishedAt: '2026-08-31 16:00',
    author: '에너지산업 전문기자',
    isBreaking: false
  }
];

export const initialClassState: ClassEconomyState = {
  classCode: 'C-10001',
  className: '우리반',
  currencyUnit: '원',
  language: 'ko',
  currentRound: 1,
  totalRounds: 10,
  isTradingFrozen: false,
  isLeaderboardPublic: true,
  depositInterestRate: 5.0,
  newsMessage: '📢 학급 경제가 새로 개설되었습니다. 선생님 관리자에서 학생 인원을 설정하고 학급 경제를 시작하세요!',
  newsArticles: initialNewsArticles,
  stocks: initialStocks,
  shopItems: initialShopItems,
  students: initialStudents,
  transactions: [],
  undoAvailableUntil: null
};
