import React, { useState } from 'react';
import { useClassEconomy } from '../context/ClassEconomyContext';
import { Student } from '../types';

interface StudentPinModalProps {
  isOpen: boolean;
  onClose: () => void;
  isFirstTime?: boolean;
  student: Student;
}

export const StudentPinModal: React.FC<StudentPinModalProps> = ({
  isOpen,
  onClose,
  isFirstTime = false,
  student
}) => {
  const { changeStudentPin } = useClassEconomy();
  const [currentPinInput, setCurrentPinInput] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showPins, setShowPins] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    const normCurrentPin = currentPinInput.replace(/[０-９]/g, s => String.fromCharCode(s.charCodeAt(0) - 0xFEE0)).trim();
    const normNewPin = newPin.replace(/[０-９]/g, s => String.fromCharCode(s.charCodeAt(0) - 0xFEE0)).trim();
    const normConfirmPin = confirmPin.replace(/[０-９]/g, s => String.fromCharCode(s.charCodeAt(0) - 0xFEE0)).trim();

    // If not first time, optionally check current pin
    const currentExpectedPin = String(student.pin ?? '1234').replace(/[０-９]/g, s => String.fromCharCode(s.charCodeAt(0) - 0xFEE0)).trim();
    if (!isFirstTime && currentExpectedPin && normCurrentPin !== currentExpectedPin) {
      setError('현재 비밀번호가 일치하지 않습니다.');
      return;
    }

    if (normNewPin.length < 4 || normNewPin.length > 6) {
      setError('새 비밀번호는 4~6자리로 입력해 주세요.');
      return;
    }

    if (!/^\d+$/.test(normNewPin)) {
      setError('비밀번호는 숫자 4~6자리로 입력해 주세요.');
      return;
    }

    if (normNewPin === '1234' || normNewPin === '0000') {
      setError('보안을 위해 1234나 0000이 아닌 다른 비밀번호를 설정해 주세요.');
      return;
    }

    if (normNewPin !== normConfirmPin) {
      setError('새 비밀번호와 확인 입력이 일치하지 않습니다.');
      return;
    }

    const res = changeStudentPin(student.id, normNewPin);
    if (res.success) {
      setSuccess('비밀번호가 성공적으로 변경되었습니다!');
      setTimeout(() => {
        onClose();
        setCurrentPinInput('');
        setNewPin('');
        setConfirmPin('');
        setSuccess('');
      }, 1200);
    } else {
      setError(res.message || '비밀번호 변경에 실패했습니다.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-xs animate-in fade-in">
      <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl border border-stone-200 relative overflow-hidden">
        <div className="flex items-center justify-between pb-4 mb-4 border-b border-stone-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/10 text-amber-600 flex items-center justify-center text-xl">
              🔑
            </div>
            <div>
              <h2 className="font-extrabold text-xl text-stone-900">
                {isFirstTime ? '초기 비밀번호 변경' : '비밀번호(PIN) 변경'}
              </h2>
              <p className="text-xs text-stone-500 font-medium">
                {student.name} ({student.number}번) 학생 계정
              </p>
            </div>
          </div>
          {!isFirstTime && (
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-stone-100 text-stone-500 hover:bg-stone-200 flex items-center justify-center transition-colors"
            >
              <span className="material-symbols-outlined text-lg">close</span>
            </button>
          )}
        </div>

        {isFirstTime && (
          <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-2xl text-amber-800 text-xs leading-relaxed flex items-start gap-2">
            <span className="material-symbols-outlined text-lg shrink-0 mt-0.5 text-amber-600">
              shield_lock
            </span>
            <div>
              <span className="font-bold">최초 로그인 안내:</span> 안전한 학급 경제 활동을 위해 기본 비밀번호(1234/0000)에서 나만의 <strong>새로운 4~6자리 비밀번호</strong>로 변경해 주세요.
            </div>
          </div>
        )}

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

        <form onSubmit={handleSubmit} className="space-y-4">
          {!isFirstTime && (
            <div className="space-y-1">
              <label className="block text-xs font-bold text-stone-700">
                현재 비밀번호(PIN)
              </label>
              <input
                type={showPins ? 'text' : 'password'}
                required
                maxLength={6}
                placeholder="현재 PIN 입력"
                value={currentPinInput}
                onChange={e => setCurrentPinInput(e.target.value)}
                className="w-full h-11 px-3.5 bg-stone-50 border-2 border-stone-200 focus:border-[#005da7] focus:bg-white rounded-xl text-sm font-medium focus:outline-none transition-all"
              />
            </div>
          )}

          <div className="space-y-1">
            <label className="block text-xs font-bold text-stone-700">
              새 비밀번호 (숫자 4~6자리)
            </label>
            <input
              type={showPins ? 'text' : 'password'}
              required
              maxLength={6}
              placeholder="숫자 4~6자리 입력"
              value={newPin}
              onChange={e => setNewPin(e.target.value)}
              className="w-full h-11 px-3.5 bg-stone-50 border-2 border-stone-200 focus:border-[#005da7] focus:bg-white rounded-xl text-sm font-medium focus:outline-none transition-all tracking-wider"
            />
          </div>

          <div className="space-y-1">
            <label className="block text-xs font-bold text-stone-700">
              새 비밀번호 확인
            </label>
            <input
              type={showPins ? 'text' : 'password'}
              required
              maxLength={6}
              placeholder="새 비밀번호 한번 더 입력"
              value={confirmPin}
              onChange={e => setConfirmPin(e.target.value)}
              className="w-full h-11 px-3.5 bg-stone-50 border-2 border-stone-200 focus:border-[#005da7] focus:bg-white rounded-xl text-sm font-medium focus:outline-none transition-all tracking-wider"
            />
          </div>

          <div className="flex items-center justify-between text-xs text-stone-500 pt-1">
            <label className="flex items-center gap-1.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={showPins}
                onChange={e => setShowPins(e.target.checked)}
                className="rounded text-[#005da7] focus:ring-0"
              />
              <span>입력한 번호 보기</span>
            </label>
          </div>

          <div className="pt-2 flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 h-12 bg-stone-100 hover:bg-stone-200 text-stone-700 font-bold text-sm rounded-2xl transition-colors"
            >
              {isFirstTime ? '다음에 변경' : '취소'}
            </button>
            <button
              type="submit"
              className="flex-1 h-12 bg-[#005da7] hover:bg-[#004883] text-white font-bold text-sm rounded-2xl shadow-md transition-all flex items-center justify-center gap-1.5"
            >
              <span className="material-symbols-outlined text-lg">check</span>
              <span>비밀번호 변경하기</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
