import React, { useState, useEffect } from 'react';
import { useClassEconomy } from '../context/ClassEconomyContext';
import { Student } from '../types';

interface TeacherStudentPinModalProps {
  isOpen: boolean;
  onClose: () => void;
  student: Student | null;
  targetStudents?: Student[];
}

export const TeacherStudentPinModal: React.FC<TeacherStudentPinModalProps> = ({
  isOpen,
  onClose,
  student,
  targetStudents = []
}) => {
  const { updateStudentPinByTeacher, updateMultipleStudentsPinByTeacher } = useClassEconomy();
  const [newPin, setNewPin] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const isBulkMode = targetStudents.length > 1;

  useEffect(() => {
    if (isOpen) {
      setNewPin('');
      setError('');
      setSuccess('');
    }
  }, [student, targetStudents, isOpen]);

  if (!isOpen) return null;
  if (!isBulkMode && !student) return null;

  const handleQuickSet = (pinVal: string) => {
    setNewPin(pinVal);
  };

  const handleGenerateRandom = () => {
    const rand = Math.floor(1000 + Math.random() * 9000).toString();
    setNewPin(rand);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    const cleanPin = newPin.trim();

    if (cleanPin.length < 4 || cleanPin.length > 6) {
      setError('PIN 번호는 4~6자리로 입력해 주세요.');
      return;
    }

    if (!/^\d+$/.test(cleanPin)) {
      setError('PIN 번호는 숫자로만 입력해 주세요.');
      return;
    }

    if (isBulkMode) {
      const studentIds = targetStudents.map(s => s.id);
      const res = updateMultipleStudentsPinByTeacher(studentIds, cleanPin);
      if (res.success) {
        setSuccess(res.message || `${studentIds.length}명의 PIN이 변경되었습니다.`);
        setTimeout(() => {
          onClose();
          setSuccess('');
        }, 1200);
      } else {
        setError(res.message || '일괄 PIN 변경에 실패했습니다.');
      }
    } else if (student) {
      const res = updateStudentPinByTeacher(student.id, cleanPin);
      if (res.success) {
        setSuccess(res.message || 'PIN 번호가 성공적으로 변경되었습니다.');
        setTimeout(() => {
          onClose();
          setSuccess('');
        }, 1200);
      } else {
        setError(res.message || 'PIN 변경에 실패했습니다.');
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-xs animate-in fade-in">
      <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl border border-stone-200 relative overflow-hidden">
        <div className="flex items-center justify-between pb-4 mb-4 border-b border-stone-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-50 text-blue-700 flex items-center justify-center text-xl">
              👨‍🏫
            </div>
            <div>
              <h2 className="font-extrabold text-xl text-stone-900">
                {isBulkMode
                  ? `선택 학생 (${targetStudents.length}명) PIN 일괄 변경`
                  : '학생 비밀번호(PIN) 직접 변경'}
              </h2>
              <p className="text-xs text-stone-500 font-medium">
                {isBulkMode
                  ? `${targetStudents.slice(0, 3).map(s => s.name).join(', ')}${targetStudents.length > 3 ? ` 외 ${targetStudents.length - 3}명` : ''}`
                  : `${student?.name} (${student?.number}번 · ${student?.username})`}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-stone-100 text-stone-500 hover:bg-stone-200 flex items-center justify-center transition-colors"
          >
            <span className="material-symbols-outlined text-lg">close</span>
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-2xl text-rose-700 text-xs font-semibold flex items-center gap-2">
            <span className="material-symbols-outlined text-base shrink-0">error</span>
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 rounded-2xl text-emerald-800 text-xs font-semibold flex items-center gap-2">
            <span className="material-symbols-outlined text-base shrink-0">check_circle</span>
            <span>{success}</span>
          </div>
        )}

        {!isBulkMode && student && (
          <div className="mb-5 p-3.5 bg-stone-50 rounded-2xl border border-stone-200/80 flex items-center justify-between">
            <div>
              <div className="text-[11px] font-bold text-stone-400">현재 등록된 PIN</div>
              <div className="font-mono font-bold text-base text-stone-800 tracking-wider">
                {student.pin || '미설정(1234)'}
              </div>
            </div>
            <div className="text-right">
              <div className="text-[11px] font-bold text-stone-400">비번 상태</div>
              <span className={`inline-block px-2 py-0.5 rounded-md text-[10px] font-bold ${
                student.pinResetRequested
                  ? 'bg-rose-100 text-rose-800'
                  : student.isPinChanged
                  ? 'bg-emerald-100 text-emerald-800'
                  : 'bg-amber-100 text-amber-800'
              }`}>
                {student.pinResetRequested
                  ? '재설정 요청중'
                  : student.isPinChanged
                  ? '학생 변경완료'
                  : '초기 기본값'}
              </span>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-stone-700">
              {isBulkMode ? '선택 학생 공통 적용할 새 PIN (4~6자리)' : '새로 지정할 PIN 번호 (숫자 4~6자리)'}
            </label>
            <input
              type="text"
              required
              maxLength={6}
              placeholder="예: 1234"
              value={newPin}
              onChange={e => setNewPin(e.target.value)}
              className="w-full h-12 px-4 bg-stone-50 border-2 border-stone-200 focus:border-[#005da7] focus:bg-white rounded-2xl text-base font-mono font-bold focus:outline-none transition-all tracking-widest text-center"
            />
          </div>

          <div className="flex flex-wrap gap-2 pt-1">
            <span className="text-[11px] font-bold text-stone-400 w-full mb-0.5">빠른 지정:</span>
            <button
              type="button"
              onClick={() => handleQuickSet('1234')}
              className="px-3 py-1.5 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-xl text-xs font-bold transition-colors"
            >
              1234 (기본값)
            </button>
            <button
              type="button"
              onClick={() => handleQuickSet('0000')}
              className="px-3 py-1.5 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-xl text-xs font-bold transition-colors"
            >
              0000 (초기화)
            </button>
            <button
              type="button"
              onClick={handleGenerateRandom}
              className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-xl text-xs font-bold transition-colors flex items-center gap-1"
            >
              <span className="material-symbols-outlined text-[14px]">casino</span>
              랜덤 4자리
            </button>
          </div>

          <div className="pt-3 flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 h-12 bg-stone-100 hover:bg-stone-200 text-stone-700 font-bold text-sm rounded-2xl transition-colors"
            >
              취소
            </button>
            <button
              type="submit"
              className="flex-1 h-12 bg-[#005da7] hover:bg-[#004883] text-white font-bold text-sm rounded-2xl shadow-md transition-all flex items-center justify-center gap-1.5"
            >
              <span className="material-symbols-outlined text-lg">check</span>
              <span>{isBulkMode ? '일괄 변경 저장' : 'PIN 변경 저장'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
