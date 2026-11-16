import React, { useState } from 'react';
import { useClassEconomy } from '../context/ClassEconomyContext';

interface BulkStudentModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const BulkStudentModal: React.FC<BulkStudentModalProps> = ({ isOpen, onClose }) => {
  const { addStudent, addBulkStudents, createNumberedStudents, state } = useClassEconomy();
  const [mode, setMode] = useState<'single' | 'bulk' | 'numbered'>('bulk');
  const [nameInput, setNameInput] = useState('');
  const [singleName, setSingleName] = useState('');
  const [singleUsername, setSingleUsername] = useState('');
  const [singlePin, setSinglePin] = useState('1234');
  const [numberedCount, setNumberedCount] = useState(25);
  const [initialCash, setInitialCash] = useState(30000);

  if (!isOpen) return null;

  const handleSingleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!singleName.trim()) return;
    addStudent(singleName.trim(), singleUsername.trim() || undefined, singlePin.trim() || '1234', initialCash);
    setSingleName('');
    setSingleUsername('');
    setSinglePin('1234');
    onClose();
  };

  const handleBulkSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const names = nameInput
      .split(/[\n,]+/)
      .map(n => n.trim())
      .filter(Boolean);
    if (names.length === 0) {
      alert('등록할 학생 이름을 1명 이상 입력해 주세요.');
      return;
    }
    addBulkStudents(names, initialCash);
    setNameInput('');
    onClose();
  };

  const handleNumberedSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (numberedCount <= 0) {
      alert('생성할 학생 수는 1명 이상이어야 합니다.');
      return;
    }
    createNumberedStudents(numberedCount, initialCash);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#1a1a1a]/40 backdrop-blur-2xs p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-sm max-w-lg w-full p-6 shadow-2xl border border-[#1a1a1a]/15 relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-[#1a1a1a]/50 hover:text-[#1a1a1a] w-8 h-8 flex items-center justify-center rounded-2xs hover:bg-[#faf8f5]"
        >
          <span className="material-symbols-outlined text-[18px]">close</span>
        </button>

        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-2xs bg-[#faf8f5] border border-[#1a1a1a]/15 text-[#1a1a1a] flex items-center justify-center font-bold text-xl">
            👨‍🎓
          </div>
          <div>
            <h3 className="font-editorial text-xl font-bold text-[#1a1a1a]">학생 계정 등록</h3>
            <p className="text-[11px] text-[#1a1a1a]/60">교사가 직접 학생을 개별 등록하거나 명단을 일괄 등록합니다.</p>
          </div>
        </div>

        <div className="flex bg-[#faf8f5] p-1 rounded-2xs border border-[#1a1a1a]/15 mb-4">
          <button
            type="button"
            onClick={() => setMode('bulk')}
            className={`flex-1 py-1.5 text-xs font-bold uppercase tracking-wider rounded-2xs transition-all ${
              mode === 'bulk' ? 'bg-[#1a1a1a] text-white shadow-2xs' : 'text-[#1a1a1a]/70 hover:text-[#1a1a1a]'
            }`}
          >
            명단 일괄 등록
          </button>
          <button
            type="button"
            onClick={() => setMode('single')}
            className={`flex-1 py-1.5 text-xs font-bold uppercase tracking-wider rounded-2xs transition-all ${
              mode === 'single' ? 'bg-[#1a1a1a] text-white shadow-2xs' : 'text-[#1a1a1a]/70 hover:text-[#1a1a1a]'
            }`}
          >
            개별 등록
          </button>
          <button
            type="button"
            onClick={() => setMode('numbered')}
            className={`flex-1 py-1.5 text-xs font-bold uppercase tracking-wider rounded-2xs transition-all ${
              mode === 'numbered' ? 'bg-[#1a1a1a] text-white shadow-2xs' : 'text-[#1a1a1a]/70 hover:text-[#1a1a1a]'
            }`}
          >
            번호형 일괄 생성
          </button>
        </div>

        {/* Global Initial Cash setting */}
        <div className="mb-4 p-3 bg-[#faf8f5] rounded-2xs border border-[#1a1a1a]/15 flex items-center justify-between">
          <div>
            <label className="block text-xs font-bold text-[#1a1a1a]">초기 지급 현금</label>
            <span className="text-[11px] text-[#1a1a1a]/60">신규 등록 학생에게 지급될 초기 자금</span>
          </div>
          <div className="flex items-center gap-1">
            <input
              type="number"
              min="0"
              step="1000"
              value={initialCash}
              onChange={e => setInitialCash(Number(e.target.value))}
              className="w-28 px-2 py-1.5 bg-white border border-[#1a1a1a]/20 rounded-2xs font-mono font-bold text-xs text-right text-[#1a1a1a]"
            />
            <span className="text-xs font-bold text-[#1a1a1a]">{state.currencyUnit || '원'}</span>
          </div>
        </div>

        {mode === 'single' && (
          <form onSubmit={handleSingleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-[#1a1a1a]/70 mb-1">
                학생 이름 *
              </label>
              <input
                type="text"
                placeholder="예: 김민준"
                value={singleName}
                onChange={e => setSingleName(e.target.value)}
                required
                className="w-full px-3 py-2 rounded-2xs border border-[#1a1a1a]/20 focus:border-[#1a1a1a] focus:ring-0 font-medium text-xs text-[#1a1a1a] bg-[#faf8f5]"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-[#1a1a1a]/70 mb-1">
                  아이디 (선택)
                </label>
                <input
                  type="text"
                  placeholder={`예: student_${String(state.students.length + 1).padStart(2, '0')}`}
                  value={singleUsername}
                  onChange={e => setSingleUsername(e.target.value)}
                  className="w-full px-3 py-2 rounded-2xs border border-[#1a1a1a]/20 focus:border-[#1a1a1a] focus:ring-0 text-xs font-mono bg-[#faf8f5]"
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-[#1a1a1a]/70 mb-1">
                  초기 PIN (선택)
                </label>
                <input
                  type="text"
                  maxLength={6}
                  placeholder="1234"
                  value={singlePin}
                  onChange={e => setSinglePin(e.target.value)}
                  className="w-full px-3 py-2 rounded-2xs border border-[#1a1a1a]/20 focus:border-[#1a1a1a] focus:ring-0 text-xs font-mono bg-[#faf8f5]"
                />
              </div>
            </div>
            <p className="text-[11px] text-[#1a1a1a]/70 bg-emerald-50 p-2.5 rounded-2xs border border-emerald-300/60">
              💡 신규 생성된 학생의 초기 PIN 비밀번호는 <span className="font-bold text-emerald-900">1234</span>(또는 입력한 번호)로 설정됩니다.
            </p>
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-2 rounded-2xs font-bold text-xs uppercase tracking-wider text-[#1a1a1a]/70 hover:bg-[#faf8f5]"
              >
                취소
              </button>
              <button
                type="submit"
                className="flex-1 py-2 rounded-2xs bg-[#1a1a1a] text-white font-bold text-xs uppercase tracking-wider hover:bg-stone-800 transition-colors shadow-2xs"
              >
                학생 1명 등록
              </button>
            </div>
          </form>
        )}

        {mode === 'bulk' && (
          <form onSubmit={handleBulkSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-[#1a1a1a]/70 mb-1">
                학급 출석부 명단 붙여넣기 (줄바꿈 또는 쉼표 구분) *
              </label>
              <textarea
                rows={6}
                placeholder={`김민준\n이서아\n박도윤\n최지우\n정예준\n강하은\n조시우\n윤서연`}
                value={nameInput}
                onChange={e => setNameInput(e.target.value)}
                required
                className="w-full p-3 rounded-2xs border border-[#1a1a1a]/20 focus:border-[#1a1a1a] focus:ring-0 text-xs font-mono bg-[#faf8f5] leading-relaxed"
              />
            </div>
            <p className="text-[11px] text-[#1a1a1a]/70 bg-emerald-50 p-2.5 rounded-2xs border border-emerald-300/60">
              💡 한 줄에 한 명씩 이름을 입력하면 순차적으로 번호와 아이디(student_01, student_02...)가 생성되며 초기 PIN은 1234로 지정됩니다.
            </p>
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-2 rounded-2xs font-bold text-xs uppercase tracking-wider text-[#1a1a1a]/70 hover:bg-[#faf8f5]"
              >
                취소
              </button>
              <button
                type="submit"
                className="flex-1 py-2 rounded-2xs bg-[#1a1a1a] text-white font-bold text-xs uppercase tracking-wider hover:bg-stone-800 transition-colors shadow-2xs"
              >
                명단 일괄 등록하기
              </button>
            </div>
          </form>
        )}

        {mode === 'numbered' && (
          <form onSubmit={handleNumberedSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-[#1a1a1a]/70 mb-1">
                생성할 학생 계정 수 *
              </label>
              <div className="flex gap-2">
                <input
                  type="number"
                  min="1"
                  max="60"
                  value={numberedCount}
                  onChange={e => setNumberedCount(Number(e.target.value))}
                  required
                  className="w-32 px-3 py-2 rounded-2xs border border-[#1a1a1a]/20 focus:border-[#1a1a1a] focus:ring-0 text-xs font-mono font-bold bg-[#faf8f5]"
                />
                <div className="flex flex-wrap gap-1">
                  {[20, 25, 30, 35, 40].map(cnt => (
                    <button
                      key={cnt}
                      type="button"
                      onClick={() => setNumberedCount(cnt)}
                      className={`px-3 py-1 text-xs font-bold rounded-2xs border transition-colors ${
                        numberedCount === cnt
                          ? 'bg-[#1a1a1a] text-white border-[#1a1a1a]'
                          : 'bg-[#faf8f5] text-[#1a1a1a] border-[#1a1a1a]/15 hover:bg-[#f0ede6]'
                      }`}
                    >
                      {cnt}명
                    </button>
                  ))}
                </div>
              </div>
              <p className="text-[11px] text-[#1a1a1a]/60 mt-1">
                선택한 인원만큼 '1번 학생', '2번 학생'... 계정이 순서대로 생성됩니다.
              </p>
            </div>
            <p className="text-[11px] text-[#1a1a1a]/70 bg-emerald-50 p-2.5 rounded-2xs border border-emerald-300/60">
              💡 번호별 계정의 초기 PIN 비밀번호는 <span className="font-bold text-emerald-900">1234</span>로 자동 지정됩니다.
            </p>
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-2 rounded-2xs font-bold text-xs uppercase tracking-wider text-[#1a1a1a]/70 hover:bg-[#faf8f5]"
              >
                취소
              </button>
              <button
                type="submit"
                className="flex-1 py-2 rounded-2xs bg-[#1a1a1a] text-white font-bold text-xs uppercase tracking-wider hover:bg-stone-800 transition-colors shadow-2xs"
              >
                {numberedCount}명 번호 계정 생성
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
