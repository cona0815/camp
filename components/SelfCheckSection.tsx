import React, { useState } from 'react';
import { CarFront, Home, ClipboardList, Tent, Package, Check, Printer, User as UserIcon, Lock, Backpack } from 'lucide-react';
import { GearItem, Ingredient, User, MealPlan } from '../types';
import { TRIP_INFO } from '../constants';

interface SelfCheckSectionProps {
  gearList: GearItem[];
  ingredients: Ingredient[];
  mealPlans: MealPlan[]; 
  currentUser: User;
  checkedDeparture: Record<string, boolean>;
  setCheckedDeparture: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  checkedReturn: Record<string, boolean>;
  setCheckedReturn: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
}

const SelfCheckSection: React.FC<SelfCheckSectionProps> = ({ 
  gearList, 
  ingredients, 
  mealPlans, 
  currentUser,
  checkedDeparture,
  setCheckedDeparture,
  checkedReturn,
  setCheckedReturn
}) => {
  const [mode, setMode] = useState<'departure' | 'return'>('departure'); 

  const checkedItems = mode === 'departure' ? checkedDeparture : checkedReturn;
  const setCheckedItems = mode === 'departure' ? setCheckedDeparture : setCheckedReturn;

  // Split Gear by Category
  const publicGear = gearList.filter(item => item.category === 'public').sort((a, b) => {
      // Sort: Mine first, then Others, then Unclaimed
      const aIsMine = a.owner?.id === currentUser.id;
      const bIsMine = b.owner?.id === currentUser.id;
      const aHasOwner = !!a.owner;
      const bHasOwner = !!b.owner;

      if (aIsMine && !bIsMine) return -1;
      if (!aIsMine && bIsMine) return 1;
      if (aHasOwner && !bHasOwner) return -1;
      if (!aHasOwner && bHasOwner) return 1;
      return 0;
  });

  const personalGear = gearList.filter(item => item.category === 'personal');
  
  const myIngredients = ingredients.filter(item => item.owner.id === currentUser.id);
  
  const toggleCheck = (id: string) => {
    setCheckedItems(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  const calculateProgress = () => {
    // Total includes: My Personal Gear + My Public Gear + My Ingredients
    // We ignore other people's gear in the progress bar calculation to focus on "My Job"
    const myPublicGear = publicGear.filter(g => g.owner?.id === currentUser.id);
    const myPersonalGear = personalGear; 

    const total = myPublicGear.length + myPersonalGear.length + myIngredients.length;
    if (total === 0) return 0;

    const checkedCount = [
        ...myPublicGear,
        ...myPersonalGear
    ].filter(item => checkedItems[`gear-${item.id}`]).length + 
    myIngredients.filter(item => checkedItems[`food-${item.id}`]).length;

    return Math.round((checkedCount / total) * 100);
  };

  const progress = calculateProgress();
  const isDeparture = mode === 'departure';

  // PDF / Print Generation Logic
  const handleExportPDF = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    // Sort plans by Day, then by Meal order
    const sortedPlans = [...mealPlans].sort((a, b) => {
        if (a.dayLabel !== b.dayLabel) return a.dayLabel.localeCompare(b.dayLabel, 'zh-TW');
        const order = { breakfast: 1, lunch: 2, dinner: 3 };
        return (order[a.mealType] || 4) - (order[b.mealType] || 4);
    });

    const getMealLabel = (type: string) => {
        if (type === 'breakfast') return '早餐';
        if (type === 'lunch') return '午餐';
        if (type === 'dinner') return '晚餐';
        return '餐點';
    };

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>露營清單 - ${TRIP_INFO.title}</title>
        <style>
          body { font-family: "Microsoft JhengHei", "Heiti TC", sans-serif; padding: 40px; color: #333; line-height: 1.5; }
          h1 { text-align: center; color: #5D4632; border-bottom: 3px solid #7BC64F; padding-bottom: 10px; margin-bottom: 20px; }
          .meta { text-align: center; color: #666; font-size: 0.9em; margin-bottom: 40px; }
          
          h2 { background-color: #F2CC8F; color: #5D4632; padding: 8px 15px; border-radius: 5px; margin-top: 30px; margin-bottom: 15px; font-size: 1.2em; -webkit-print-color-adjust: exact; }
          h3 { color: #2A9D8F; border-bottom: 2px dashed #E0D8C0; padding-bottom: 5px; margin-top: 20px; font-size: 1.1em; -webkit-print-color-adjust: exact; }
          
          .list-container { display: flex; flex-wrap: wrap; gap: 10px; }
          .item-row { width: 48%; display: flex; align-items: center; margin-bottom: 8px; border-bottom: 1px dotted #ccc; padding-bottom: 2px; }
          .checkbox { width: 16px; height: 16px; border: 2px solid #5D4632; margin-right: 10px; display: inline-block; position: relative; }
          
          /* Forced Check Style for PDF */
          .checkbox.forced:after { content: '✔'; position: absolute; top: -5px; left: 1px; font-size: 18px; color: #aaa; }
          .item-name.forced, .text-forced { text-decoration: line-through; color: #aaa; }

          .item-name { font-weight: bold; }
          .item-owner { font-size: 0.8em; color: #888; margin-left: auto; background: #eee; padding: 1px 6px; border-radius: 10px; -webkit-print-color-adjust: exact; }
          
          @media print {
             body { padding: 0; }
             h2 { background-color: #eee !important; color: #000 !important; }
          }
        </style>
      </head>
      <body>
        <h1>🏕️ ${TRIP_INFO.title} 露營清單</h1>
        <div class="meta">
          日期：${TRIP_INFO.date} | 地點：${TRIP_INFO.location} | 使用者：${currentUser.name}
        </div>

        <!-- GEAR SECTION -->
        <h2>🎒 裝備清單</h2>
        
        <h3>📍 公用裝備 (分配認領)</h3>
        <div class="list-container">
          ${publicGear.map(item => {
            // PDF Logic: If owned by someone else, force check and strikethrough
            const isOthers = item.owner && item.owner.id !== currentUser.id;
            const isChecked = isOthers ? true : checkedItems[`gear-${item.id}`];
            
            return `
            <div class="item-row">
              <span class="checkbox ${isChecked ? 'forced' : ''}"></span>
              <span class="item-name ${isChecked ? 'forced' : ''}">${item.name}</span>
              ${item.owner ? `<span class="item-owner">${item.owner.name}</span>` : '<span class="item-owner" style="color:red">未認領</span>'}
            </div>
          `}).join('')}
          ${publicGear.length === 0 ? '<p>無公用裝備</p>' : ''}
        </div>

        <h3>📍 個人裝備 (請自行檢查)</h3>
        <div class="list-container">
          ${personalGear.map(item => `
            <div class="item-row">
              <span class="checkbox ${checkedItems[`gear-${item.id}`] ? 'forced' : ''}"></span>
              <span class="item-name ${checkedItems[`gear-${item.id}`] ? 'forced' : ''}">${item.name}</span>
            </div>
          `).join('')}
          ${personalGear.length === 0 ? '<p>無設定個人裝備</p>' : ''}
        </div>
        
        <!-- MENU SECTION -->
        <h2 style="page-break-before: always;">🥘 菜單與食材表</h2>
        
        ${sortedPlans.map(plan => `
            <div style="margin-bottom: 20px; border: 1px solid #ddd; padding: 15px; border-radius: 8px; page-break-inside: avoid;">
                <div style="font-weight: bold; font-size: 1.1em; color: #5D4632; margin-bottom: 10px;">
                    ${plan.dayLabel} - ${getMealLabel(plan.mealType)} : ${plan.menuName}
                </div>
                
                <div style="background: #f9f9f9; padding: 10px; border-radius: 5px; -webkit-print-color-adjust: exact;">
                    <strong>🛒 需帶食材：</strong>
                    <div style="display: flex; flex-wrap: wrap; margin-top: 5px;">
                        ${plan.checklist.map(item => {
                            // Check if this item belongs to "others"
                            let isOthers = false;
                            
                            // 1. Try to find source ingredient for accurate ID comparison
                            if (item.sourceIngredientId) {
                                const sourceIng = ingredients.find(i => i.id === item.sourceIngredientId);
                                if (sourceIng && sourceIng.owner.id !== currentUser.id) {
                                    isOthers = true;
                                }
                            } else if (item.owner && item.owner.name !== currentUser.name) {
                                // 2. Fallback: check name if custom item
                                isOthers = true;
                            }
                            
                            // Logic: Forced check if Others OR if User manually checked it in app (only applies if sourceIng exists for now)
                            let isChecked = isOthers;
                            if (!isChecked && item.sourceIngredientId && checkedItems[`food-${item.sourceIngredientId}`]) {
                                isChecked = true;
                            }

                            return `
                            <div style="width: 50%; display: flex; align-items: center; margin-bottom: 4px;">
                                <span class="checkbox ${isChecked ? 'forced' : ''}" style="width: 12px; height: 12px; border-width: 1px;"></span>
                                <span class="${isChecked ? 'text-forced' : ''}">${item.name}</span>
                                ${item.owner ? `<span style="font-size:0.7em; color:#999; margin-left: 5px;">(${item.owner.name})</span>` : ''}
                            </div>
                        `}).join('')}
                        ${plan.checklist.length === 0 ? '<span style="color:#999">無特殊食材</span>' : ''}
                    </div>
                </div>
            </div>
        `).join('')}

        <script>
          window.onload = () => {
             setTimeout(() => { window.print(); }, 500);
          }
        </script>
      </body>
      </html>
    `;

    printWindow.document.write(htmlContent);
    printWindow.document.close();
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="bg-[#FFFEF5] p-2 rounded-full shadow-sm border border-[#E0D8C0] flex gap-2 sticky top-0 z-10">
        <button 
          onClick={() => setMode('departure')}
          className={`flex-1 py-3 rounded-full text-sm font-bold flex items-center justify-center gap-2 transition-all active:scale-95 ${
            mode === 'departure' ? 'bg-[#8ECAE6] text-[#5D4632] shadow-md' : 'text-[#8C7B65] hover:bg-[#F2F7E6]'
          }`}
        >
          <CarFront size={18} />
          出發前
        </button>
        <button 
          onClick={() => setMode('return')}
          className={`flex-1 py-3 rounded-full text-sm font-bold flex items-center justify-center gap-2 transition-all active:scale-95 ${
            mode === 'return' ? 'bg-[#F4A261] text-white shadow-md' : 'text-[#8C7B65] hover:bg-[#F2F7E6]'
          }`}
        >
          <Home size={18} />
          撤收時
        </button>
      </div>

      {/* Export Button */}
      <div className="flex justify-end px-2">
         <button 
            onClick={handleExportPDF}
            className="flex items-center gap-2 bg-[#5D4632] text-[#F2CC8F] px-4 py-2 rounded-full font-bold text-sm shadow-sm hover:bg-[#4a3828] active:scale-95 transition-all"
         >
            <Printer size={16} /> 匯出 PDF 清單
         </button>
      </div>

      <div className={`bg-[#FFFEF5] p-5 rounded-3xl shadow-sm border border-[#E0D8C0]`}>
        <div className="flex justify-between items-end mb-3">
          <h3 className={`font-bold flex items-center gap-2 ${isDeparture ? 'text-[#219EBC]' : 'text-[#E76F51]'}`}>
            <ClipboardList size={20} />
            {isDeparture ? '出發裝載進度' : '撤收檢查進度'}
          </h3>
          <span className={`text-3xl font-bold ${isDeparture ? 'text-[#219EBC]' : 'text-[#E76F51]'}`}>{progress}%</span>
        </div>
        <div className="w-full bg-[#E0D8C0]/30 rounded-full h-4 overflow-hidden">
          <div 
            className={`h-4 rounded-full transition-all duration-500 ease-out ${isDeparture ? 'bg-[#8ECAE6]' : 'bg-[#F4A261]'}`} 
            style={{ width: `${progress}%` }}
          ></div>
        </div>
        <p className="text-xs text-[#8C7B65] mt-2 text-right">
           * 進度僅計算您負責的項目
        </p>
      </div>

      {/* 1. 公用裝備區塊 */}
      <div className="bg-[#FFFEF5] rounded-3xl shadow-sm border border-[#E0D8C0] overflow-hidden">
        <div className="bg-[#8ECAE6]/20 px-5 py-4 border-b border-[#E0D8C0]">
          <h4 className="font-bold text-[#5D4632] flex items-center gap-2 text-lg">
            <Tent size={20} className="text-[#219EBC]" />
            公用裝備 ({publicGear.length})
          </h4>
        </div>
        <div className="divide-y divide-[#E0D8C0]">
          {publicGear.length > 0 ? publicGear.map(item => {
            // App UI Logic: 
            // - If it's mine: I can check it.
            // - If it's others: I can see it, but I cannot check it (it represents their status).
            // - Currently we simulate local checking only.
            
            const isOthers = item.owner && item.owner.id !== currentUser.id;
            const isMine = item.owner?.id === currentUser.id;
            const isChecked = checkedItems[`gear-${item.id}`];

            return (
              <div 
                key={`gear-${item.id}`} 
                onClick={() => {
                    if (isMine) toggleCheck(`gear-${item.id}`);
                }}
                className={`p-4 flex items-center gap-3 transition-colors ${
                    isOthers 
                        ? 'bg-white cursor-default' // Others: White background, normal text
                        : 'cursor-pointer active:bg-[#E0D8C0]/30 hover:bg-[#F9F7F2]' // Mine: Interactive
                    } ${
                        isMine && isChecked ? 'bg-[#E0D8C0]/20' : ''
                    }`
                }
              >
                {/* Checkbox */}
                <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center transition-all flex-shrink-0 ${
                  isChecked 
                    ? (isDeparture ? 'bg-[#219EBC] border-[#219EBC]' : 'bg-[#E76F51] border-[#E76F51]')
                    : (isOthers ? 'border-[#E0D8C0] bg-[#F5F5F5] opacity-50' : 'border-[#E0D8C0] bg-white')
                }`}>
                  {isChecked && <Check size={18} className="text-white" />}
                </div>
                
                <div className="flex-1">
                  <div className={`font-bold text-base flex items-center gap-2 ${
                      isChecked ? 'text-[#8C7B65] line-through' : 'text-[#5D4632]'
                  } ${isOthers ? 'opacity-80' : ''}`}>
                    {item.name}
                  </div>
                  
                  <div className="flex gap-1 mt-0.5">
                    {item.owner ? (
                        <span className={`text-[10px] px-2 py-0.5 rounded-full flex items-center gap-1 ${
                            isOthers 
                                ? 'bg-[#E0D8C0]/50 text-[#8C7B65]' 
                                : 'bg-[#8ECAE6]/30 text-[#219EBC] font-bold'
                        }`}>
                            {item.owner.avatar} {isMine ? '我負責' : `${item.owner.name} 負責`}
                        </span>
                    ) : (
                        <span className="text-[10px] bg-[#F4A261]/20 text-[#E76F51] px-2 py-0.5 rounded-full font-bold">
                            尚未認領
                        </span>
                    )}
                  </div>
                </div>
              </div>
            );
          }) : (
            <div className="p-8 text-center text-[#8C7B65] text-sm">
              目前沒有公用裝備。
            </div>
          )}
        </div>
      </div>

      {/* 2. 個人裝備區塊 */}
      <div className="bg-[#FFFEF5] rounded-3xl shadow-sm border border-[#E0D8C0] overflow-hidden">
        <div className="bg-[#F4A261]/20 px-5 py-4 border-b border-[#E0D8C0]">
          <h4 className="font-bold text-[#5D4632] flex items-center gap-2 text-lg">
            <Backpack size={20} className="text-[#E76F51]" />
            個人裝備 ({personalGear.length})
          </h4>
        </div>
        <div className="divide-y divide-[#E0D8C0]">
          {personalGear.length > 0 ? personalGear.map(item => {
             const isChecked = checkedItems[`gear-${item.id}`];
             return (
              <div 
                key={`gear-${item.id}`} 
                onClick={() => toggleCheck(`gear-${item.id}`)}
                className={`p-4 flex items-center gap-3 cursor-pointer transition-colors active:bg-[#E0D8C0]/30 ${
                    isChecked ? 'bg-[#E0D8C0]/20' : 'hover:bg-[#F9F7F2]'
                }`}
              >
                <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center transition-all flex-shrink-0 ${
                  isChecked 
                    ? (isDeparture ? 'bg-[#219EBC] border-[#219EBC]' : 'bg-[#E76F51] border-[#E76F51]')
                    : 'border-[#E0D8C0] bg-white'
                }`}>
                  {isChecked && <Check size={18} className="text-white" />}
                </div>
                <div className="flex-1">
                  <div className={`font-bold text-base ${isChecked ? 'text-[#8C7B65] line-through' : 'text-[#5D4632]'}`}>
                    {item.name}
                  </div>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full ${isDeparture ? 'bg-[#8ECAE6]/30 text-[#219EBC]' : 'bg-[#F4A261]/20 text-[#E76F51]'}`}>
                    每人都要帶
                  </span>
                </div>
              </div>
            );
          }) : (
            <div className="p-8 text-center text-[#8C7B65] text-sm">
              無個人裝備項目。
            </div>
          )}
        </div>
      </div>

      {/* 3. 我的食材 */}
      <div className="bg-[#FFFEF5] rounded-3xl shadow-sm border border-[#E0D8C0] overflow-hidden">
        <div className="bg-[#7BC64F]/20 px-5 py-4 border-b border-[#E0D8C0]">
          <h4 className="font-bold text-[#5D4632] flex items-center gap-2 text-lg">
            <Package size={20} className="text-[#7BC64F]" />
            我要帶的食材 ({myIngredients.length})
          </h4>
        </div>
        <div className="divide-y divide-[#E0D8C0]">
          {myIngredients.length > 0 ? myIngredients.map(item => (
            <div 
              key={`food-${item.id}`} 
              onClick={() => toggleCheck(`food-${item.id}`)}
              className={`p-4 flex items-center gap-3 cursor-pointer transition-colors active:bg-[#E0D8C0]/30 ${checkedItems[`food-${item.id}`] ? 'bg-[#E0D8C0]/20' : 'hover:bg-[#F9F7F2]'}`}
            >
              <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center transition-all flex-shrink-0 ${
                checkedItems[`food-${item.id}`] 
                  ? (isDeparture ? 'bg-[#219EBC] border-[#219EBC]' : 'bg-[#E76F51] border-[#E76F51]')
                  : 'border-[#E0D8C0] bg-white'
              }`}>
                {checkedItems[`food-${item.id}`] && <Check size={18} className="text-white" />}
              </div>
              <div className="flex-1">
                <div className={`font-bold text-base ${checkedItems[`food-${item.id}`] ? 'text-[#8C7B65] line-through' : 'text-[#5D4632]'}`}>
                  {item.name}
                </div>
                <span className="text-[10px] bg-[#7BC64F]/20 text-[#5D4632] px-2 py-0.5 rounded-full">
                  {isDeparture ? '食材庫提供' : '容器回收'}
                </span>
              </div>
            </div>
          )) : (
            <div className="p-8 text-center text-[#8C7B65] text-sm">
              您這次露營不用準備食材，等著吃就好！😋
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SelfCheckSection;