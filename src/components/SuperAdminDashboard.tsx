import React, { useEffect, useMemo, useState } from 'react';
import { useClassEconomy, normalizeClassCode } from '../context/ClassEconomyContext';
import { ClassEconomyState, Student, TeacherAccount } from '../types';
import { initialClassState, initialNewsArticles, initialShopItems, initialStocks, initialStudents } from '../data/initialData';
import {
  SuperAdminClassSummary,
  deleteClassCompletelyFromFirestore,
  deleteTeacherFromFirestore,
  fetchAllClassesFromFirestore,
  fetchAllTeachersFromFirestore,
  fetchClassFullSnapshotFromFirestore,
  fetchClassStudentsForSuperAdmin,
  isClassCodeTakenInFirestore,
  saveMultipleStudentsToFirestore,
  saveTeacherToFirestore,
  syncClassToFirestore,
  updateTeacherPasswordInFirestore
} from '../lib/firebase';

const generateClassCode = () => `C-${Math.floor(10000 + Math.random() * 90000)}`;
const generateTempPassword = () => {
  const digits = Math.floor(1000 + Math.random() * 9000);
  return `kids${digits}!`;
};

export const SuperAdminDashboard: React.FC = () => {
  const { impersonateClassAsTeacher, logout } = useClassEconomy();

  const [teachers, setTeachers] = useState<TeacherAccount[]>([]);
  const [classes, setClasses] = useState<SuperAdminClassSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [revealedPasswords, setRevealedPasswords] = useState<Record<string, boolean>>({});
  const [toastMsg, setToastMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Delivery (전달하기) modal state
  const [shareTarget, setShareTarget] = useState<TeacherAccount | null>(null);
  const [shareIncludePassword, setShareIncludePassword] = useState(true);
  const [shareIncludeStudentLink, setShareIncludeStudentLink] = useState(true);
  const [shareCustomNote, setShareCustomNote] = useState('');
  const [shareCopied, setShareCopied] = useState(false);

  // Create new teacher modal state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState(() => generateTempPassword());
  const [newSchoolName, setNewSchoolName] = useState('');
  const [newGrade, setNewGrade] = useState('');
  const [newClassNum, setNewClassNum] = useState('');
  const [newClassName, setNewClassName] = useState('우리반');
  const [newClassCode, setNewClassCode] = useState(() => generateClassCode());
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState('');

  // Edit / Password Reset modal state
  const [editTarget, setEditTarget] = useState<TeacherAccount | null>(null);
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editPassword, setEditPassword] = useState('');
  const [editSchool, setEditSchool] = useState('');
  const [editGrade, setEditGrade] = useState('');
  const [editClassNum, setEditClassNum] = useState('');
  const [editClassName, setEditClassName] = useState('');
  const [editClassCode, setEditClassCode] = useState('');
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  // Student list & PIN modal state
  const [studentModalClass, setStudentModalClass] = useState<{ classCode: string; className: string } | null>(null);
  const [studentModalList, setStudentModalList] = useState<Student[]>([]);
  const [isLoadingStudents, setIsLoadingStudents] = useState(false);

  // Delete confirmation modal state
  const [deleteTarget, setDeleteTarget] = useState<{
    kind: 'teacher' | 'class';
    teacher?: TeacherAccount;
    classCode: string;
    label: string;
  } | null>(null);
  const [alsoDeleteClass, setAlsoDeleteClass] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const appBaseUrl = useMemo(() => {
    if (typeof window === 'undefined') return '';
    return `${window.location.origin}${window.location.pathname}`;
  }, []);

  const showToast = (type: 'success' | 'error', text: string) => {
    setToastMsg({ type, text });
    setTimeout(() => {
      setToastMsg(prev => (prev?.text === text ? null : prev));
    }, 3500);
  };

  const copyText = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      showToast('success', `${label} 클립보드에 복사되었습니다.`);
    } catch {
      showToast('error', '클립보드 복사에 실패했습니다. 직접 드래그해 복사해 주세요.');
    }
  };

  const loadDirectory = async () => {
    setIsLoading(true);
    try {
      const [remoteTeachers, remoteClasses] = await Promise.all([
        fetchAllTeachersFromFirestore(),
        fetchAllClassesFromFirestore()
      ]);

      // Merge any local cached teachers that might not have synced yet
      let mergedTeachers = [...remoteTeachers];
      try {
        const localStr = localStorage.getItem('kidsrich_teachers');
        if (localStr) {
          const localList: TeacherAccount[] = JSON.parse(localStr);
          if (Array.isArray(localList)) {
            for (const lt of localList) {
              const exists = mergedTeachers.some(
                rt =>
                  (rt.teacherId && lt.teacherId && rt.teacherId === lt.teacherId) ||
                  (rt.email && lt.email && rt.email.toLowerCase() === lt.email.toLowerCase())
              );
              if (!exists && (lt.email || lt.name)) {
                mergedTeachers.push(lt);
              }
            }
          }
        }
      } catch {}

      setTeachers(mergedTeachers);
      setClasses(remoteClasses);
    } catch {
      showToast('error', '데이터를 불러오는 중 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadDirectory();
  }, []);

  const classMap = useMemo(() => {
    const map = new Map<string, SuperAdminClassSummary>();
    for (const c of classes) {
      map.set(normalizeClassCode(c.classCode) || c.classCode, c);
    }
    return map;
  }, [classes]);

  const orphanClasses = useMemo(() => {
    const assignedCodes = new Set(teachers.map(t => normalizeClassCode(t.classCode) || t.classCode));
    return classes.filter(c => !assignedCodes.has(normalizeClassCode(c.classCode) || c.classCode));
  }, [teachers, classes]);

  const filteredTeachers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return teachers;
    return teachers.filter(t => {
      return (
        (t.name || '').toLowerCase().includes(q) ||
        (t.email || '').toLowerCase().includes(q) ||
        (t.teacherId || '').toLowerCase().includes(q) ||
        (t.classCode || '').toLowerCase().includes(q) ||
        (t.className || '').toLowerCase().includes(q) ||
        (t.schoolName || '').toLowerCase().includes(q)
      );
    });
  }, [teachers, searchQuery]);

  const filteredOrphanClasses = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return orphanClasses;
    return orphanClasses.filter(c => {
      return (
        (c.classCode || '').toLowerCase().includes(q) ||
        (c.className || '').toLowerCase().includes(q) ||
        (c.teacherName || '').toLowerCase().includes(q) ||
        (c.teacherEmail || '').toLowerCase().includes(q)
      );
    });
  }, [orphanClasses, searchQuery]);

  const buildShareMessage = (teacher: TeacherAccount) => {
    const studentLink = `${appBaseUrl}?class=${encodeURIComponent(teacher.classCode)}`;
    const schoolInfo = [teacher.schoolName, teacher.grade ? `${teacher.grade}학년` : '', teacher.classNum ? `${teacher.classNum}반` : '']
      .filter(Boolean)
      .join(' ');
    const lines = [
      `[키즈리치 스쿨 교사 접속 안내]`,
      ``,
      `• 접속 주소: ${appBaseUrl}`,
      `• 교사 성함: ${teacher.name || '선생님'} 선생님`,
      ...(schoolInfo ? [`• 소속 학급: ${schoolInfo} (${teacher.className || '우리반'})`] : [`• 학급명: ${teacher.className || '우리반'}`]),
      `• 교사 아이디: ${teacher.email || teacher.teacherId}`,
      ...(shareIncludePassword ? [`• 비밀번호: ${teacher.password || '(미설정 — 비밀번호 재설정 필요)'}`] : []),
      `• 학급 코드: ${teacher.classCode}`,
      ...(shareIncludeStudentLink ? [``, `• 학생 초대 링크: ${studentLink}`] : []),
      ...(shareCustomNote.trim() ? [``, `📌 안내 메모: ${shareCustomNote.trim()}`] : []),
      ``,
      `※ 위 접속 주소에서 [교사 전용] ➔ [교사 로그인]으로 들어가시면 됩니다.`
    ];
    return lines.join('\n');
  };

  const openShareModal = (teacher: TeacherAccount) => {
    setShareTarget(teacher);
    setShareIncludePassword(true);
    setShareIncludeStudentLink(true);
    setShareCustomNote('');
    setShareCopied(false);
  };

  const openCreateModal = (prefillClass?: SuperAdminClassSummary) => {
    setNewName(prefillClass?.teacherName || '');
    setNewEmail(prefillClass?.teacherEmail || '');
    setNewPassword(generateTempPassword());
    setNewSchoolName('');
    setNewGrade('');
    setNewClassNum('');
    setNewClassName(prefillClass?.className || '우리반');
    setNewClassCode(prefillClass?.classCode || generateClassCode());
    setCreateError('');
    setIsCreateModalOpen(true);
  };

  const handleCreateTeacherSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError('');
    if (!newName.trim() || !newEmail.trim()) {
      setCreateError('선생님 성함과 아이디(이메일)를 입력해 주세요.');
      return;
    }
    const cleanEmail = newEmail.trim();
    const cleanCode = normalizeClassCode(newClassCode) || generateClassCode();
    const duplicateTeacher = teachers.find(
      t => (t.email && t.email.toLowerCase() === cleanEmail.toLowerCase()) || t.teacherId === cleanEmail.replace(/[@.]/g, '_')
    );
    if (duplicateTeacher) {
      setCreateError('이미 동일한 아이디(이메일)로 등록된 선생님이 있습니다.');
      return;
    }

    setIsCreating(true);
    try {
      const classAlreadyExists = classes.some(c => (normalizeClassCode(c.classCode) || c.classCode) === cleanCode) ||
        (await isClassCodeTakenInFirestore(cleanCode));

      const teacherObj: TeacherAccount = {
        teacherId: cleanEmail.replace(/[@.]/g, '_'),
        name: newName.trim(),
        email: cleanEmail,
        password: newPassword.trim(),
        schoolName: newSchoolName.trim(),
        grade: newGrade.trim(),
        classNum: newClassNum.trim(),
        classCode: cleanCode,
        className: newClassName.trim() || '우리반',
        createdAt: new Date().toISOString()
      };

      await saveTeacherToFirestore(teacherObj);

      // Only seed initial class + students if this classCode does not already exist in Firestore
      if (!classAlreadyExists) {
        const safePrefix = cleanCode.replace(/[^a-zA-Z0-9]/g, '_');
        const seedStudents: Student[] = initialStudents.map((s, idx) => ({
          ...s,
          id: `student_${safePrefix}_${idx + 1}`,
          number: idx + 1,
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

        const newClassState: ClassEconomyState = {
          ...initialClassState,
          classCode: cleanCode,
          className: teacherObj.className,
          teacherName: teacherObj.name,
          teacherEmail: teacherObj.email,
          newsArticles: initialNewsArticles,
          stocks: initialStocks,
          shopItems: initialShopItems,
          students: seedStudents,
          scheduledScenarios: [],
          transactions: []
        };
        await syncClassToFirestore(newClassState);
        await saveMultipleStudentsToFirestore(cleanCode, seedStudents);
      }

      // Update local cache too
      try {
        const savedStr = localStorage.getItem('kidsrich_teachers');
        const list: TeacherAccount[] = savedStr ? JSON.parse(savedStr) : [];
        list.push(teacherObj);
        localStorage.setItem('kidsrich_teachers', JSON.stringify(list));
      } catch {}

      setIsCreateModalOpen(false);
      await loadDirectory();
      showToast('success', `${teacherObj.name} 선생님 계정이 발급되었습니다.`);
      openShareModal(teacherObj);
    } catch (err: any) {
      setCreateError('계정 발급 중 오류가 발생했습니다: ' + (err?.message || '알 수 없는 오류'));
    } finally {
      setIsCreating(false);
    }
  };

  const openEditModal = (teacher: TeacherAccount) => {
    setEditTarget(teacher);
    setEditName(teacher.name || '');
    setEditEmail(teacher.email || '');
    setEditPassword(teacher.password || '');
    setEditSchool(teacher.schoolName || '');
    setEditGrade(teacher.grade || '');
    setEditClassNum(teacher.classNum || '');
    setEditClassName(teacher.className || '우리반');
    setEditClassCode(teacher.classCode || '');
  };

  const handleSaveEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editTarget) return;
    if (!editName.trim() || !editEmail.trim()) {
      showToast('error', '성함과 아이디(이메일)는 비워둘 수 없습니다.');
      return;
    }

    setIsSavingEdit(true);
    try {
      const updatedTeacher: TeacherAccount = {
        ...editTarget,
        name: editName.trim(),
        email: editEmail.trim(),
        password: editPassword.trim(),
        schoolName: editSchool.trim(),
        grade: editGrade.trim(),
        classNum: editClassNum.trim(),
        className: editClassName.trim() || '우리반',
        classCode: normalizeClassCode(editClassCode) || editTarget.classCode
      };

      await saveTeacherToFirestore(updatedTeacher);
      if (editPassword.trim()) {
        await updateTeacherPasswordInFirestore(updatedTeacher.teacherId || updatedTeacher.email, editPassword.trim());
      }

      try {
        const savedStr = localStorage.getItem('kidsrich_teachers');
        const list: TeacherAccount[] = savedStr ? JSON.parse(savedStr) : [];
        const idx = list.findIndex(t => t.teacherId === updatedTeacher.teacherId || t.email === editTarget.email);
        if (idx >= 0) list[idx] = updatedTeacher;
        else list.push(updatedTeacher);
        localStorage.setItem('kidsrich_teachers', JSON.stringify(list));
      } catch {}

      setEditTarget(null);
      await loadDirectory();
      showToast('success', `${updatedTeacher.name} 선생님 정보가 저장되었습니다.`);
    } catch {
      showToast('error', '정보 수정 중 오류가 발생했습니다.');
    } finally {
      setIsSavingEdit(false);
    }
  };

  const openStudentModal = async (classCode: string, className: string) => {
    setStudentModalClass({ classCode, className });
    setStudentModalList([]);
    setIsLoadingStudents(true);
    try {
      const list = await fetchClassStudentsForSuperAdmin(classCode);
      setStudentModalList(list);
    } catch {
      showToast('error', '학생 명단을 불러오지 못했습니다.');
    } finally {
      setIsLoadingStudents(false);
    }
  };

  const handleDownloadClassBackup = async (classCode: string) => {
    try {
      showToast('success', `${classCode} 백업 데이터를 수집 중입니다...`);
      const snap = await fetchClassFullSnapshotFromFirestore(classCode);
      const payload = {
        backupVersion: 2,
        exportedAt: new Date().toISOString(),
        exportedBy: 'super_admin',
        state: {
          ...initialClassState,
          ...(snap.classState || {}),
          classCode,
          students: snap.students,
          transactions: snap.transactions
        }
      };
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const dateStr = new Date().toISOString().slice(0, 10);
      link.setAttribute('download', `kidsrich_backup_${classCode}_${dateStr}.json`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      showToast('success', `${classCode} 백업 파일 다운로드 완료!`);
    } catch {
      showToast('error', '백업 파일 생성 중 오류가 발생했습니다.');
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget || isDeleting) return;
    setIsDeleting(true);
    try {
      if (deleteTarget.kind === 'teacher' && deleteTarget.teacher) {
        const tid = deleteTarget.teacher.teacherId || deleteTarget.teacher.email;
        await deleteTeacherFromFirestore(tid);
        try {
          const savedStr = localStorage.getItem('kidsrich_teachers');
          if (savedStr) {
            const list: TeacherAccount[] = JSON.parse(savedStr);
            const filtered = list.filter(
              t => t.teacherId !== tid && t.email !== deleteTarget.teacher?.email
            );
            localStorage.setItem('kidsrich_teachers', JSON.stringify(filtered));
          }
        } catch {}
        if (alsoDeleteClass && deleteTarget.classCode) {
          await deleteClassCompletelyFromFirestore(deleteTarget.classCode);
        }
      } else if (deleteTarget.kind === 'class') {
        await deleteClassCompletelyFromFirestore(deleteTarget.classCode);
      }
      setDeleteTarget(null);
      setAlsoDeleteClass(false);
      await loadDirectory();
      showToast('success', '선택한 항목이 삭제되었습니다.');
    } catch {
      showToast('error', '삭제 처리 중 오류가 발생했습니다.');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="bg-[#f5f2ed] text-[#1a1a1a] min-h-screen flex flex-col font-sans antialiased">
      {/* Top Bar */}
      <header className="bg-[#1a1a1a] text-white sticky top-0 z-40 border-b border-stone-800 shadow-sm">
        <div className="max-w-[1360px] mx-auto px-4 md:px-8 h-16 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-9 w-9 bg-amber-400 text-[#1a1a1a] rounded-2xs flex items-center justify-center font-editorial font-bold italic text-lg shrink-0">
              K
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-editorial text-lg font-bold italic tracking-wide truncate">Kids Rich</span>
                <span className="text-[10px] font-bold uppercase tracking-widest bg-amber-400 text-[#1a1a1a] px-2 py-0.5 rounded-2xs shrink-0">
                  통합 관리자
                </span>
              </div>
              <p className="text-[11px] text-stone-400 truncate">skyhwg0516@gmail.com · 전체 교사/학급/코드 총괄 센터</p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => openCreateModal()}
              className="px-3.5 py-2 bg-amber-400 hover:bg-amber-300 text-[#1a1a1a] font-bold text-xs rounded-2xs transition-colors flex items-center gap-1.5 shadow-xs"
            >
              <span className="material-symbols-outlined text-[17px]">person_add</span>
              <span>교사 계정 신규 발급</span>
            </button>
            <button
              type="button"
              onClick={loadDirectory}
              disabled={isLoading}
              className="px-3 py-2 bg-stone-800 hover:bg-stone-700 text-stone-100 font-bold text-xs rounded-2xs border border-stone-700 transition-colors flex items-center gap-1 disabled:opacity-50"
            >
              <span className={`material-symbols-outlined text-[16px] ${isLoading ? 'animate-spin' : ''}`}>refresh</span>
              <span className="hidden sm:inline">새로고침</span>
            </button>
            <button
              type="button"
              onClick={logout}
              className="px-3 py-2 bg-stone-900 hover:bg-red-950 text-stone-300 hover:text-red-200 font-bold text-xs rounded-2xs border border-stone-700 transition-colors flex items-center gap-1"
            >
              <span className="material-symbols-outlined text-[16px]">logout</span>
              <span className="hidden sm:inline">로그아웃</span>
            </button>
          </div>
        </div>
      </header>

      {/* Toast Notification */}
      {toastMsg && (
        <div className="fixed bottom-5 right-5 z-50 max-w-sm">
          <div
            className={`px-4 py-3 rounded-sm shadow-xl border text-xs font-bold flex items-center gap-2 ${
              toastMsg.type === 'success'
                ? 'bg-emerald-900 text-white border-emerald-700'
                : 'bg-red-900 text-white border-red-700'
            }`}
          >
            <span className="material-symbols-outlined text-[18px]">
              {toastMsg.type === 'success' ? 'check_circle' : 'error'}
            </span>
            <span>{toastMsg.text}</span>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="max-w-[1360px] w-full mx-auto px-4 md:px-8 py-6 md:py-8 space-y-6 flex-1">
        {/* KPI Overview & Quick Share URL */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white border border-[#1a1a1a]/15 rounded-sm p-5 shadow-2xs">
            <div className="text-[11px] font-bold uppercase tracking-wider text-[#1a1a1a]/55">등록된 전체 교사</div>
            <div className="mt-1.5 flex items-baseline gap-2">
              <span className="text-3xl font-extrabold font-mono text-[#1a1a1a]">{teachers.length}</span>
              <span className="text-xs font-semibold text-[#1a1a1a]/60">명</span>
            </div>
            <p className="text-[11px] text-[#1a1a1a]/60 mt-1">모든 기기·학교에서 가입한 교사 계정 포함</p>
          </div>

          <div className="bg-white border border-[#1a1a1a]/15 rounded-sm p-5 shadow-2xs">
            <div className="text-[11px] font-bold uppercase tracking-wider text-[#1a1a1a]/55">개설된 전체 학급</div>
            <div className="mt-1.5 flex items-baseline gap-2">
              <span className="text-3xl font-extrabold font-mono text-emerald-800">{classes.length}</span>
              <span className="text-xs font-semibold text-[#1a1a1a]/60">개 반</span>
            </div>
            <p className="text-[11px] text-[#1a1a1a]/60 mt-1">
              {orphanClasses.length > 0 ? `교사 미연결 학급 ${orphanClasses.length}개 포함` : '모든 학급이 교사 계정과 연결됨'}
            </p>
          </div>

          <div className="bg-[#faf8f5] border border-[#1a1a1a]/15 rounded-sm p-5 shadow-2xs flex flex-col justify-between">
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wider text-[#1a1a1a]/55">현재 서비스 접속 주소</div>
              <div className="mt-1.5 text-xs font-mono text-[#1a1a1a] break-all bg-white border border-[#1a1a1a]/10 px-2.5 py-1.5 rounded-2xs">
                {appBaseUrl}
              </div>
            </div>
            <button
              type="button"
              onClick={() => copyText(appBaseUrl, '사이트 접속 주소가')}
              className="mt-2.5 self-start px-3 py-1.5 bg-[#1a1a1a] hover:bg-stone-800 text-white text-[11px] font-bold rounded-2xs flex items-center gap-1 transition-colors"
            >
              <span className="material-symbols-outlined text-[14px]">content_copy</span>
              <span>접속 주소 복사</span>
            </button>
          </div>
        </div>

        {/* Search & Filter */}
        <div className="bg-white border border-[#1a1a1a]/15 rounded-sm p-4 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="relative flex-1">
            <span className="material-symbols-outlined text-[#1a1a1a]/45 text-[20px] absolute left-3 top-1/2 -translate-y-1/2">
              search
            </span>
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="선생님 성함, 아이디/이메일, 학교명, 학급명 또는 학급 코드(예: C-10001) 검색..."
              className="w-full pl-10 pr-4 py-2.5 text-sm bg-[#faf8f5] border border-[#1a1a1a]/15 rounded-2xs focus:outline-none focus:border-[#1a1a1a]"
            />
          </div>
          <div className="text-xs text-[#1a1a1a]/65 font-medium shrink-0">
            검색 결과: <strong className="text-[#1a1a1a]">{filteredTeachers.length}</strong>명의 교사 ·{' '}
            <strong className="text-[#1a1a1a]">{filteredOrphanClasses.length}</strong>개 미연결 학급
          </div>
        </div>

        {/* Teacher Accounts Directory */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-editorial text-xl font-bold text-[#1a1a1a] flex items-center gap-2">
              <span>👩‍🏫 등록된 교사 계정 및 학급 코드 목록</span>
            </h2>
          </div>

          {isLoading ? (
            <div className="bg-white border border-[#1a1a1a]/15 rounded-sm p-10 text-center text-sm text-[#1a1a1a]/60">
              클라우드에서 전체 교사 및 학급 목록을 불러오는 중입니다...
            </div>
          ) : filteredTeachers.length === 0 ? (
            <div className="bg-white border border-[#1a1a1a]/15 rounded-sm p-10 text-center space-y-3">
              <p className="text-sm font-semibold text-[#1a1a1a]/70">
                {searchQuery ? '검색 조건과 일치하는 교사 계정이 없습니다.' : '아직 등록된 교사 계정이 없습니다.'}
              </p>
              <button
                type="button"
                onClick={() => openCreateModal()}
                className="px-4 py-2 bg-[#1a1a1a] text-white text-xs font-bold rounded-2xs hover:bg-stone-800 transition-colors"
              >
                + 첫 번째 교사 계정 발급하기
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {filteredTeachers.map((teacher) => {
                const key = teacher.teacherId || teacher.email;
                const normCode = normalizeClassCode(teacher.classCode) || teacher.classCode;
                const clsInfo = classMap.get(normCode);
                const isPwShown = !!revealedPasswords[key];
                const schoolText = [teacher.schoolName, teacher.grade ? `${teacher.grade}학년` : '', teacher.classNum ? `${teacher.classNum}반` : '']
                  .filter(Boolean)
                  .join(' ');

                return (
                  <div key={key} className="bg-white border border-[#1a1a1a]/15 rounded-sm p-5 shadow-2xs flex flex-col justify-between gap-4">
                    <div className="space-y-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="text-base font-extrabold text-[#1a1a1a]">{teacher.name || '선생님'}</h3>
                            <span className="px-2 py-0.5 text-[11px] font-bold bg-stone-100 border border-stone-300 rounded-2xs text-stone-800">
                              {teacher.className || clsInfo?.className || '우리반'}
                            </span>
                            {clsInfo && (
                              <span className="px-2 py-0.5 text-[11px] font-mono font-bold bg-emerald-50 border border-emerald-200 rounded-2xs text-emerald-900">
                                Round {clsInfo.currentRound}/{clsInfo.totalRounds}
                              </span>
                            )}
                          </div>
                          {schoolText && (
                            <p className="text-xs text-[#1a1a1a]/65 mt-0.5">{schoolText}</p>
                          )}
                        </div>

                        <button
                          type="button"
                          onClick={() => openShareModal(teacher)}
                          className="px-3 py-1.5 bg-[#005da7] hover:bg-[#004883] text-white text-xs font-bold rounded-2xs shadow-2xs flex items-center gap-1 shrink-0 transition-colors"
                          title="아이디·비밀번호·학급코드를 복사해서 전달합니다"
                        >
                          <span className="material-symbols-outlined text-[15px]">send</span>
                          <span>전달하기</span>
                        </button>
                      </div>

                      {/* Credentials Box */}
                      <div className="bg-[#faf8f5] border border-[#1a1a1a]/10 rounded-2xs p-3.5 space-y-2 text-xs">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[#1a1a1a]/60 font-medium shrink-0">교사 아이디</span>
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span className="font-mono font-bold text-[#1a1a1a] truncate">{teacher.email || teacher.teacherId}</span>
                            <button
                              type="button"
                              onClick={() => copyText(teacher.email || teacher.teacherId, '교사 아이디가')}
                              className="p-1 text-[#1a1a1a]/50 hover:text-[#1a1a1a] rounded"
                              title="아이디 복사"
                            >
                              <span className="material-symbols-outlined text-[15px]">content_copy</span>
                            </button>
                          </div>
                        </div>

                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[#1a1a1a]/60 font-medium shrink-0">비밀번호</span>
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span className="font-mono font-bold text-[#1a1a1a]">
                              {teacher.password
                                ? isPwShown
                                  ? teacher.password
                                  : '••••••••'
                                : '(미설정)'}
                            </span>
                            {teacher.password && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => setRevealedPasswords(prev => ({ ...prev, [key]: !prev[key] }))}
                                  className="p-1 text-[#1a1a1a]/50 hover:text-[#1a1a1a] rounded"
                                  title={isPwShown ? '비밀번호 숨기기' : '비밀번호 보기'}
                                >
                                  <span className="material-symbols-outlined text-[15px]">
                                    {isPwShown ? 'visibility_off' : 'visibility'}
                                  </span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => copyText(teacher.password || '', '비밀번호가')}
                                  className="p-1 text-[#1a1a1a]/50 hover:text-[#1a1a1a] rounded"
                                  title="비밀번호 복사"
                                >
                                  <span className="material-symbols-outlined text-[15px]">content_copy</span>
                                </button>
                              </>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[#1a1a1a]/60 font-medium shrink-0">학급 코드</span>
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono font-extrabold text-blue-900 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-2xs">
                              {teacher.classCode}
                            </span>
                            <button
                              type="button"
                              onClick={() => copyText(teacher.classCode, '학급 코드가')}
                              className="p-1 text-[#1a1a1a]/50 hover:text-[#1a1a1a] rounded"
                              title="학급 코드 복사"
                            >
                              <span className="material-symbols-outlined text-[15px]">content_copy</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Action Bar */}
                    <div className="pt-2 border-t border-[#1a1a1a]/10 flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap gap-1.5">
                        <button
                          type="button"
                          onClick={() => impersonateClassAsTeacher(teacher)}
                          className="px-2.5 py-1.5 bg-[#1a1a1a] hover:bg-stone-800 text-white text-[11px] font-bold rounded-2xs flex items-center gap-1 transition-colors"
                        >
                          <span className="material-symbols-outlined text-[14px]">login</span>
                          <span>학급 들어가기</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => openStudentModal(teacher.classCode, teacher.className || '우리반')}
                          className="px-2.5 py-1.5 bg-white hover:bg-stone-100 border border-[#1a1a1a]/20 text-[#1a1a1a] text-[11px] font-bold rounded-2xs flex items-center gap-1 transition-colors"
                        >
                          <span className="material-symbols-outlined text-[14px]">groups</span>
                          <span>학생 명단/PIN</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDownloadClassBackup(teacher.classCode)}
                          className="px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 text-emerald-900 text-[11px] font-bold rounded-2xs flex items-center gap-1 transition-colors"
                        >
                          <span className="material-symbols-outlined text-[14px]">download</span>
                          <span>JSON 백업</span>
                        </button>
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => openEditModal(teacher)}
                          className="px-2.5 py-1.5 bg-amber-50 hover:bg-amber-100 border border-amber-300 text-amber-950 text-[11px] font-bold rounded-2xs transition-colors"
                        >
                          수정 / 비번변경
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setAlsoDeleteClass(false);
                            setDeleteTarget({
                              kind: 'teacher',
                              teacher,
                              classCode: teacher.classCode,
                              label: `${teacher.name} (${teacher.email})`
                            });
                          }}
                          className="px-2 py-1.5 text-red-700 hover:bg-red-50 text-[11px] font-bold rounded-2xs transition-colors"
                        >
                          삭제
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Orphan / Standalone Classes Section (e.g. C-10001 or restored classes without teacher doc) */}
        {filteredOrphanClasses.length > 0 && (
          <section className="space-y-3 pt-4 border-t border-[#1a1a1a]/15">
            <div>
              <h2 className="font-editorial text-lg font-bold text-[#1a1a1a]">
                🏫 교사 계정 미연결 학급 ({filteredOrphanClasses.length}개)
              </h2>
              <p className="text-xs text-[#1a1a1a]/65 mt-0.5">
                기본 학급(`C-10001`)이나 백업 복원으로 생성되었지만 아직 개별 교사 계정이 연결되지 않은 학급입니다. 교사 계정을 발급해 전달할 수 있습니다.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredOrphanClasses.map((cls) => (
                <div key={cls.classCode} className="bg-white border border-dashed border-[#1a1a1a]/25 rounded-sm p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-extrabold text-xs bg-blue-50 text-blue-900 border border-blue-200 px-2 py-0.5 rounded-2xs">
                          {cls.classCode}
                        </span>
                        <span className="font-bold text-sm text-[#1a1a1a]">{cls.className}</span>
                      </div>
                      <p className="text-[11px] text-[#1a1a1a]/60 mt-1">
                        Round {cls.currentRound}/{cls.totalRounds} · {cls.teacherName || '담당 교사 미지정'}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => openCreateModal(cls)}
                      className="px-2.5 py-1.5 bg-[#005da7] hover:bg-[#004883] text-white text-[11px] font-bold rounded-2xs shrink-0"
                    >
                      교사 계정 발급
                    </button>
                  </div>

                  <div className="flex flex-wrap gap-1.5 pt-2 border-t border-[#1a1a1a]/10">
                    <button
                      type="button"
                      onClick={() =>
                        impersonateClassAsTeacher({
                          classCode: cls.classCode,
                          className: cls.className,
                          name: cls.teacherName || '선생님',
                          email: cls.teacherEmail || 'teacher@school.kr'
                        })
                      }
                      className="px-2.5 py-1.5 bg-[#1a1a1a] text-white text-[11px] font-bold rounded-2xs hover:bg-stone-800"
                    >
                      학급 들어가기
                    </button>
                    <button
                      type="button"
                      onClick={() => openStudentModal(cls.classCode, cls.className)}
                      className="px-2.5 py-1.5 bg-white border border-[#1a1a1a]/20 text-[11px] font-bold rounded-2xs hover:bg-stone-100"
                    >
                      학생/PIN 보기
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDownloadClassBackup(cls.classCode)}
                      className="px-2.5 py-1.5 bg-emerald-50 border border-emerald-300 text-emerald-900 text-[11px] font-bold rounded-2xs hover:bg-emerald-100"
                    >
                      백업
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setDeleteTarget({
                          kind: 'class',
                          classCode: cls.classCode,
                          label: `${cls.className} (${cls.classCode})`
                        })
                      }
                      className="px-2 py-1.5 text-red-700 hover:bg-red-50 text-[11px] font-bold rounded-2xs ml-auto"
                    >
                      삭제
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
      </main>

      {/* ---------------- MODAL 1: SHARE CREDENTIALS (전달하기) ---------------- */}
      {shareTarget && (
        <div className="fixed inset-0 z-50 bg-black/55 backdrop-blur-[1px] flex items-center justify-center p-4">
          <div className="bg-white border border-[#1a1a1a]/20 rounded-sm shadow-2xl max-w-lg w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-base font-extrabold text-[#1a1a1a] flex items-center gap-2">
                  <span className="material-symbols-outlined text-[#005da7]">send</span>
                  <span>교사 계정 & 학급 코드 전달하기</span>
                </h3>
                <p className="text-xs text-[#1a1a1a]/65 mt-1">
                  <strong>{shareTarget.name}</strong> 선생님께 보낼 안내 메시지를 복사하거나 이메일로 바로 전송하세요.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShareTarget(null)}
                className="text-stone-400 hover:text-stone-800 p-1"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            {/* Individual Quick Copy Chips */}
            <div className="grid grid-cols-3 gap-2 text-xs">
              <button
                type="button"
                onClick={() => copyText(shareTarget.email || shareTarget.teacherId, '아이디가')}
                className="p-2 bg-[#faf8f5] hover:bg-stone-100 border border-[#1a1a1a]/15 rounded-2xs text-left"
              >
                <div className="text-[10px] text-[#1a1a1a]/55">아이디 복사</div>
                <div className="font-mono font-bold truncate mt-0.5">{shareTarget.email || shareTarget.teacherId}</div>
              </button>
              <button
                type="button"
                onClick={() => copyText(shareTarget.password || '', '비밀번호가')}
                className="p-2 bg-[#faf8f5] hover:bg-stone-100 border border-[#1a1a1a]/15 rounded-2xs text-left"
              >
                <div className="text-[10px] text-[#1a1a1a]/55">비밀번호 복사</div>
                <div className="font-mono font-bold truncate mt-0.5">{shareTarget.password || '미설정'}</div>
              </button>
              <button
                type="button"
                onClick={() => copyText(shareTarget.classCode, '학급 코드가')}
                className="p-2 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-2xs text-left"
              >
                <div className="text-[10px] text-blue-700">학급 코드 복사</div>
                <div className="font-mono font-extrabold text-blue-950 truncate mt-0.5">{shareTarget.classCode}</div>
              </button>
            </div>

            {/* Options */}
            <div className="flex flex-wrap gap-4 text-xs pt-1">
              <label className="flex items-center gap-1.5 cursor-pointer font-semibold">
                <input
                  type="checkbox"
                  checked={shareIncludePassword}
                  onChange={e => setShareIncludePassword(e.target.checked)}
                />
                <span>안내문에 비밀번호 포함</span>
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer font-semibold">
                <input
                  type="checkbox"
                  checked={shareIncludeStudentLink}
                  onChange={e => setShareIncludeStudentLink(e.target.checked)}
                />
                <span>학생 초대 링크 포함</span>
              </label>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-[#1a1a1a]/70 mb-1">
                추가 전달 메모 (선택 사항)
              </label>
              <input
                type="text"
                value={shareCustomNote}
                onChange={e => setShareCustomNote(e.target.value)}
                placeholder="예: 첫 접속 후 원하시면 비밀번호를 변경해 주세요."
                className="w-full px-3 py-2 text-xs border border-[#1a1a1a]/20 rounded-2xs bg-[#faf8f5] focus:outline-none focus:border-[#1a1a1a]"
              />
            </div>

            {/* Formatted Message Preview */}
            <div>
              <label className="block text-[11px] font-bold text-[#1a1a1a]/70 mb-1">
                전달용 메시지 미리보기
              </label>
              <textarea
                readOnly
                rows={10}
                value={buildShareMessage(shareTarget)}
                className="w-full p-3 text-xs font-mono leading-relaxed bg-[#faf8f5] border border-[#1a1a1a]/20 rounded-2xs text-[#1a1a1a] focus:outline-none"
              />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-[#1a1a1a]/10">
              {shareTarget.email && shareTarget.email.includes('@') ? (
                <a
                  href={`mailto:${encodeURIComponent(shareTarget.email)}?subject=${encodeURIComponent('[키즈리치 스쿨] 교사 계정 및 학급 코드 안내')}&body=${encodeURIComponent(buildShareMessage(shareTarget))}`}
                  className="px-4 py-2.5 bg-white hover:bg-stone-100 border border-[#1a1a1a]/25 text-[#1a1a1a] text-xs font-bold rounded-2xs flex items-center gap-1.5 transition-colors"
                >
                  <span className="material-symbols-outlined text-[16px]">mail</span>
                  <span>이메일로 바로 보내기</span>
                </a>
              ) : (
                <div />
              )}

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setShareTarget(null)}
                  className="px-4 py-2.5 text-xs font-bold border border-[#1a1a1a]/20 rounded-2xs hover:bg-stone-100"
                >
                  닫기
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    await copyText(buildShareMessage(shareTarget), '전달용 안내 메시지가');
                    setShareCopied(true);
                    setTimeout(() => setShareCopied(false), 2500);
                  }}
                  className="px-5 py-2.5 bg-[#005da7] hover:bg-[#004883] text-white text-xs font-bold rounded-2xs shadow-2xs flex items-center gap-1.5 transition-colors"
                >
                  <span className="material-symbols-outlined text-[16px]">
                    {shareCopied ? 'check' : 'content_copy'}
                  </span>
                  <span>{shareCopied ? '복사 완료!' : '안내문 전체 복사 (카톡/문자용)'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ---------------- MODAL 2: CREATE NEW TEACHER ACCOUNT ---------------- */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/55 backdrop-blur-[1px] flex items-center justify-center p-4">
          <form
            onSubmit={handleCreateTeacherSubmit}
            className="bg-white border border-[#1a1a1a]/20 rounded-sm shadow-2xl max-w-lg w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-base font-extrabold text-[#1a1a1a]">교사 계정 및 학급 코드 신규 발급</h3>
                <p className="text-xs text-[#1a1a1a]/65 mt-1">
                  동료 선생님 계정을 직접 발급하고, 바로 카톡·이메일로 전달할 수 있습니다.
                </p>
              </div>
              <button type="button" onClick={() => setIsCreateModalOpen(false)} className="text-stone-400 hover:text-stone-800 p-1">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            {createError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-2xs text-xs text-red-800 font-semibold">
                {createError}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div>
                <label className="block font-bold mb-1">선생님 성함 *</label>
                <input
                  type="text"
                  required
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  placeholder="예: 홍길동"
                  className="w-full px-3 py-2 border border-[#1a1a1a]/20 rounded-2xs bg-[#faf8f5]"
                />
              </div>
              <div>
                <label className="block font-bold mb-1">교사 아이디 / 이메일 *</label>
                <input
                  type="text"
                  required
                  value={newEmail}
                  onChange={e => setNewEmail(e.target.value)}
                  placeholder="예: teacher02@school.kr"
                  className="w-full px-3 py-2 border border-[#1a1a1a]/20 rounded-2xs bg-[#faf8f5]"
                />
              </div>
              <div>
                <label className="block font-bold mb-1">초기 비밀번호</label>
                <div className="flex gap-1.5">
                  <input
                    type="text"
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                    className="w-full px-3 py-2 border border-[#1a1a1a]/20 rounded-2xs bg-[#faf8f5] font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setNewPassword(generateTempPassword())}
                    className="px-2.5 py-2 border border-[#1a1a1a]/20 rounded-2xs bg-stone-100 hover:bg-stone-200 font-bold shrink-0"
                  >
                    자동
                  </button>
                </div>
              </div>
              <div>
                <label className="block font-bold mb-1">학급 코드</label>
                <div className="flex gap-1.5">
                  <input
                    type="text"
                    value={newClassCode}
                    onChange={e => setNewClassCode(e.target.value)}
                    className="w-full px-3 py-2 border border-[#1a1a1a]/20 rounded-2xs bg-[#faf8f5] font-mono font-bold"
                  />
                  <button
                    type="button"
                    onClick={() => setNewClassCode(generateClassCode())}
                    className="px-2.5 py-2 border border-[#1a1a1a]/20 rounded-2xs bg-stone-100 hover:bg-stone-200 font-bold shrink-0"
                  >
                    새코드
                  </button>
                </div>
              </div>
              <div>
                <label className="block font-bold mb-1">학교명</label>
                <input
                  type="text"
                  value={newSchoolName}
                  onChange={e => setNewSchoolName(e.target.value)}
                  placeholder="예: 서울행복초"
                  className="w-full px-3 py-2 border border-[#1a1a1a]/20 rounded-2xs bg-[#faf8f5]"
                />
              </div>
              <div>
                <label className="block font-bold mb-1">학급명</label>
                <input
                  type="text"
                  value={newClassName}
                  onChange={e => setNewClassName(e.target.value)}
                  placeholder="예: 5학년 2반"
                  className="w-full px-3 py-2 border border-[#1a1a1a]/20 rounded-2xs bg-[#faf8f5]"
                />
              </div>
              <div>
                <label className="block font-bold mb-1">학년</label>
                <input
                  type="text"
                  value={newGrade}
                  onChange={e => setNewGrade(e.target.value)}
                  placeholder="예: 5"
                  className="w-full px-3 py-2 border border-[#1a1a1a]/20 rounded-2xs bg-[#faf8f5]"
                />
              </div>
              <div>
                <label className="block font-bold mb-1">반</label>
                <input
                  type="text"
                  value={newClassNum}
                  onChange={e => setNewClassNum(e.target.value)}
                  placeholder="예: 2"
                  className="w-full px-3 py-2 border border-[#1a1a1a]/20 rounded-2xs bg-[#faf8f5]"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-[#1a1a1a]/10">
              <button
                type="button"
                disabled={isCreating}
                onClick={() => setIsCreateModalOpen(false)}
                className="px-4 py-2 text-xs font-bold border border-[#1a1a1a]/20 rounded-2xs hover:bg-stone-100"
              >
                취소
              </button>
              <button
                type="submit"
                disabled={isCreating}
                className="px-5 py-2 text-xs font-bold bg-[#1a1a1a] hover:bg-stone-800 text-white rounded-2xs disabled:opacity-50"
              >
                {isCreating ? '발급 중...' : '계정 발급 & 전달창 열기'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ---------------- MODAL 3: EDIT TEACHER / RESET PASSWORD ---------------- */}
      {editTarget && (
        <div className="fixed inset-0 z-50 bg-black/55 backdrop-blur-[1px] flex items-center justify-center p-4">
          <form
            onSubmit={handleSaveEditSubmit}
            className="bg-white border border-[#1a1a1a]/20 rounded-sm shadow-2xl max-w-lg w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-base font-extrabold text-[#1a1a1a]">교사 정보 수정 및 비밀번호 재설정</h3>
                <p className="text-xs text-[#1a1a1a]/65 mt-1">수정 즉시 Firestore 클라우드에 반영됩니다.</p>
              </div>
              <button type="button" onClick={() => setEditTarget(null)} className="text-stone-400 hover:text-stone-800 p-1">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div>
                <label className="block font-bold mb-1">선생님 성함</label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={e => setEditName(e.target.value)}
                  className="w-full px-3 py-2 border border-[#1a1a1a]/20 rounded-2xs bg-[#faf8f5]"
                />
              </div>
              <div>
                <label className="block font-bold mb-1">교사 아이디 / 이메일</label>
                <input
                  type="text"
                  required
                  value={editEmail}
                  onChange={e => setEditEmail(e.target.value)}
                  className="w-full px-3 py-2 border border-[#1a1a1a]/20 rounded-2xs bg-[#faf8f5]"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block font-bold mb-1">비밀번호 (변경/초기화)</label>
                <div className="flex gap-1.5">
                  <input
                    type="text"
                    value={editPassword}
                    onChange={e => setEditPassword(e.target.value)}
                    placeholder="새 비밀번호 입력"
                    className="w-full px-3 py-2 border border-[#1a1a1a]/20 rounded-2xs bg-[#faf8f5] font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setEditPassword(generateTempPassword())}
                    className="px-3 py-2 border border-[#1a1a1a]/20 rounded-2xs bg-amber-50 hover:bg-amber-100 font-bold shrink-0"
                  >
                    임시비번 생성
                  </button>
                </div>
              </div>
              <div>
                <label className="block font-bold mb-1">학급 코드</label>
                <input
                  type="text"
                  value={editClassCode}
                  onChange={e => setEditClassCode(e.target.value)}
                  className="w-full px-3 py-2 border border-[#1a1a1a]/20 rounded-2xs bg-[#faf8f5] font-mono font-bold"
                />
              </div>
              <div>
                <label className="block font-bold mb-1">학급명</label>
                <input
                  type="text"
                  value={editClassName}
                  onChange={e => setEditClassName(e.target.value)}
                  className="w-full px-3 py-2 border border-[#1a1a1a]/20 rounded-2xs bg-[#faf8f5]"
                />
              </div>
              <div>
                <label className="block font-bold mb-1">학교명</label>
                <input
                  type="text"
                  value={editSchool}
                  onChange={e => setEditSchool(e.target.value)}
                  className="w-full px-3 py-2 border border-[#1a1a1a]/20 rounded-2xs bg-[#faf8f5]"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-bold mb-1">학년</label>
                  <input
                    type="text"
                    value={editGrade}
                    onChange={e => setEditGrade(e.target.value)}
                    className="w-full px-3 py-2 border border-[#1a1a1a]/20 rounded-2xs bg-[#faf8f5]"
                  />
                </div>
                <div>
                  <label className="block font-bold mb-1">반</label>
                  <input
                    type="text"
                    value={editClassNum}
                    onChange={e => setEditClassNum(e.target.value)}
                    className="w-full px-3 py-2 border border-[#1a1a1a]/20 rounded-2xs bg-[#faf8f5]"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-[#1a1a1a]/10">
              <button
                type="button"
                disabled={isSavingEdit}
                onClick={() => setEditTarget(null)}
                className="px-4 py-2 text-xs font-bold border border-[#1a1a1a]/20 rounded-2xs hover:bg-stone-100"
              >
                취소
              </button>
              <button
                type="submit"
                disabled={isSavingEdit}
                className="px-5 py-2 text-xs font-bold bg-[#1a1a1a] hover:bg-stone-800 text-white rounded-2xs disabled:opacity-50"
              >
                {isSavingEdit ? '저장 중...' : '변경사항 저장'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ---------------- MODAL 4: STUDENT ROSTER & PIN VIEW ---------------- */}
      {studentModalClass && (
        <div className="fixed inset-0 z-50 bg-black/55 backdrop-blur-[1px] flex items-center justify-center p-4">
          <div className="bg-white border border-[#1a1a1a]/20 rounded-sm shadow-2xl max-w-2xl w-full p-6 flex flex-col max-h-[85vh]">
            <div className="flex items-start justify-between gap-3 pb-3 border-b border-[#1a1a1a]/10 shrink-0">
              <div>
                <h3 className="text-base font-extrabold text-[#1a1a1a]">
                  {studentModalClass.className} ({studentModalClass.classCode}) 학생 계정 & PIN 현황
                </h3>
                <p className="text-xs text-[#1a1a1a]/65 mt-0.5">
                  총 {studentModalList.length}명 · 학생 아이디 및 PIN을 확인하고 바로 복사할 수 있습니다.
                </p>
              </div>
              <button type="button" onClick={() => setStudentModalClass(null)} className="text-stone-400 hover:text-stone-800 p-1">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="overflow-y-auto flex-1 py-3">
              {isLoadingStudents ? (
                <div className="py-10 text-center text-xs text-[#1a1a1a]/60">학생 목록을 불러오는 중입니다...</div>
              ) : studentModalList.length === 0 ? (
                <div className="py-10 text-center text-xs text-[#1a1a1a]/60">등록된 학생이 없습니다.</div>
              ) : (
                <table className="w-full text-xs text-left border-collapse">
                  <thead>
                    <tr className="border-b border-[#1a1a1a]/15 text-[#1a1a1a]/60">
                      <th className="py-2 px-2">번호</th>
                      <th className="py-2 px-2">이름</th>
                      <th className="py-2 px-2">아이디</th>
                      <th className="py-2 px-2">PIN</th>
                      <th className="py-2 px-2 text-right">현금</th>
                      <th className="py-2 px-2 text-right">예금</th>
                      <th className="py-2 px-2 text-right">복사</th>
                    </tr>
                  </thead>
                  <tbody>
                    {studentModalList.map((s) => (
                      <tr key={s.id} className="border-b border-[#1a1a1a]/10 hover:bg-[#faf8f5]">
                        <td className="py-2 px-2 font-mono">{s.number}번</td>
                        <td className="py-2 px-2 font-bold">{s.name}</td>
                        <td className="py-2 px-2 font-mono text-[#1a1a1a]/75">{s.username}</td>
                        <td className="py-2 px-2 font-mono font-bold text-blue-900">{s.pin}</td>
                        <td className="py-2 px-2 text-right font-mono">{(s.cash || 0).toLocaleString()}</td>
                        <td className="py-2 px-2 text-right font-mono">{(s.savings || 0).toLocaleString()}</td>
                        <td className="py-2 px-2 text-right">
                          <button
                            type="button"
                            onClick={() =>
                              copyText(
                                `[${studentModalClass.className}] ${s.number}번 ${s.name} | 학급코드: ${studentModalClass.classCode} | 아이디: ${s.username} | PIN: ${s.pin}`,
                                `${s.name} 학생 정보가`
                              )
                            }
                            className="px-2 py-1 bg-stone-100 hover:bg-stone-200 rounded-2xs text-[11px] font-bold"
                          >
                            복사
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <div className="pt-3 border-t border-[#1a1a1a]/10 flex justify-between items-center gap-2 shrink-0">
              <button
                type="button"
                disabled={studentModalList.length === 0}
                onClick={() => {
                  const summary = studentModalList
                    .map(s => `${s.number}번 ${s.name} (아이디: ${s.username} / PIN: ${s.pin})`)
                    .join('\n');
                  copyText(
                    `[${studentModalClass.className} (${studentModalClass.classCode}) 학생 접속 안내]\n${summary}`,
                    '전체 학생 명단이'
                  );
                }}
                className="px-4 py-2 text-xs font-bold bg-[#005da7] hover:bg-[#004883] text-white rounded-2xs disabled:opacity-40"
              >
                전체 학생 명단·PIN 복사
              </button>
              <button
                type="button"
                onClick={() => setStudentModalClass(null)}
                className="px-4 py-2 text-xs font-bold bg-[#1a1a1a] text-white rounded-2xs hover:bg-stone-800"
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ---------------- MODAL 5: DELETE CONFIRMATION ---------------- */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 bg-black/55 backdrop-blur-[1px] flex items-center justify-center p-4">
          <div className="bg-white border border-red-200 rounded-sm shadow-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-red-100 text-red-700 flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined">warning</span>
              </div>
              <div>
                <h3 className="text-base font-extrabold text-[#1a1a1a]">
                  {deleteTarget.kind === 'teacher' ? '교사 계정 삭제 확인' : '학급 데이터 삭제 확인'}
                </h3>
                <p className="text-xs text-[#1a1a1a]/75 mt-1 leading-relaxed">
                  <strong>{deleteTarget.label}</strong> 항목을 삭제하시겠습니까? 삭제 후에는 되돌릴 수 없습니다.
                </p>
              </div>
            </div>

            {deleteTarget.kind === 'teacher' && deleteTarget.classCode && (
              <label className="flex items-center gap-2 text-xs bg-red-50 border border-red-200 rounded-2xs p-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={alsoDeleteClass}
                  onChange={e => setAlsoDeleteClass(e.target.checked)}
                />
                <span className="font-bold text-red-900">
                  연결된 학급({deleteTarget.classCode})의 학생·거래 데이터도 함께 영구 삭제
                </span>
              </label>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setDeleteTarget(null)}
                className="px-4 py-2 text-xs font-bold border border-[#1a1a1a]/20 rounded-2xs hover:bg-stone-100"
              >
                취소
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleConfirmDelete}
                className="px-4 py-2 text-xs font-bold bg-red-700 hover:bg-red-800 text-white rounded-2xs disabled:opacity-50"
              >
                {isDeleting ? '삭제 중...' : '삭제 실행'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
