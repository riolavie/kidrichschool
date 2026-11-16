import { Student } from '../types';

/**
 * Calculates a priority score for a student record.
 * Higher score means the student has user activity or custom data
 * and should be PRESERVED over empty/generic duplicates.
 */
export function getStudentActivityScore(s: Student): number {
  let score = 0;
  if (!s) return 0;

  // 1. PIN changed or custom PIN
  if (s.isPinChanged || (s.pin && s.pin !== '1234')) {
    score += 100;
  }

  // 2. Stock shares owned
  if (s.stockShares && typeof s.stockShares === 'object') {
    const hasShares = Object.values(s.stockShares).some(v => typeof v === 'number' && v > 0);
    if (hasShares) score += 60;
  }

  // 3. Coupons owned
  if (Array.isArray(s.couponsOwned) && s.couponsOwned.length > 0) {
    score += 50;
  }

  // 4. Financial transactions or changes to default balances
  if ((s.savings || 0) > 0) score += 40;
  if ((s.debt || 0) > 0) score += 30;
  if (typeof s.cash === 'number' && s.cash !== 30000) score += 40;

  // 5. Activity log / history
  if (Array.isArray(s.roundHistory) && s.roundHistory.length > 0) {
    score += 50;
  }
  if (s.lastActive && s.lastActive !== '접속 이력 없음' && s.lastActive !== '최근 접속') {
    score += 25;
  }
  if (s.recentActivity && s.recentActivity !== '계정 준비됨' && s.recentActivity !== '계정 생성됨') {
    score += 15;
  }

  // 6. Name quality: A real Korean name (e.g. '김민준') has higher priority than generic '1번 학생'
  if (s.name && !s.name.includes('번 학생')) {
    score += 10;
  }

  // 7. Canonical standard ID format preference (e.g. 'student-1' vs 'student_172000...')
  if (s.id && /^student-\d+$/.test(s.id)) {
    score += 5;
  }

  return score;
}

/**
 * Intelligently deduplicates a list of students.
 * Especially handles cases where students #1 through #5 (or any number)
 * were duplicated through multiple registrations, migrations, or sync collisions.
 *
 * It prioritizes keeping the record with actual user data/activity,
 * and identifies the duplicate IDs that should be permanently deleted from Firestore and state.
 */
export function deduplicateStudents(students: Student[]): {
  unique: Student[];
  duplicateIds: string[];
  duplicateStudents: Student[];
} {
  if (!Array.isArray(students) || students.length === 0) {
    return { unique: [], duplicateIds: [], duplicateStudents: [] };
  }

  const seenIds = new Set<string>();
  const seenNumbers = new Map<number, Student>();
  const seenUsernames = new Map<string, Student>();
  const seenCleanNames = new Map<string, Student>();

  const duplicateIds: string[] = [];
  const duplicateStudents: Student[] = [];
  const uniqueList: Student[] = [];

  const cleanNameForMatch = (name: string): string => {
    if (!name) return '';
    // Strip leading number prefixes like '1번 ', '01번 ', '(1) '
    return name
      .replace(/^[0-9]+번\s*/, '')
      .replace(/^\([0-9]+\)\s*/, '')
      .replace(/\s+/g, '')
      .toLowerCase();
  };

  for (const st of students) {
    if (!st || !st.id) continue;

    // 1. Direct ID duplicate
    if (seenIds.has(st.id)) {
      if (!duplicateIds.includes(st.id)) {
        duplicateIds.push(st.id);
        duplicateStudents.push(st);
      }
      continue;
    }

    const num = Number(st.number);
    const username = String(st.username || '').toLowerCase().trim();
    const cleanName = cleanNameForMatch(st.name);

    // Check potential conflicts
    const conflictByNum = !isNaN(num) && num > 0 ? seenNumbers.get(num) : undefined;
    const conflictByUser = username ? seenUsernames.get(username) : undefined;
    const conflictByName = cleanName && !cleanName.includes('학생') ? seenCleanNames.get(cleanName) : undefined;

    // A student is a duplicate if they share the exact student number, username, or real student name
    const conflict = conflictByNum || conflictByUser || conflictByName;

    if (conflict && conflict.id !== st.id) {
      const conflictScore = getStudentActivityScore(conflict);
      const currentScore = getStudentActivityScore(st);

      if (currentScore > conflictScore) {
        // Current student is more active/valuable! Replace the previous conflict
        duplicateIds.push(conflict.id);
        duplicateStudents.push(conflict);
        seenIds.delete(conflict.id);

        const conflictIdx = uniqueList.findIndex(s => s.id === conflict.id);
        if (conflictIdx !== -1) {
          uniqueList[conflictIdx] = st;
        } else {
          uniqueList.push(st);
        }

        seenIds.add(st.id);
        if (!isNaN(num) && num > 0) seenNumbers.set(num, st);
        if (username) seenUsernames.set(username, st);
        if (cleanName) seenCleanNames.set(cleanName, st);
      } else {
        // Existing conflict is better or equal; mark current student as duplicate
        duplicateIds.push(st.id);
        duplicateStudents.push(st);
      }
    } else {
      // Unique student!
      seenIds.add(st.id);
      if (!isNaN(num) && num > 0) seenNumbers.set(num, st);
      if (username) seenUsernames.set(username, st);
      if (cleanName) seenCleanNames.set(cleanName, st);
      uniqueList.push(st);
    }
  }

  // Sort unique students neatly by number
  uniqueList.sort((a, b) => (a.number || 0) - (b.number || 0));

  return {
    unique: uniqueList,
    duplicateIds,
    duplicateStudents
  };
}
