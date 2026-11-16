import React, { useState } from 'react';
import { useClassEconomy } from '../context/ClassEconomyContext';

interface AddShopItemModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AddShopItemModal: React.FC<AddShopItemModalProps> = ({ isOpen, onClose }) => {
  const { addShopItem } = useClassEconomy();
  const [name, setName] = useState('');
  const [price, setPrice] = useState(5000);
  const [icon, setIcon] = useState('🎁');
  const [description, setDescription] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || price <= 0) return;
    addShopItem({
      name: name.trim(),
      price,
      icon,
      description: description.trim() || '학급 특권 및 상품'
    });
    setName('');
    setPrice(5000);
    setDescription('');
    onClose();
  };

  const iconsList = ['🪑', '📝', '🧹', '🍱', '⏰', '🎮', '🍫', '📚', '🎨', '👑', '🎫', '🎁'];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#1a1a1a]/40 backdrop-blur-2xs p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-sm max-w-md w-full p-6 shadow-2xl border border-[#1a1a1a]/15 relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-[#1a1a1a]/50 hover:text-[#1a1a1a] w-8 h-8 flex items-center justify-center rounded-2xs hover:bg-[#faf8f5]"
        >
          <span className="material-symbols-outlined text-[18px]">close</span>
        </button>

        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-2xs bg-[#faf8f5] border border-[#1a1a1a]/15 text-[#1a1a1a] flex items-center justify-center font-bold text-xl">
            🏪
          </div>
          <div>
            <h3 className="font-editorial text-xl font-bold text-[#1a1a1a]">새 학급 상품 등록</h3>
            <p className="text-[11px] text-[#1a1a1a]/60">학생들이 현금으로 결제할 특권 및 쿠폰을 등록하세요.</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-[#1a1a1a]/70 mb-1">아이콘 선택</label>
            <div className="flex flex-wrap gap-1.5 p-2 bg-[#faf8f5] rounded-2xs border border-[#1a1a1a]/15">
              {iconsList.map(ic => (
                <button
                  type="button"
                  key={ic}
                  onClick={() => setIcon(ic)}
                  className={`w-8 h-8 rounded-2xs text-base flex items-center justify-center transition-all ${
                    icon === ic ? 'bg-[#1a1a1a] text-white shadow-2xs' : 'hover:bg-stone-200'
                  }`}
                >
                  {ic}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-[#1a1a1a]/70 mb-1">상품명</label>
            <input
              type="text"
              placeholder="예: 자유시간 15분권"
              value={name}
              onChange={e => setName(e.target.value)}
              required
              className="w-full px-3 py-2 rounded-2xs border border-[#1a1a1a]/20 focus:border-[#1a1a1a] focus:ring-0 font-bold text-sm text-[#1a1a1a] bg-[#faf8f5]"
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-[#1a1a1a]/70 mb-1">가격 (원)</label>
            <input
              type="number"
              step="500"
              min="500"
              value={price}
              onChange={e => setPrice(Number(e.target.value))}
              required
              className="w-full px-3 py-2 rounded-2xs border border-[#1a1a1a]/20 focus:border-[#1a1a1a] focus:ring-0 font-mono font-bold text-base text-[#1a1a1a] bg-[#faf8f5]"
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-[#1a1a1a]/70 mb-1">상품 설명</label>
            <input
              type="text"
              placeholder="예: 쉬는 시간 15분 동안 보드게임 가능"
              value={description}
              onChange={e => setDescription(e.target.value)}
              className="w-full px-3 py-2 rounded-2xs border border-[#1a1a1a]/20 focus:border-[#1a1a1a] focus:ring-0 text-xs text-[#1a1a1a] bg-[#faf8f5]"
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-2xs font-bold text-xs uppercase tracking-wider text-[#1a1a1a]/70 hover:bg-[#faf8f5]"
            >
              취소
            </button>
            <button
              type="submit"
              className="flex-1 py-2.5 rounded-2xs bg-[#1a1a1a] text-white font-bold text-xs uppercase tracking-wider hover:bg-stone-800 shadow-2xs transition-colors"
            >
              상품 등록하기
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
