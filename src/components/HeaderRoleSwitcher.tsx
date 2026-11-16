import React from 'react';
import { useClassEconomy } from '../context/ClassEconomyContext';

export const HeaderRoleSwitcher: React.FC = () => {
  const { role, isCloudConnected, state } = useClassEconomy();

  // In teacher and student dashboards, each has a dedicated, complete, and polished header.
  // We only show a subtle global banner in guest mode if needed.
  if (role !== 'guest') {
    return null;
  }

  return (
    <div className="bg-[#1a1a1a] text-white px-4 py-2 text-xs font-medium flex justify-between items-center z-50 border-b border-stone-800 shadow-2xs">
      <div className="flex items-center gap-2.5">
        <span className="font-editorial italic font-bold tracking-wider text-amber-200 border border-amber-400/30 px-2 py-0.5 rounded-2xs bg-stone-900/80 text-[11px]">
          KIDS RICH
        </span>
        <span className="text-stone-300 font-medium text-xs">
          초등 학급 경제 시뮬레이션 플랫폼
        </span>
      </div>

      <div className="flex items-center gap-2">
        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] bg-emerald-950/80 text-emerald-300 border border-emerald-700/50">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
          <span>Firestore 클라우드 연동</span>
        </span>
        <span className="text-stone-400 text-xs hidden sm:inline">
          학급 코드: <strong className="text-amber-200 font-mono">{state.classCode}</strong>
        </span>
      </div>
    </div>
  );
};

