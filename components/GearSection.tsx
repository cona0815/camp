import React, { useState } from 'react';
import { Tent, Star, Lock, Trash2, Plus, X, Shield, Check, User, Lightbulb, Grid, ChefHat, Armchair, Briefcase, Wrench, ChevronDown, ChevronUp, Gamepad2, Ban, AlertCircle } from 'lucide-react';
import { GearItem, User as UserType, TripInfo } from '../types';

interface GearSectionProps {
  gearList: GearItem[];
  setGearList: React.Dispatch<React.SetStateAction<GearItem[]>>;
  currentUser: UserType;
  members: UserType[];
  tripInfo: TripInfo;
}

const PRESET_GEAR_CATEGORIES: Record<string, string[]> = {
  "帳篷寢具": [
    "睡帳", "天幕/客廳帳", "營釘 & 營鎚", "充氣床墊", "睡袋", "枕頭", 
    "防潮地墊(內)", "地布(外)", "動力線 (延長線)", "打氣機", "營柱", "青蛙燈(營繩燈)",
    "門前踏墊", "掃把/畚箕", "枕頭套", "毛毯/被子", "調節片", "魚骨釘(棧板用)", "曬衣繩/夾"
  ],
  "廚房烹飪": [
    "卡式爐/雙口爐", "瓦斯罐", "冰桶/行動冰箱", "套鍋組", "平底鍋/烤盤", 
    "刀具 & 砧板", "餐具 (碗盤筷)", "瀝水籃", "洗碗精 & 菜瓜布", "儲水桶",
    "快煮壺", "咖啡沖泡組", "廚房剪刀", "湯勺/鍋鏟", "調味料組", "鋁箔紙/保鮮膜",
    "棉花糖", "廚房紙巾", "點火器/打火機", "隔熱手套", "開罐器", "削皮刀", "封口夾", 
    "蛋盒", "垃圾袋架", "濾水網", "食物剪刀", "擋風板"
  ],
  "桌椅家具": [
    "蛋捲桌", "露營椅", "行軍床", "置物架/掛架", "露營推車", "野餐墊",
    "垃圾架", "廚房桌/料理台", "裝備箱", "小板凳", "吊床", "戰術桌", "三層架"
  ],
  "燈光溫控": [
    "主照明燈", "燈條/裝飾燈", "頭燈/手電筒", "煤油暖爐/電暖器", "電風扇/循環扇",
    "電熱毯", "暖暖包", "汽化燈", "燈架", "焚火台", "木柴/炭火", 
    "煤油/瓦斯(備用)", "燈罩", "蠟燭/香氛"
  ],
  "3C娛樂": [
    "平板電腦", "筆記型電腦", "投影機 & 布幕", "藍牙喇叭", "Switch/遊戲機", 
    "桌遊/撲克牌", "麻將", "充電器 & 線材", "行動電源", "相機 & 腳架", 
    "空拍機", "延長線 (3C用)", "電子書閱讀器", "羽球/飛盤", 
    "藍牙麥克風", "吹泡泡機", "望遠鏡", "星空圖/星座盤"
  ],
  "個人衛浴": [
    "換洗衣物", "毛巾/浴巾", "盥洗用具", "拖鞋", "吹風機", 
    "衛生紙", "濕紙巾", "個人藥品", "防蚊液", "防曬乳", "乾洗手",
    "牙刷/牙膏", "洗髮精/沐浴乳", "化妝包/保養品", "鏡子", "髒衣袋", "生理用品", "耳塞/眼罩"
  ],
  "工具雜項": [
    "垃圾袋", "急救包", "雨具/雨衣", "備用電池", 
    "備用營繩", "多功能工具鉗", "修補包", "S掛勾/D扣", "工作手套",
    "彈力繩", "束帶", "膠帶", "剪刀/美工刀", "蚊香/蚊香架"
  ]
};

const SCROLLBAR_STYLE = "overflow-y-auto [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-[#E0D8C0] [&::-webkit-scrollbar-thumb]:rounded-full hover:[&::-webkit-scrollbar-thumb]:bg-[#F4A261]";

