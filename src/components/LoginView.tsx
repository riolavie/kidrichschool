import React, { useState } from 'react';
import { useClassEconomy } from '../context/ClassEconomyContext';

export const LoginView: React.FC = () => {
  const {
    setRole,
    setCurrentStudentId,
    state,
    loginTeacher,
    signupTeacher,
    loginStudent,
    getAvailableStudentsForClass,
    getSavedTeacherAccounts,
    quickLoginTeacher,
    quickLoginStudent,
    requestPinReset,
    verifyTeacherForPasswordReset,
    resetTeacherPassword,
    initialUrlClassCode
  } = useClassEconomy();

  const generateRandomClassCode = () => `C-${Math.floor(10000 + Math.random() * 90000)}`;

  const [activeTab, setActiveTab] = useState<'teacher' | 'student'>(() =>
    initialUrlClassCode ? 'student' : 'teacher'
  );
  const [teacherSubTab, setTeacherSubTab] = useState<'login' | 'signup' | 'find_password' | 'find_account'>('login');

  // Account Detection & Fast Restore State
  const [detectedTeachers, setDetectedTeachers] = useState<any[]>([]);
  const [detectedStudent, setDetectedStudent] = useState<any | null>(null);
  const [accountSearchQuery, setAccountSearchQuery] = useState('');

  // Student Login State
  const [studentIdentifier, setStudentIdentifier] = useState('');
  const [studentPin, setStudentPin] = useState('');
  const [classCode, setClassCode] = useState(initialUrlClassCode || state.classCode);
  const [availableStudents, setAvailableStudents] = useState<any[]>([]);
  const [showStudentPicker, setShowStudentPicker] = useState(true);

  // Teacher Login & Signup State
  const [teacherEmail, setTeacherEmail] = useState('');
  const [teacherPassword, setTeacherPassword] = useState('');
  const [teacherName, setTeacherName] = useState('');
  const [teacherSchoolName, setTeacherSchoolName] = useState('');
  const [teacherGrade, setTeacherGrade] = useState('');
  const [teacherClassNum, setTeacherClassNum] = useState('');
  const [teacherClassName, setTeacherClassName] = useState('우리반');
  const [teacherClassCode, setTeacherClassCode] = useState(() => generateRandomClassCode());

  // Teacher Password Recovery State
  const [findTeacherId, setFindTeacherId] = useState('');
  const [findSchoolName, setFindSchoolName] = useState('');
  const [findGrade, setFindGrade] = useState('');
  const [findClassNum, setFindClassNum] = useState('');
  const [verifiedTeacher, setVerifiedTeacher] = useState<any | null>(null);
  const [showVerifiedPassword, setShowVerifiedPassword] = useState(false);
  const [newResetPassword, setNewResetPassword] = useState('');
  const [isResetting, setIsResetting] = useState(false);

  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  React.useEffect(() => {
    setClassCode(initialUrlClassCode || state.classCode);
    if (teacherSubTab !== 'signup') {
      setTeacherClassCode(state.classCode);
      setTeacherClassName(state.className);
    }

    try {
      const teachers = getSavedTeacherAccounts();
      setDetectedTeachers(teachers);

      const savedStudentStr = localStorage.getItem('kidsrich_auth_student_account') || sessionStorage.getItem('kidsrich_auth_student_account');
      if (savedStudentStr) {
        setDetectedStudent(JSON.parse(savedStudentStr));
      }
    } catch (e) {}
  }, [initialUrlClassCode, state.classCode, state.className, state.teacherEmail, state.teacherName, teacherSubTab]);

  React.useEffect(() => {
    if (activeTab !== 'student') return;
    const timer = setTimeout(() => {
      getAvailableStudentsForClass(classCode)
        .then(list => {
          if (Array.isArray(list)) {
            setAvailableStudents(list);
          }
        })
        .catch(console.warn);
    }, 350);
    return () => clearTimeout(timer);
  }, [activeTab, classCode]);

  // Automatically suggest className when grade & classNum are filled
  const handleGradeChange = (val: string) => {
    setTeacherGrade(val);
    if (val.trim() && teacherClassNum.trim()) {
      setTeacherClassName(`${val.trim()}학년 ${teacherClassNum.trim()}반`);
    }
  };

  const handleClassNumChange = (val: string) => {
    setTeacherClassNum(val);
    if (teacherGrade.trim() && val.trim()) {
      setTeacherClassName(`${teacherGrade.trim()}학년 ${val.trim()}반`);
    }
  };

  // Clean user-friendly error formatter
  const formatFriendlyError = (err: any, fallback: string): string => {
    if (!err) return fallback;
    const msg = typeof err === 'string' ? err : err?.message;
    if (!msg || typeof msg !== 'string') return fallback;
    if (
      msg.includes('is not a function') ||
      msg.includes('TypeError') ||
      msg.includes('undefined') ||
      msg.includes('null') ||
      msg.includes('Cannot read')
    ) {
      return fallback;
    }
    return msg;
  };

  // Handle Teacher Login
  const handleTeacherLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');
    setIsLoading(true);

    try {
      const res = await loginTeacher(teacherEmail, teacherPassword);
      if (!res.success) {
        setError(res.message || '로그인에 실패하였습니다. 아이디 및 비밀번호를 확인해 주세요.');
      }
    } catch (err: any) {
      setError(formatFriendlyError(err, '로그인 처리 중 오류가 발생했습니다. 다시 시도해 주세요.'));
    } finally {
      setIsLoading(false);
    }
  };

  // Handle Teacher Signup
  const handleTeacherSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');
    setIsLoading(true);

    if (!teacherName.trim()) {
      setError('선생님 성함을 입력해 주세요.');
      setIsLoading(false);
      return;
    }
    if (!teacherEmail.trim()) {
      setError('이메일 또는 아이디를 입력해 주세요.');
      setIsLoading(false);
      return;
    }

    try {
      const res = await signupTeacher(
        teacherName,
        teacherEmail,
        teacherPassword,
        teacherClassName,
        teacherClassCode,
        teacherSchoolName,
        teacherGrade,
        teacherClassNum
      );
      if (res.success) {
        setSuccessMsg('교사 회원가입 및 학급 개설이 완료되었습니다!');
      } else {
        setError(res.message || '회원가입에 실패하였습니다.');
      }
    } catch (err: any) {
      setError(formatFriendlyError(err, '회원가입 처리 중 오류가 발생했습니다. 다시 시도해 주세요.'));
    } finally {
      setIsLoading(false);
    }
  };

  // Handle Teacher Find Password Verification
  const handleVerifyTeacherPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');
    setVerifiedTeacher(null);
    setIsLoading(true);

    try {
      const res = await verifyTeacherForPasswordReset(
        findTeacherId,
        findSchoolName,
        findGrade,
        findClassNum
      );
      if (res.success && res.teacher) {
        setVerifiedTeacher(res.teacher);
        setSuccessMsg('본인 확인이 완료되었습니다! 등록된 비밀번호를 확인하거나 새 비밀번호로 재설정하세요.');
      } else {
        setError(res.message || '입력하신 정보와 일치하는 교사 계정을 찾을 수 없습니다.');
      }
    } catch (err: any) {
      setError(formatFriendlyError(err, '비밀번호 확인 중 오류가 발생했습니다. 정보를 다시 확인해 주세요.'));
    } finally {
      setIsLoading(false);
    }
  };

  // Handle Set New Password after verification
  const handleResetPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!verifiedTeacher) return;
    if (!newResetPassword.trim()) {
      setError('새로 설정할 비밀번호를 입력해 주세요.');
      return;
    }

    setIsResetting(true);
    setError('');
    setSuccessMsg('');

    try {
      const teacherKey = verifiedTeacher.teacherId || verifiedTeacher.email;
      const res = await resetTeacherPassword(teacherKey, newResetPassword.trim());
      if (res.success) {
        setSuccessMsg('비밀번호가 안전하게 변경되었습니다! 바로 로그인합니다...');
        setTimeout(async () => {
          await loginTeacher(teacherKey, newResetPassword.trim());
        }, 1000);
      } else {
        setError(res.message || '비밀번호 변경 중 오류가 발생했습니다.');
      }
    } catch (err: any) {
      setError(formatFriendlyError(err, '비밀번호 재설정 처리 중 오류가 발생했습니다.'));
    } finally {
      setIsResetting(false);
    }
  };

  // Handle Student Login
  const handleStudentLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');

    // Normalize full-width digits (e.g. from mobile or tablet Korean keyboards)
    const cleanIdentifier = studentIdentifier
      .replace(/[０-９]/g, s => String.fromCharCode(s.charCodeAt(0) - 0xFEE0))
      .trim();

    if (!cleanIdentifier) {
      setError('학생 이름 또는 번호(예: 1 또는 김민준)를 입력해 주세요.');
      return;
    }

    const cleanPin = studentPin
      .replace(/[０-９]/g, s => String.fromCharCode(s.charCodeAt(0) - 0xFEE0))
      .trim();

    if (!cleanPin) {
      setError('비밀번호(PIN)를 입력해 주세요. (초기 비밀번호: 1234)');
      return;
    }

    setIsLoading(true);

    try {
      const res = await loginStudent(cleanIdentifier, cleanPin, classCode);
      if (!res.success) {
        setError(res.message || '로그인에 실패하였습니다. 이름(번호)과 비밀번호를 확인해 주세요.');
      }
    } catch (err: any) {
      console.error('handleStudentLogin error:', err);
      setError(err?.message || '학생 로그인 처리 중 오류가 발생했습니다. 학급 코드와 비밀번호를 다시 확인해 주세요.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-[#f7f9fb] min-h-[calc(100vh-42px)] flex items-center justify-center p-4 sm:p-6 relative overflow-hidden">
      {/* Background Ambience */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute top-[-15%] left-[-10%] w-[50%] h-[50%] bg-[#d4e3ff] rounded-full blur-[120px] opacity-70"></div>
        <div className="absolute bottom-[-15%] right-[-10%] w-[50%] h-[50%] bg-[#c0f5d0] rounded-full blur-[120px] opacity-70"></div>
      </div>

      <div className="w-full max-w-[500px] bg-white rounded-3xl p-6 sm:p-8 shadow-[0_8px_32px_rgba(0,0,0,0.06)] z-10 relative overflow-hidden border border-[#eceef0]">
        {/* Brand Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-tr from-[#005da7] to-[#2575fc] text-white font-editorial font-bold italic text-3xl shadow-md mb-3">
            K
          </div>
          <h1 className="font-extrabold text-2xl sm:text-3xl text-[#191c1e] tracking-tight">
            키즈리치 스쿨
          </h1>
          <p className="text-sm text-[#414751] font-medium mt-1">
            재미있게 배우는 우리 반 금융 시뮬레이터
          </p>
        </div>

        {/* Global Alert / Status */}
        {error && (
          <div className="mb-5 p-3.5 bg-red-50 border border-red-200 rounded-2xl text-red-700 text-xs font-semibold flex items-center gap-2">
            <span className="material-symbols-outlined text-lg shrink-0">error</span>
            <span>{error}</span>
          </div>
        )}

        {successMsg && (
          <div className="mb-5 p-3.5 bg-emerald-50 border border-emerald-200 rounded-2xl text-emerald-800 text-xs font-semibold flex items-center gap-2">
            <span className="material-symbols-outlined text-lg shrink-0">check_circle</span>
            <span>{successMsg}</span>
          </div>
        )}

        {/* Quick Account Recovery Banner if saved accounts detected */}
        {(detectedTeachers.length > 0 || detectedStudent) && (
          <div className="mb-5 p-3.5 bg-gradient-to-r from-blue-50 via-indigo-50 to-sky-50 border-2 border-blue-200/90 rounded-2xl shadow-xs">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-blue-900 flex items-center gap-1.5">
                <span className="text-base">✨</span> 이 기기에 저장된 계정 발견
              </span>
              <button
                type="button"
                onClick={() => {
                  setActiveTab('teacher');
                  setTeacherSubTab('find_account');
                }}
                className="text-[11px] font-bold text-[#005da7] hover:underline flex items-center gap-0.5"
              >
                <span>내 계정 찾기</span>
                <span className="material-symbols-outlined text-[13px]">arrow_forward</span>
              </button>
            </div>
            <div className="flex flex-col gap-2">
              {detectedTeachers.slice(0, 2).map((t, idx) => (
                <div key={idx} className="flex items-center justify-between bg-white/95 p-2 px-3 rounded-xl border border-blue-200/70 shadow-2xs">
                  <div className="truncate mr-2">
                    <div className="font-bold text-stone-900 text-xs flex items-center gap-1">
                      <span>👨‍🏫</span> {t.name} 선생님
                      <span className="text-stone-500 font-normal text-[11px]">({t.className || '우리반'})</span>
                    </div>
                    <div className="text-[11px] text-stone-500 truncate">
                      학급코드: <span className="font-mono font-bold text-blue-800">{t.classCode}</span> · {t.email}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => quickLoginTeacher(t)}
                    className="shrink-0 px-3 py-1.5 bg-[#005da7] text-white rounded-lg text-xs font-bold hover:bg-[#004883] transition-all shadow-xs flex items-center gap-1"
                  >
                    <span>즉시 접속</span>
                  </button>
                </div>
              ))}
              {detectedStudent && (
                <div className="flex items-center justify-between bg-white/95 p-2 px-3 rounded-xl border border-blue-200/70 shadow-2xs">
                  <div className="truncate mr-2">
                    <div className="font-bold text-stone-900 text-xs flex items-center gap-1">
                      <span>🧒</span> {detectedStudent.name} 학생
                      <span className="text-stone-500 font-normal text-[11px]">({detectedStudent.number}번)</span>
                    </div>
                    <div className="text-[11px] text-stone-500 truncate">
                      학급코드: <span className="font-mono font-bold text-blue-800">{classCode || state.classCode}</span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => quickLoginStudent(detectedStudent.id, classCode || state.classCode)}
                    className="shrink-0 px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-bold hover:bg-emerald-700 transition-all shadow-xs flex items-center gap-1"
                  >
                    <span>학생 접속</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Main Mode Tabs: Teacher vs Student */}
        <div className="flex gap-2 p-1.5 bg-[#f2f4f6] rounded-2xl mb-6">
          <button
            type="button"
            onClick={() => {
              setActiveTab('teacher');
              setError('');
              setSuccessMsg('');
            }}
            className={`flex-1 h-12 rounded-xl font-bold text-sm flex items-center justify-center gap-2 border transition-all ${
              activeTab === 'teacher'
                ? 'bg-[#005da7] text-white border-[#005da7] shadow-sm'
                : 'bg-transparent text-[#414751] border-transparent hover:bg-white/60'
            }`}
          >
            <span className="text-lg">👨‍🏫</span> 교사 전용
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab('student');
              setError('');
              setSuccessMsg('');
            }}
            className={`flex-1 h-12 rounded-xl font-bold text-sm flex items-center justify-center gap-2 border transition-all ${
              activeTab === 'student'
                ? 'bg-[#005da7] text-white border-[#005da7] shadow-sm'
                : 'bg-transparent text-[#414751] border-transparent hover:bg-white/60'
            }`}
          >
            <span className="text-lg">🧒</span> 학생 전용
          </button>
        </div>

        {/* ---------------- TEACHER SECTION ---------------- */}
        {activeTab === 'teacher' && (
          <div>
            {/* Teacher Sub Tabs: Login vs Sign Up vs Find Password vs Find Account */}
            <div className="flex items-center justify-between border-b border-stone-200 pb-3 mb-5 overflow-x-auto gap-2">
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setTeacherSubTab('login');
                    setError('');
                    setSuccessMsg('');
                    setVerifiedTeacher(null);
                  }}
                  className={`text-sm font-bold pb-1 transition-all whitespace-nowrap ${
                    teacherSubTab === 'login'
                      ? 'text-[#005da7] border-b-2 border-[#005da7]'
                      : 'text-stone-400 hover:text-stone-700'
                  }`}
                >
                  교사 로그인
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setTeacherSubTab('signup');
                    setTeacherClassCode(generateRandomClassCode());
                    setTeacherClassName('우리반');
                    setError('');
                    setSuccessMsg('');
                    setVerifiedTeacher(null);
                  }}
                  className={`text-sm font-bold pb-1 transition-all whitespace-nowrap ${
                    teacherSubTab === 'signup'
                      ? 'text-[#005da7] border-b-2 border-[#005da7]'
                      : 'text-stone-400 hover:text-stone-700'
                  }`}
                >
                  교사 회원가입
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setTeacherSubTab('find_account');
                    setError('');
                    setSuccessMsg('');
                    setVerifiedTeacher(null);
                  }}
                  className={`text-sm font-bold pb-1 transition-all whitespace-nowrap flex items-center gap-1 ${
                    teacherSubTab === 'find_account'
                      ? 'text-indigo-700 border-b-2 border-indigo-600 font-extrabold'
                      : 'text-stone-400 hover:text-indigo-700'
                  }`}
                >
                  <span>🔍</span> 내 계정 찾기
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setTeacherSubTab('find_password');
                    setError('');
                    setSuccessMsg('');
                    setVerifiedTeacher(null);
                  }}
                  className={`text-sm font-bold pb-1 transition-all whitespace-nowrap flex items-center gap-1 ${
                    teacherSubTab === 'find_password'
                      ? 'text-amber-700 border-b-2 border-amber-600'
                      : 'text-stone-400 hover:text-amber-700'
                  }`}
                >
                  <span>🔑</span> 비밀번호 찾기
                </button>
              </div>
            </div>

            {/* 1. Teacher Login Form */}
            {teacherSubTab === 'login' && (
              <form onSubmit={handleTeacherLogin} className="flex flex-col gap-4">
                <div className="border-2 border-[#c1c7d3] rounded-2xl bg-[#f7f9fb] p-3 px-4 focus-within:border-[#005da7] focus-within:bg-white transition-all">
                  <label className="block text-xs font-bold text-[#414751] mb-1">
                    선생님 성함, 아이디, 이메일 또는 학급 코드
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="예: 김선생, teacher01, teacher@school.kr, C-10001"
                    value={teacherEmail}
                    onChange={e => setTeacherEmail(e.target.value)}
                    className="w-full bg-transparent border-none p-0 focus:ring-0 font-medium text-sm text-[#191c1e] placeholder-[#717783]"
                  />
                </div>

                <div className="border-2 border-[#c1c7d3] rounded-2xl bg-[#f7f9fb] p-3 px-4 focus-within:border-[#005da7] focus-within:bg-white transition-all relative">
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-bold text-[#414751]">
                      비밀번호
                    </label>
                  </div>
                  <div className="flex items-center">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      placeholder="비밀번호를 입력하세요"
                      value={teacherPassword}
                      onChange={e => setTeacherPassword(e.target.value)}
                      className="w-full bg-transparent border-none p-0 focus:ring-0 font-medium text-sm text-[#191c1e] placeholder-[#717783]"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="text-[#717783] hover:text-[#005da7] p-1"
                    >
                      <span className="material-symbols-outlined text-[20px]">
                        {showPassword ? 'visibility_off' : 'visibility'}
                      </span>
                    </button>
                  </div>
                </div>

                <div className="flex justify-between items-center -mt-1 text-xs">
                  <button
                    type="button"
                    onClick={() => {
                      setTeacherSubTab('find_account');
                      setError('');
                      setSuccessMsg('');
                    }}
                    className="font-bold text-indigo-700 hover:underline flex items-center gap-1"
                  >
                    <span>🔍</span> 내 계정 찾기 / 복구
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setTeacherSubTab('find_password');
                      setError('');
                      setSuccessMsg('');
                      setVerifiedTeacher(null);
                      if (teacherEmail.trim()) {
                        setFindTeacherId(teacherEmail.trim());
                      }
                    }}
                    className="font-semibold text-[#005da7] hover:underline flex items-center gap-1"
                  >
                    <span className="material-symbols-outlined text-[15px]">lock_reset</span>
                    비밀번호 찾기
                  </button>
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="btn-press mt-1 w-full h-[52px] bg-[#005da7] text-white font-bold text-base rounded-2xl shadow-[0_4px_12px_rgba(0,93,167,0.25)] hover:bg-[#004883] flex items-center justify-center gap-2 transition-all disabled:opacity-50"
                >
                  {isLoading ? (
                    <span className="inline-block w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                  ) : (
                    <>
                      <span>교사 관리자 접속</span>
                      <span className="material-symbols-outlined text-lg">arrow_forward</span>
                    </>
                  )}
                </button>

                <div className="mt-2 text-center text-xs text-stone-500">
                  계정이 없으신가요?{' '}
                  <button
                    type="button"
                    onClick={() => {
                      setTeacherSubTab('signup');
                      setTeacherClassCode(generateRandomClassCode());
                      setTeacherClassName('우리반');
                      setError('');
                      setSuccessMsg('');
                    }}
                    className="font-bold text-[#005da7] hover:underline"
                  >
                    교사 회원가입하기
                  </button>
                </div>
              </form>
            )}

            {/* 2. Teacher Sign Up Form */}
            {teacherSubTab === 'signup' && (
              <form onSubmit={handleTeacherSignup} className="flex flex-col gap-3">
                <div className="border-2 border-[#c1c7d3] rounded-2xl bg-[#f7f9fb] p-2.5 px-3.5 focus-within:border-[#005da7] focus-within:bg-white transition-all">
                  <label className="block text-xs font-bold text-[#414751] mb-0.5">
                    선생님 성함 *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="예: 김선생"
                    value={teacherName}
                    onChange={e => setTeacherName(e.target.value)}
                    className="w-full bg-transparent border-none p-0 focus:ring-0 font-medium text-sm text-[#191c1e] placeholder-[#717783]"
                  />
                </div>

                <div className="border-2 border-[#c1c7d3] rounded-2xl bg-[#f7f9fb] p-2.5 px-3.5 focus-within:border-[#005da7] focus-within:bg-white transition-all">
                  <label className="block text-xs font-bold text-[#414751] mb-0.5">
                    교사 아이디 또는 학교 이메일 *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="예: teacher01 또는 teacher@school.ed.kr"
                    value={teacherEmail}
                    onChange={e => setTeacherEmail(e.target.value)}
                    className="w-full bg-transparent border-none p-0 focus:ring-0 font-medium text-sm text-[#191c1e] placeholder-[#717783]"
                  />
                </div>

                <div className="border-2 border-[#c1c7d3] rounded-2xl bg-[#f7f9fb] p-2.5 px-3.5 focus-within:border-[#005da7] focus-within:bg-white transition-all relative">
                  <label className="block text-xs font-bold text-[#414751] mb-0.5">
                    비밀번호 설정 *
                  </label>
                  <div className="flex items-center">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      placeholder="비밀번호 입력"
                      value={teacherPassword}
                      onChange={e => setTeacherPassword(e.target.value)}
                      className="w-full bg-transparent border-none p-0 focus:ring-0 font-medium text-sm text-[#191c1e] placeholder-[#717783]"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="text-[#717783] hover:text-[#005da7] p-1"
                    >
                      <span className="material-symbols-outlined text-[20px]">
                        {showPassword ? 'visibility_off' : 'visibility'}
                      </span>
                    </button>
                  </div>
                </div>

                {/* Password Recovery info section */}
                <div className="p-3 bg-amber-50/70 border border-amber-200/80 rounded-2xl">
                  <div className="flex items-center gap-1 text-xs font-bold text-amber-900 mb-2">
                    <span className="material-symbols-outlined text-sm text-amber-700">shield</span>
                    <span>비밀번호 찾기 본인 확인 정보 (필수)</span>
                  </div>
                  <p className="text-[11px] text-amber-800/90 leading-tight mb-2.5">
                    💡 비밀번호 분실 시 아래 학교명, 학년, 반 정보를 통해 안전하게 비밀번호를 찾거나 재설정합니다.
                  </p>

                  <div className="flex flex-col gap-2">
                    <div className="border border-amber-300 rounded-xl bg-white p-2 px-3 focus-within:border-[#005da7]">
                      <label className="block text-[11px] font-bold text-[#414751] mb-0.5">
                        소속 학교명 *
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="예: 서울초등학교 또는 해솔초"
                        value={teacherSchoolName}
                        onChange={e => setTeacherSchoolName(e.target.value)}
                        className="w-full bg-transparent border-none p-0 focus:ring-0 font-medium text-xs text-[#191c1e] placeholder-[#717783]"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div className="border border-amber-300 rounded-xl bg-white p-2 px-3 focus-within:border-[#005da7]">
                        <label className="block text-[11px] font-bold text-[#414751] mb-0.5">
                          담당 학년 *
                        </label>
                        <input
                          type="text"
                          required
                          placeholder="예: 6 (또는 6학년)"
                          value={teacherGrade}
                          onChange={e => handleGradeChange(e.target.value)}
                          className="w-full bg-transparent border-none p-0 focus:ring-0 font-medium text-xs text-[#191c1e] placeholder-[#717783]"
                        />
                      </div>

                      <div className="border border-amber-300 rounded-xl bg-white p-2 px-3 focus-within:border-[#005da7]">
                        <label className="block text-[11px] font-bold text-[#414751] mb-0.5">
                          담당 반 *
                        </label>
                        <input
                          type="text"
                          required
                          placeholder="예: 1 (또는 1반)"
                          value={teacherClassNum}
                          onChange={e => handleClassNumChange(e.target.value)}
                          className="w-full bg-transparent border-none p-0 focus:ring-0 font-medium text-xs text-[#191c1e] placeholder-[#717783]"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="border-2 border-[#c1c7d3] rounded-2xl bg-[#f7f9fb] p-2.5 px-3.5 focus-within:border-[#005da7] focus-within:bg-white transition-all">
                    <label className="block text-xs font-bold text-[#414751] mb-0.5">
                      학반 이름
                    </label>
                    <input
                      type="text"
                      placeholder="예: 6학년 1반"
                      value={teacherClassName}
                      onChange={e => setTeacherClassName(e.target.value)}
                      className="w-full bg-transparent border-none p-0 focus:ring-0 font-medium text-xs text-[#191c1e] placeholder-[#717783]"
                    />
                  </div>

                  <div className="border-2 border-[#c1c7d3] rounded-2xl bg-[#f7f9fb] p-2.5 px-3.5 focus-within:border-[#005da7] focus-within:bg-white transition-all">
                    <div className="flex items-center justify-between mb-0.5">
                      <label className="block text-xs font-bold text-[#414751]">
                        학급 코드
                      </label>
                      <button
                        type="button"
                        onClick={() => setTeacherClassCode(generateRandomClassCode())}
                        className="text-[10px] font-bold text-[#005da7] hover:underline"
                      >
                        🎲 새 코드
                      </button>
                    </div>
                    <input
                      type="text"
                      placeholder="예: C-12345"
                      value={teacherClassCode}
                      onChange={e => setTeacherClassCode(e.target.value.toUpperCase())}
                      className="w-full bg-transparent border-none p-0 focus:ring-0 font-mono font-bold text-xs text-[#191c1e] placeholder-[#717783]"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="btn-press mt-1 w-full h-[50px] bg-emerald-700 text-white font-bold text-base rounded-2xl shadow-md hover:bg-emerald-800 flex items-center justify-center gap-2 transition-all disabled:opacity-50"
                >
                  {isLoading ? (
                    <span className="inline-block w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                  ) : (
                    <>
                      <span>교사 계정 생성 & 학급 개설</span>
                      <span className="material-symbols-outlined text-lg">school</span>
                    </>
                  )}
                </button>

                <div className="mt-1 text-center text-xs text-stone-500">
                  이미 계정이 있으신가요?{' '}
                  <button
                    type="button"
                    onClick={() => {
                      setTeacherSubTab('login');
                      setError('');
                    }}
                    className="font-bold text-[#005da7] hover:underline"
                  >
                    교사 로그인하기
                  </button>
                </div>
              </form>
            )}

            {/* 3. Teacher Find / Reset Password Form */}
            {teacherSubTab === 'find_password' && (
              <div className="flex flex-col gap-4">
                <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-2xl">
                  <div className="flex items-center gap-2 text-amber-900 font-bold text-xs mb-1">
                    <span className="material-symbols-outlined text-base text-amber-700">lock_person</span>
                    <span>교사 비밀번호 찾기 및 재설정</span>
                  </div>
                  <p className="text-xs text-amber-800 leading-relaxed">
                    교사 아이디, 소속학교, 학년, 반 정보를 입력하여 본인 확인을 진행합니다.
                  </p>
                </div>

                {!verifiedTeacher ? (
                  /* Step 1: Verification Form */
                  <form onSubmit={handleVerifyTeacherPassword} className="flex flex-col gap-3">
                    <div className="border-2 border-[#c1c7d3] rounded-2xl bg-[#f7f9fb] p-2.5 px-3.5 focus-within:border-amber-600 focus-within:bg-white transition-all">
                      <label className="block text-xs font-bold text-[#414751] mb-0.5">
                        교사 아이디 또는 이메일 *
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="예: teacher01 또는 teacher@school.ed.kr"
                        value={findTeacherId}
                        onChange={e => setFindTeacherId(e.target.value)}
                        className="w-full bg-transparent border-none p-0 focus:ring-0 font-medium text-sm text-[#191c1e] placeholder-[#717783]"
                      />
                    </div>

                    <div className="border-2 border-[#c1c7d3] rounded-2xl bg-[#f7f9fb] p-2.5 px-3.5 focus-within:border-amber-600 focus-within:bg-white transition-all">
                      <label className="block text-xs font-bold text-[#414751] mb-0.5">
                        소속 학교명 *
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="예: 서울초등학교 (또는 서울초)"
                        value={findSchoolName}
                        onChange={e => setFindSchoolName(e.target.value)}
                        className="w-full bg-transparent border-none p-0 focus:ring-0 font-medium text-sm text-[#191c1e] placeholder-[#717783]"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2.5">
                      <div className="border-2 border-[#c1c7d3] rounded-2xl bg-[#f7f9fb] p-2.5 px-3.5 focus-within:border-amber-600 focus-within:bg-white transition-all">
                        <label className="block text-xs font-bold text-[#414751] mb-0.5">
                          담당 학년 *
                        </label>
                        <input
                          type="text"
                          required
                          placeholder="예: 6 (또는 6학년)"
                          value={findGrade}
                          onChange={e => setFindGrade(e.target.value)}
                          className="w-full bg-transparent border-none p-0 focus:ring-0 font-medium text-sm text-[#191c1e] placeholder-[#717783]"
                        />
                      </div>

                      <div className="border-2 border-[#c1c7d3] rounded-2xl bg-[#f7f9fb] p-2.5 px-3.5 focus-within:border-amber-600 focus-within:bg-white transition-all">
                        <label className="block text-xs font-bold text-[#414751] mb-0.5">
                          담당 반 *
                        </label>
                        <input
                          type="text"
                          required
                          placeholder="예: 1 (또는 1반)"
                          value={findClassNum}
                          onChange={e => setFindClassNum(e.target.value)}
                          className="w-full bg-transparent border-none p-0 focus:ring-0 font-medium text-sm text-[#191c1e] placeholder-[#717783]"
                        />
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={isLoading}
                      className="btn-press mt-2 w-full h-[52px] bg-amber-600 text-white font-bold text-base rounded-2xl shadow-md hover:bg-amber-700 flex items-center justify-center gap-2 transition-all disabled:opacity-50"
                    >
                      {isLoading ? (
                        <span className="inline-block w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                      ) : (
                        <>
                          <span className="material-symbols-outlined text-lg">verified_user</span>
                          <span>본인 확인 및 비밀번호 조회</span>
                        </>
                      )}
                    </button>
                  </form>
                ) : (
                  /* Step 2: Verification Success Card & Reset Form */
                  <div className="flex flex-col gap-4">
                    {/* Account Info Verified Badge */}
                    <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl">
                      <div className="flex items-center gap-2 text-emerald-800 font-bold text-sm mb-1.5">
                        <span className="material-symbols-outlined text-emerald-600 text-lg">check_circle</span>
                        <span>교사 본인 확인 완료</span>
                      </div>
                      <div className="text-xs text-emerald-950 space-y-1">
                        <p><span className="font-semibold text-emerald-900">선생님 성함:</span> {verifiedTeacher.name} 선생님</p>
                        <p><span className="font-semibold text-emerald-900">학급 정보:</span> {verifiedTeacher.className || '우리반'} (코드: {verifiedTeacher.classCode})</p>
                        <p><span className="font-semibold text-emerald-900">아이디:</span> {verifiedTeacher.email || verifiedTeacher.teacherId}</p>
                      </div>
                    </div>

                    {/* Current Password Display */}
                    <div className="p-3.5 bg-stone-100 border border-stone-200 rounded-2xl">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-bold text-stone-700">현재 등록된 비밀번호</span>
                        <button
                          type="button"
                          onClick={() => setShowVerifiedPassword(!showVerifiedPassword)}
                          className="text-xs text-[#005da7] hover:underline font-semibold flex items-center gap-1"
                        >
                          <span className="material-symbols-outlined text-[16px]">
                            {showVerifiedPassword ? 'visibility_off' : 'visibility'}
                          </span>
                          <span>{showVerifiedPassword ? '비밀번호 숨기기' : '비밀번호 확인하기'}</span>
                        </button>
                      </div>
                      <div className="text-sm font-mono font-bold text-stone-800 bg-white p-2.5 rounded-xl border border-stone-200 text-center tracking-wider">
                        {showVerifiedPassword ? (
                          verifiedTeacher.password ? verifiedTeacher.password : '(설정된 비밀번호 없음)'
                        ) : (
                          '••••••••'
                        )}
                      </div>
                    </div>

                    {/* Set New Password Form */}
                    <form onSubmit={handleResetPasswordSubmit} className="flex flex-col gap-3">
                      <div className="border-2 border-[#c1c7d3] rounded-2xl bg-[#f7f9fb] p-3 px-4 focus-within:border-[#005da7] focus-within:bg-white transition-all">
                        <label className="block text-xs font-bold text-[#414751] mb-1">
                          새로 사용할 비밀번호 설정
                        </label>
                        <input
                          type="text"
                          required
                          placeholder="새 비밀번호를 입력하세요"
                          value={newResetPassword}
                          onChange={e => setNewResetPassword(e.target.value)}
                          className="w-full bg-transparent border-none p-0 focus:ring-0 font-medium text-sm text-[#191c1e] placeholder-[#717783]"
                        />
                      </div>

                      <button
                        type="submit"
                        disabled={isResetting}
                        className="btn-press w-full h-[50px] bg-[#005da7] text-white font-bold text-sm rounded-2xl shadow-md hover:bg-[#004883] flex items-center justify-center gap-2 transition-all disabled:opacity-50"
                      >
                        {isResetting ? (
                          <span className="inline-block w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                        ) : (
                          <>
                            <span className="material-symbols-outlined text-lg">lock_reset</span>
                            <span>새 비밀번호로 변경하고 바로 로그인</span>
                          </>
                        )}
                      </button>
                    </form>
                  </div>
                )}

                <div className="text-center pt-1 border-t border-stone-200">
                  <button
                    type="button"
                    onClick={() => {
                      setTeacherSubTab('login');
                      setError('');
                      setSuccessMsg('');
                      setVerifiedTeacher(null);
                    }}
                    className="text-xs font-bold text-stone-600 hover:text-[#005da7] flex items-center justify-center gap-1 mx-auto"
                  >
                    <span className="material-symbols-outlined text-sm">arrow_back</span>
                    교사 로그인으로 돌아가기
                  </button>
                </div>
              </div>
            )}

            {/* 4. Teacher Find Account / Recovery View */}
            {teacherSubTab === 'find_account' && (
              <div className="flex flex-col gap-4">
                <div className="p-3.5 bg-indigo-50/80 border border-indigo-200 rounded-2xl">
                  <div className="flex items-center gap-2 text-indigo-950 font-bold text-xs mb-1">
                    <span className="text-base">🔍</span>
                    <span>내 교사 계정 찾기 및 빠른 복구</span>
                  </div>
                  <p className="text-xs text-indigo-900 leading-relaxed">
                    이 기기(브라우저)에 저장된 선생님 계정과 학급 정보를 확인하여 즉시 로그인하거나 비밀번호를 복구할 수 있습니다.
                  </p>
                </div>

                {/* Search / Filter Input */}
                <div className="border-2 border-[#c1c7d3] rounded-2xl bg-[#f7f9fb] p-2.5 px-3.5 focus-within:border-indigo-600 focus-within:bg-white transition-all flex items-center gap-2">
                  <span className="material-symbols-outlined text-stone-400 text-lg">search</span>
                  <input
                    type="text"
                    placeholder="선생님 성함, 이메일, 학교명, 학급명으로 검색..."
                    value={accountSearchQuery}
                    onChange={e => setAccountSearchQuery(e.target.value)}
                    className="w-full bg-transparent border-none p-0 focus:ring-0 font-medium text-xs text-[#191c1e] placeholder-[#717783]"
                  />
                  {accountSearchQuery && (
                    <button
                      type="button"
                      onClick={() => setAccountSearchQuery('')}
                      className="text-stone-400 hover:text-stone-600 text-xs"
                    >
                      취소
                    </button>
                  )}
                </div>

                {/* Accounts List */}
                <div className="flex flex-col gap-2.5 max-h-[340px] overflow-y-auto pr-1">
                  {detectedTeachers
                    .filter(t => {
                      if (!accountSearchQuery.trim()) return true;
                      const q = accountSearchQuery.trim().toLowerCase();
                      return (
                        (t.name && t.name.toLowerCase().includes(q)) ||
                        (t.email && t.email.toLowerCase().includes(q)) ||
                        (t.teacherId && t.teacherId.toLowerCase().includes(q)) ||
                        (t.schoolName && t.schoolName.toLowerCase().includes(q)) ||
                        (t.className && t.className.toLowerCase().includes(q)) ||
                        (t.classCode && t.classCode.toLowerCase().includes(q))
                      );
                    })
                    .map((t, idx) => (
                      <div
                        key={idx}
                        className="bg-white border-2 border-stone-200 hover:border-indigo-300 rounded-2xl p-3.5 shadow-2xs transition-all flex flex-col gap-2"
                      >
                        <div className="flex items-start justify-between">
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className="text-base">👨‍🏫</span>
                              <span className="font-extrabold text-sm text-stone-900">{t.name} 선생님</span>
                              <span className="text-[11px] font-semibold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-full">
                                {t.className || '우리반'}
                              </span>
                            </div>
                            <div className="text-xs text-stone-600 mt-1 flex flex-col gap-0.5">
                              <div>아이디 / 이메일: <strong className="text-stone-800 font-mono select-all">{t.email || t.teacherId}</strong></div>
                              {t.schoolName && (
                                <div className="text-stone-500">
                                  소속: {t.schoolName} {t.grade ? `${t.grade}학년` : ''} {t.classNum ? `${t.classNum}반` : ''}
                                </div>
                              )}
                              <div className="text-stone-500">
                                학급 코드: <strong className="text-[#005da7] font-mono select-all">{t.classCode}</strong>
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="flex gap-2 pt-1 border-t border-stone-100">
                          <button
                            type="button"
                            onClick={() => quickLoginTeacher(t)}
                            className="flex-1 h-9 bg-[#005da7] text-white font-bold text-xs rounded-xl hover:bg-[#004883] shadow-xs flex items-center justify-center gap-1.5 transition-all"
                          >
                            <span className="material-symbols-outlined text-base">login</span>
                            <span>이 계정으로 바로 로그인</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setFindTeacherId(t.email || t.teacherId);
                              if (t.schoolName) setFindSchoolName(t.schoolName);
                              if (t.grade) setFindGrade(t.grade);
                              if (t.classNum) setFindClassNum(t.classNum);
                              setTeacherSubTab('find_password');
                            }}
                            className="px-3 h-9 bg-stone-100 text-stone-700 hover:bg-stone-200 text-xs font-bold rounded-xl flex items-center gap-1 transition-all"
                          >
                            <span className="material-symbols-outlined text-sm">key</span>
                            <span>비밀번호 재설정</span>
                          </button>
                        </div>
                      </div>
                    ))}

                  {detectedTeachers.length === 0 && (
                    <div className="p-6 text-center text-xs text-stone-500 bg-stone-50 rounded-2xl border border-stone-200">
                      등록된 교사 계정 이력이 없습니다.
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-stone-200 text-xs">
                  <button
                    type="button"
                    onClick={() => {
                      setTeacherSubTab('login');
                      setError('');
                      setSuccessMsg('');
                    }}
                    className="font-bold text-stone-600 hover:text-[#005da7] flex items-center gap-1"
                  >
                    <span className="material-symbols-outlined text-sm">arrow_back</span>
                    교사 로그인으로 돌아가기
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setTeacherSubTab('signup');
                      setTeacherClassCode(generateRandomClassCode());
                      setTeacherClassName('우리반');
                      setError('');
                      setSuccessMsg('');
                    }}
                    className="font-bold text-[#005da7] hover:underline"
                  >
                    새 교사 계정 개설하기
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ---------------- STUDENT SECTION ---------------- */}
        {activeTab === 'student' && (
          <form onSubmit={handleStudentLogin} className="flex flex-col gap-4">
            {/* Student Picker Accordion / Toggle */}
            {availableStudents.length > 0 && (
              <div className="bg-blue-50/70 border border-blue-200/80 rounded-2xl p-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm">📋</span>
                    <span className="text-xs font-bold text-blue-900">우리 반 학생 빠른 선택</span>
                    <span className="text-[11px] font-medium text-blue-700 bg-blue-100/80 px-2 py-0.5 rounded-full">
                      {availableStudents.length}명
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowStudentPicker(!showStudentPicker)}
                    className="text-xs font-bold text-[#005da7] hover:underline flex items-center gap-0.5"
                  >
                    <span>{showStudentPicker ? '목록 접기' : '학생 목록 보기'}</span>
                    <span className="material-symbols-outlined text-sm">
                      {showStudentPicker ? 'expand_less' : 'expand_more'}
                    </span>
                  </button>
                </div>

                {showStudentPicker && (
                  <div className="mt-3 pt-3 border-t border-blue-200/60 max-h-48 overflow-y-auto flex flex-wrap gap-1.5">
                    {availableStudents.map(s => {
                      const isSelected = studentIdentifier === s.name || studentIdentifier === String(s.number);
                      return (
                        <button
                          type="button"
                          key={s.id}
                          onClick={() => {
                            setStudentIdentifier(s.name);
                            if (!studentPin) setStudentPin('1234');
                            setShowStudentPicker(false);
                          }}
                          className={`px-2.5 py-1.5 rounded-xl border text-xs font-bold transition-all flex items-center gap-1.5 ${
                            isSelected
                              ? 'bg-[#005da7] text-white border-[#005da7] shadow-sm'
                              : 'bg-white hover:bg-blue-100/70 text-stone-800 border-blue-200 shadow-2xs'
                          }`}
                        >
                          <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-extrabold ${
                            isSelected ? 'bg-white/20 text-white' : 'bg-blue-100 text-[#005da7]'
                          }`}>
                            {s.number}
                          </span>
                          <span>{s.name}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            <div className="border-2 border-[#c1c7d3] rounded-2xl bg-[#f7f9fb] p-3 px-4 focus-within:border-[#005da7] focus-within:bg-white transition-all">
              <label className="block text-xs font-bold text-[#414751] mb-1">
                학생 번호 또는 이름 *
              </label>
              <input
                type="text"
                required
                autoFocus
                placeholder="예: 1 또는 1번, 김민준"
                value={studentIdentifier}
                onChange={e => setStudentIdentifier(e.target.value)}
                className="w-full bg-transparent border-none p-0 focus:ring-0 font-medium text-base text-[#191c1e] placeholder-[#717783]"
              />
              <p className="text-[11px] text-[#717783] mt-1">
                번호(1, 01, 1번), 이름, 아이디 모두 접속 가능합니다. (처음 접속하는 학생 번호도 기본 PIN 1234로 즉시 접속)
              </p>
            </div>

            <div className="border-2 border-[#c1c7d3] rounded-2xl bg-[#f7f9fb] p-3 px-4 focus-within:border-[#005da7] focus-within:bg-white transition-all relative">
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-bold text-[#414751]">
                  비밀번호 (PIN) * <span className="text-[11px] font-normal text-[#717783]">(기본: 1234)</span>
                </label>
                <button
                  type="button"
                  onClick={() => setStudentPin('1234')}
                  className="text-[11px] font-bold text-[#005da7] bg-blue-50 hover:bg-blue-100 px-2 py-0.5 rounded-lg border border-blue-200 transition-colors"
                >
                  기본 PIN(1234) 입력
                </button>
              </div>
              <div className="flex items-center">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  placeholder="**** (기본 1234)"
                  maxLength={10}
                  value={studentPin}
                  onChange={e => setStudentPin(e.target.value)}
                  className={`w-full bg-transparent border-none p-0 focus:ring-0 font-medium text-base text-[#191c1e] placeholder-[#717783] ${
                    !showPassword ? 'tracking-widest' : ''
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="text-[#717783] hover:text-[#005da7] p-1"
                >
                  <span className="material-symbols-outlined text-[20px]">
                    {showPassword ? 'visibility_off' : 'visibility'}
                  </span>
                </button>
              </div>
            </div>

            <div className="border-2 border-[#c1c7d3] rounded-2xl bg-[#f7f9fb] p-3 px-4 focus-within:border-[#005da7] focus-within:bg-white transition-all">
              <label className="block text-xs font-bold text-[#414751] mb-1">
                학급 코드 <span className="text-[11px] font-normal text-[#717783]">(기본: {classCode || 'C-10001'})</span>
              </label>
              <input
                type="text"
                placeholder="예: C-10001"
                value={classCode}
                onChange={e => setClassCode(e.target.value)}
                className="w-full bg-transparent border-none p-0 focus:ring-0 font-medium text-base text-[#191c1e] placeholder-[#717783]"
              />
              <p className="text-[11px] text-[#717783] mt-1">
                선생님께 안내받은 학급 코드를 입력하세요.
              </p>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="btn-press mt-2 w-full h-[54px] bg-[#005da7] text-white font-bold text-base rounded-2xl shadow-[0_4px_12px_rgba(0,93,167,0.25)] hover:bg-[#004883] flex items-center justify-center gap-2 transition-all disabled:opacity-50"
            >
              {isLoading ? (
                <span className="inline-block w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
              ) : (
                <>
                  <span>학생 교실 접속하기</span>
                  <span className="material-symbols-outlined text-lg">login</span>
                </>
              )}
            </button>

            <div className="mt-1 text-center">
              <button
                type="button"
                onClick={async () => {
                  if (!studentIdentifier.trim()) {
                    setError('PIN 재설정을 요청할 학생 이름 또는 번호를 먼저 입력해 주세요.');
                    return;
                  }
                  if (confirm(`'${studentIdentifier.trim()}' 학생의 PIN 비밀번호 재설정을 담임 선생님께 요청하시겠습니까?`)) {
                    setIsLoading(true);
                    const res = await requestPinReset(studentIdentifier.trim(), classCode.trim());
                    setIsLoading(false);
                    if (res.success) {
                      setSuccessMsg(res.message || '선생님께 재설정 요청이 전달되었습니다.');
                    } else {
                      setError(res.message || '재설정 요청 중 오류가 발생했습니다.');
                    }
                  }
                }}
                className="text-xs font-medium text-[#005da7] hover:underline"
              >
                비밀번호(PIN)를 잊어버렸나요? (선생님께 재설정 요청)
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