const GearSection: React.FC<GearSectionProps> = ({ gearList, setGearList, currentUser, members, tripInfo }) => {
  const [showAddForm, setShowAddForm] = useState(false);
  const [isPublicOpen, setIsPublicOpen] = useState(true);
  const [isPersonalOpen, setIsPersonalOpen] = useState(true);
  const [assigningItemId, setAssigningItemId] = useState<string | null>(null);
  const [customItemName, setCustomItemName] = useState('');
  const [isNewItemRequired, setIsNewItemRequired] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState("帳篷寢具");
  const [targetCategory, setTargetCategory] = useState<'public' | 'personal'>('public');
  const [selectedPresets, setSelectedPresets] = useState<string[]>([]);

  const handleClaim = (itemId: number | string, assignedUser?: {id: string, name: string} | null) => {
    setGearList(prev => prev.map(item => {
      if (String(item.id) !== String(itemId)) return item;
      if (currentUser.isAdmin) {
          if (assignedUser !== undefined) return { ...item, owner: assignedUser };
          if (item.owner) return { ...item, owner: null };
          return { ...item, owner: { id: currentUser.id, name: currentUser.name } };
      }
      if (item.owner?.id === currentUser.id) return { ...item, owner: null };
      if (!item.owner) return { ...item, owner: { id: currentUser.id, name: currentUser.name } };
      return item;
    }));
    if(assignedUser !== undefined) setAssigningItemId(null);
  };

  const handlePersonalCheck = (itemId: number | string) => {
    setGearList(prev => prev.map(item => String(item.id) === String(itemId) ? { ...item, status: item.status === 'packed' ? 'pending' : 'packed' } : item));
  };

  const togglePresetSelection = (itemName: string) => {
    setSelectedPresets(prev => prev.includes(itemName) ? prev.filter(i => i !== itemName) : [...prev, itemName]);
  };

  const handleBatchAdd = () => {
    const itemsToAdd: GearItem[] = [];
    const timestamp = Date.now();
    
    // Add presets
    selectedPresets.forEach((name, index) => {
      itemsToAdd.push({ id: timestamp + index + Math.floor(Math.random() * 1000), name: name, category: targetCategory, owner: null, required: isNewItemRequired, isCustom: false });
    });
    
    // Add manual inputs (split by comma, space, or Chinese comma)
    if (customItemName.trim()) {
      const manualItems = customItemName.split(/[,，、\s]+/).filter(s => s.trim());
      manualItems.forEach((name, index) => {
         itemsToAdd.push({ 
             id: timestamp + selectedPresets.length + 1 + index + Math.floor(Math.random() * 1000), 
             name: name.trim(), 
             category: targetCategory, 
             owner: null, 
             required: isNewItemRequired, 
             isCustom: true 
         });
      });
    }
    
    if (itemsToAdd.length === 0) return;
    
    setGearList([...gearList, ...itemsToAdd]);
    if (targetCategory === 'public') setIsPublicOpen(true);
    if (targetCategory === 'personal') setIsPersonalOpen(true);
    setCustomItemName('');
    setSelectedPresets([]);
    setIsNewItemRequired(false);
  };

  const handleDeleteItem = (itemId: number | string) => {
    const idStr = String(itemId);
    const item = gearList.find(i => String(i.id) === idStr);
    
    // Logic for "Mistake Deletion"
    // 1. If Unclaimed (owner is null) -> Delete Instantly
    // 2. If Claimed by ME -> Delete Instantly (I know what I'm doing)
    // 3. If Claimed by OTHERS (Admin Action) -> Confirm First
    if (item && item.owner && item.owner.id !== currentUser.id) {
        if (!window.confirm(`⚠️ 注意：這是【${item.owner.name}】認領的裝備。\n\n確定要強制刪除嗎？`)) {
            return;
        }
    }
    
    setGearList(prev => prev.filter(i => String(i.id) !== idStr));
  };

  const publicGear = gearList.filter(g => g.category === 'public');
  const personalGear = gearList.filter(g => g.category === 'personal');
  
  // Calculate total items from presets + manual input split
  const manualCount = customItemName.trim() ? customItemName.split(/[,，、\s]+/).filter(s => s.trim()).length : 0;
  const totalItemsToAdd = selectedPresets.length + manualCount;

  return (
    <div className="space-y-6 animate-fade-in pb-20">
      
      {/* 1. Public Gear */}
      <div className="bg-[#FFFEF5] rounded-3xl shadow-sm border border-[#E0D8C0] overflow-hidden">
        <div onClick={() => setIsPublicOpen(!isPublicOpen)} className="bg-[#F2CC8F]/30 px-5 py-4 border-b border-[#E0D8C0] flex justify-between items-center cursor-pointer hover:bg-[#F2CC8F]/40 transition-colors">
          <h3 className="font-bold text-[#5D4632] flex items-center gap-2 text-lg"><Tent size={20} className="text-[#F4A261]" />公用裝備認領<span className="text-sm font-normal text-[#8C7B65]">({publicGear.length})</span></h3>
          <div className="flex items-center gap-2"><span className="text-xs text-[#8C7B65] bg-white/60 px-2 py-1 rounded-full">多人協作</span>{isPublicOpen ? <ChevronUp size={20} className="text-[#8C7B65]" /> : <ChevronDown size={20} className="text-[#8C7B65]" />}</div>
        </div>
        
        {isPublicOpen && (
          <div className={`divide-y divide-[#E0D8C0] max-h-[500px] ${SCROLLBAR_STYLE}`}>
            {publicGear.map(item => {
              const isMine = item.owner?.id === currentUser.id;
              // 鎖定邏輯：如果有人認領了，且不是我，且我不是管理員 -> 鎖定
              const isLocked = !!item.owner && !isMine && !currentUser.isAdmin; 
              const isAssigning = String(assigningItemId) === String(item.id);
              
              // 刪除權限：無人認領(可刪)，我的(可刪)，管理員(可刪)
              const canDelete = !item.owner || isMine || currentUser.isAdmin;

              return (
                <div key={item.id} className={`p-4 flex items-center justify-between transition-colors ${isMine ? 'bg-[#7BC64F]/10' : ''}`}>
                  <div className="flex-1 pr-2">
                    <div className="font-bold text-[#5D4632] flex flex-wrap items-center gap-2">
                      {item.required && ( <span className="text-[#E76F51] flex items-center gap-0.5 text-xs font-bold bg-[#E76F51]/10 px-2 py-0.5 rounded-full whitespace-nowrap"><Star size={10} fill="currentColor" /> 必帶</span> )}
                      <span className="break-all">{item.name}</span>
                      {item.isCustom && !item.required && <span className="text-[10px] bg-[#8ECAE6]/20 text-[#219EBC] px-2 py-0.5 rounded-full whitespace-nowrap">自訂</span>}
                    </div>
                    <div className="text-xs text-[#8C7B65] mt-1.5 flex items-center gap-1">
                      {item.owner ? ( <span className={`px-2 py-0.5 rounded-full flex items-center gap-1 ${isMine ? 'bg-[#7BC64F]/20 text-[#38661d]' : 'bg-[#E0D8C0]/50 text-[#5D4632]'}`}>{isLocked && <Lock size={10} />}{item.owner.name} 已認領</span> ) : ( <span className="text-[#F4A261] font-bold bg-[#F4A261]/10 px-2 py-0.5 rounded-full">🔴 等人認領</span> )}
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {isAssigning ? (
                         <div className="absolute right-4 bg-white shadow-xl border-2 border-[#E76F51] rounded-2xl p-2 z-20 flex gap-2 items-center animate-fade-in max-w-[250px] overflow-x-auto">
                            <button onClick={() => handleClaim(item.id, null)} className="w-8 h-8 rounded-full bg-[#E0D8C0] text-white flex items-center justify-center shrink-0 hover:bg-[#E76F51]" title="無人認領"><Ban size={14} /></button>
                            {members.map(m => ( <button key={m.id} onClick={() => handleClaim(item.id, { id: m.id, name: m.name })} className="w-8 h-8 rounded-full bg-[#E9F5D8] border border-[#7BC64F] text-sm shrink-0 hover:scale-110 transition-transform" title={`指派給 ${m.name}`}>{m.avatar}</button> ))}
                            <button onClick={() => setAssigningItemId(null)} className="ml-1 text-[#8C7B65]"><X size={16}/></button>
                         </div>
                    ) : (
                        <button onClick={() => { if (currentUser.isAdmin) { setAssigningItemId(String(item.id)); } else { handleClaim(item.id); } }} disabled={isLocked} className={`px-4 py-2.5 rounded-full text-sm font-bold transition-all shadow-sm active:scale-95 ${isMine ? 'bg-white border-2 border-[#7BC64F] text-[#7BC64F] hover:bg-[#7BC64F]/10' : item.owner && currentUser.isAdmin ? 'bg-[#E76F51] text-white hover:bg-[#D65F41] ring-2 ring-offset-1 ring-[#E76F51]/30' : isLocked ? 'bg-[#E0D8C0] text-white cursor-not-allowed' : 'bg-[#F4A261] text-white hover:bg-[#E76F51]'}`}>{isMine ? '取消' : (item.owner && currentUser.isAdmin) ? '更改分配' : isLocked ? '鎖定' : '我帶'}</button>
                    )}
                    
                    {/* Delete button logic refined for "Mistake Add" */}
                    {canDelete ? (
                        <button 
                            type="button"
                            onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteItem(item.id);
                            }}
                            className={`p-2.5 rounded-full shadow-sm active:scale-95 transition-all cursor-pointer ${
                                !item.owner 
                                    ? 'bg-[#E0D8C0] text-white hover:bg-[#E76F51]' // Unclaimed: Less warning color initially
                                    : 'bg-[#E76F51] text-white hover:bg-[#D65F41]' // Claimed: Red warning
                            }`}
                            title={!item.owner ? "刪除 (無人認領)" : "刪除"}
                        >
                            <Trash2 size={16} fill="white" className="pointer-events-none"/>
                        </button>
                    ) : (
                        <button disabled className="p-2.5 text-[#E0D8C0] cursor-not-allowed opacity-50" title="無法刪除他人認領的裝備">
                            <Trash2 size={16} />
                        </button>
                    )}
                  </div>
                </div>
              );
            })}
            {publicGear.length === 0 && ( <div className="p-8 text-center text-[#8C7B65] text-sm italic">目前沒有公用裝備需求</div> )}
          </div>
        )}
      </div>

      {/* 2. Personal Gear */}
      <div className="bg-[#FFFEF5] rounded-3xl shadow-sm border border-[#E0D8C0] overflow-hidden">
        <div onClick={() => setIsPersonalOpen(!isPersonalOpen)} className="bg-[#8ECAE6]/30 px-5 py-4 border-b border-[#E0D8C0] flex justify-between items-center cursor-pointer hover:bg-[#8ECAE6]/40 transition-colors">
          <h3 className="font-bold text-[#5D4632] flex items-center gap-2 text-lg"><User size={20} className="text-[#219EBC]" />個人裝備 (僅自己可見)<span className="text-sm font-normal text-[#8C7B65]">({personalGear.length})</span></h3>
          <div className="text-[#8C7B65]">{isPersonalOpen ? <ChevronUp size={20} /> : <ChevronDown size={20} />}</div>
        </div>
        
        {isPersonalOpen && (
          <div className={`p-4 space-y-3 max-h-[500px] ${SCROLLBAR_STYLE}`}>
            <div className="text-xs text-[#8C7B65] bg-[#F9F7F2] p-2 rounded-xl mb-2 flex items-center gap-2">
                <AlertCircle size={14}/> 這裡的裝備是「每個人都要帶」的清單，只有您自己看得到勾選狀態。
            </div>
            {personalGear.map(item => (
              <div key={item.id} className="flex items-center gap-3 cursor-pointer p-3 hover:bg-[#E9F5D8] rounded-2xl group transition-all" onClick={() => handlePersonalCheck(item.id)}>
                <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center transition-all flex-shrink-0 ${item.status === 'packed' ? 'bg-[#219EBC] border-[#219EBC] text-white' : 'border-[#E0D8C0] bg-white'}`}>{item.status === 'packed' && <Check size={18} />}</div>
                <span className={`flex-1 font-medium text-base ${item.status === 'packed' ? 'text-[#8C7B65] line-through' : 'text-[#5D4632]'}`}>{item.name}</span>
                {/* Delete button strictly using handleDeleteItem */}
                <button 
                    type="button"
                    onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteItem(item.id);
                    }}
                    className="p-2 bg-[#E76F51] text-white rounded-full shadow-sm hover:bg-[#D65F41] active:scale-95 transition-all cursor-pointer opacity-20 group-hover:opacity-100"
                    title="刪除"
                >
                    <Trash2 size={14} fill="white" className="pointer-events-none"/>
                </button>
              </div>
            ))}
            {personalGear.length === 0 && ( <div className="text-center text-[#8C7B65] text-sm italic p-2">目前清單是空的，請從下方新增</div> )}
          </div>
        )}
      </div>

      {/* 3. Add Form */}
      <div className="bg-[#FFFEF5] rounded-3xl shadow-sm border border-[#E0D8C0] overflow-hidden">
        <div className="p-4">
            {showAddForm ? (
              <div className="flex flex-col gap-3 animate-fade-in bg-[#E9F5D8] p-4 rounded-3xl border border-[#7BC64F]/30 shadow-inner">
                <div className="flex justify-between items-center mb-1">
                  <h4 className="text-sm font-bold text-[#5D4632] flex items-center gap-2"><Grid size={16} className="text-[#7BC64F]" /> 從裝備庫挑選</h4>
                  <button onClick={() => setShowAddForm(false)} className="text-[#8C7B65] hover:bg-white/50 rounded-full p-1"><X size={20} /></button>
                </div>
                <div className="flex gap-2 bg-white/50 p-1.5 rounded-2xl border border-[#E0D8C0]/50">
                   <button onClick={() => setTargetCategory('public')} className={`flex-1 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1 transition-all ${targetCategory === 'public' ? 'bg-[#F4A261] text-white shadow-sm' : 'bg-white text-[#8C7B65] border border-[#E0D8C0] hover:bg-[#F9F7F2]'}`}><Tent size={14} /> 公用 (需認領)</button>
                   <button onClick={() => setTargetCategory('personal')} className={`flex-1 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1 transition-all ${targetCategory === 'personal' ? 'bg-[#219EBC] text-white shadow-sm' : 'bg-white text-[#8C7B65] border border-[#E0D8C0] hover:bg-[#F9F7F2]'}`}><User size={14} /> 個人 (各自帶)</button>
                </div>
                <div className="relative">
                  <select value={selectedCategory} onChange={(e) => setSelectedCategory(e.target.value)} className="w-full appearance-none bg-white border-2 border-[#E0D8C0] text-[#5D4632] font-bold text-sm rounded-xl py-2.5 pl-4 pr-10 focus:outline-none focus:border-[#7BC64F] transition-colors">{Object.keys(PRESET_GEAR_CATEGORIES).map(cat => ( <option key={cat} value={cat}>{cat}</option> ))}</select>
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-[#8C7B65]"><ChevronDown size={18} /></div>
                </div>
                <div className={`flex flex-wrap gap-2 mb-2 bg-white/50 p-3 rounded-2xl border border-[#E0D8C0]/50 max-h-[200px] ${SCROLLBAR_STYLE}`}>
                  {PRESET_GEAR_CATEGORIES[selectedCategory].map(item => {
                    const isSelected = selectedPresets.includes(item);
                    return ( <button key={item} onClick={() => togglePresetSelection(item)} className={`px-3 py-1.5 text-xs rounded-lg border transition-all active:scale-95 text-left flex items-center gap-1 ${isSelected ? 'bg-[#7BC64F] border-[#7BC64F] text-white font-bold shadow-md' : 'bg-white border-[#E0D8C0] text-[#5D4632] hover:border-[#F4A261] hover:text-[#F4A261]'}`}>{isSelected && <Check size={12} />}{item}</button> );
                  })}
                </div>
                <div className="flex gap-2">
                  <input type="text" value={customItemName} onChange={(e) => setCustomItemName(e.target.value)} placeholder="或手動輸入 (逗號分隔可一次新增多項)" className="flex-1 bg-white border-2 border-[#E0D8C0] rounded-full px-4 py-2 text-sm focus:outline-none focus:border-[#7BC64F] text-[#5D4632]" onKeyDown={(e) => e.key === 'Enter' && handleBatchAdd()}/>
                </div>
                <div className="flex items-center justify-between pt-2">
                  {currentUser.isAdmin && ( <label className="flex items-center gap-2 text-xs text-[#5D4632] cursor-pointer select-none bg-white/50 px-2 py-1 rounded-full"><input type="checkbox" checked={isNewItemRequired} onChange={(e) => setIsNewItemRequired(e.target.checked)} className="rounded text-[#F4A261] focus:ring-[#F4A261]"/><span className="flex items-center gap-1 font-bold"><Shield size={12} className="text-[#F4A261]"/>設為必帶</span></label> )}
                  <button onClick={handleBatchAdd} disabled={totalItemsToAdd === 0} className="bg-[#7BC64F] text-white px-6 py-2 rounded-full text-sm font-bold hover:bg-[#5da135] ml-auto shadow-sm active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"><Plus size={16} />{totalItemsToAdd > 0 ? `新增 ${totalItemsToAdd} 項` : '新增'}</button>
                </div>
              </div>
            ) : (
              <button onClick={() => setShowAddForm(true)} className="w-full py-3 border-2 border-dashed border-[#E0D8C0] rounded-2xl text-[#8C7B65] text-sm font-bold hover:border-[#F4A261] hover:text-[#F4A261] hover:bg-[#F4A261]/5 transition-all flex items-center justify-center gap-2"><Plus size={18} />開啟裝備庫挑選</button>
            )}
        </div>
      </div>
    </div>
  );
};

export default GearSection;