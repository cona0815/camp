import React, { useState, useEffect, useRef } from 'react';
import { 
  CheckSquare, 
  Utensils, 
  BookOpen, 
  ClipboardList, 
  Wallet, 
  Leaf, 
  MapPin, 
  Shield, 
  Settings,
  Shirt,
  LogOut,
  RefreshCw,
  CloudOff,
  Backpack,
  Image as ImageIcon
} from 'lucide-react';
import { 
  INITIAL_GEAR, 
  INITIAL_INGREDIENTS, 
  INITIAL_BILLS, 
  INITIAL_MEMBERS, 
  TRIP_INFO as DEFAULT_TRIP_INFO
} from './constants';
import { TabType, TripInfo, User } from './types';
import { fetchFromCloud, saveToCloud, getGasUrl, AppData } from './services/storage';

// Components
import LoginScreen from './components/LoginScreen';
import GearSection from './components/GearSection';
import KitchenSection from './components/KitchenSection';
import MenuSection from './components/MenuSection';
import SelfCheckSection from './components/SelfCheckSection';
import BillSection from './components/BillSection';
import AlbumSection from './components/AlbumSection';
import SettingsModal from './components/SettingsModal';

export default function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>('gear'); 
  
  // Data State
  const [gearList, setGearList] = useState(INITIAL_GEAR);
  const [ingredients, setIngredients] = useState(INITIAL_INGREDIENTS);
  const [mealPlans, setMealPlans] = useState<any[]>([]);
  const [bills, setBills] = useState(INITIAL_BILLS); 
  const [members, setMembers] = useState(INITIAL_MEMBERS);
  const [tripInfo, setTripInfo] = useState<TripInfo>(DEFAULT_TRIP_INFO);

  // Check List State (Lifted Up)
  const [checkedDeparture, setCheckedDeparture] = useState<Record<string, boolean>>({});
  const [checkedReturn, setCheckedReturn] = useState<Record<string, boolean>>({});

  // System State
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [showWeatherGuide, setShowWeatherGuide] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncError, setSyncError] = useState(false);
  
  // Debounce Ref for auto-save
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isFirstLoad = useRef(true);

  // 1. Initial Load
  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      const gasUrl = getGasUrl();
      
      if (!gasUrl) {
        // No DB configured, use defaults
        setIsLoading(false);
        return;
      }

      try {
        const cloudData = await fetchFromCloud();
        if (cloudData) {
          setGearList(cloudData.gearList || []);
          setIngredients(cloudData.ingredients || []);
          setMealPlans(cloudData.mealPlans || []);
          setBills(cloudData.bills || []);
          setMembers(cloudData.members || []);
          setTripInfo(cloudData.tripInfo || DEFAULT_TRIP_INFO);
          setCheckedDeparture(cloudData.checkedDeparture || {});
          setCheckedReturn(cloudData.checkedReturn || {});
        }
        setSyncError(false);
      } catch (e) {
        console.error("Load Failed", e);
        setSyncError(true);
        alert("無法讀取雲端資料，將使用預設/離線資料。請檢查網路或 GAS URL 設定。");
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, []);

  // 2. Auto Save Effect
  useEffect(() => {
    if (isFirstLoad.current || isLoading) {
      isFirstLoad.current = false;
      return;
    }

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    // Debounce save (2 seconds)
    saveTimeoutRef.current = setTimeout(async () => {
      if (!getGasUrl()) return;
      
      setIsSyncing(true);
      const dataToSave: AppData = {
        gearList,
        ingredients,
        mealPlans,
        bills,
        members,
        tripInfo,
        checkedDeparture,
        checkedReturn,
        lastUpdated: Date.now()
      };

      try {
        await saveToCloud(dataToSave);
        setSyncError(false);
      } catch (e) {
        console.error("Save Failed", e);
        setSyncError(true);
      } finally {
        setIsSyncing(false);
      }
    }, 2000);

    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  }, [gearList, ingredients, mealPlans, bills, members, tripInfo, checkedDeparture, checkedReturn]);


  // Helper Logic
  const getWeatherAdvice = (tempStr: string) => {
    const temp = parseInt(tempStr);
    if (isNaN(temp)) return "請根據當地天氣預報穿著。";
    if (temp < 10) return "寒流警報！請準備發熱衣、羽絨外套、毛帽與暖暖包。洋蔥式穿法最保暖。";
    if (temp < 18) return "稍有涼意，建議穿著長袖、薄外套或背心。早晚溫差大，注意保暖。";
    if (temp < 25) return "舒適的氣溫！短袖搭配薄外套即可，活動方便為主。";
    return "天氣炎熱，請穿著透氣排汗的短袖衣物，並注意防曬與補充水分。";
  };

  const calculateProgress = () => {
    if (!currentUser) return 0;

    // Items assigned to me (Public)
    const myPublicGear = gearList.filter(g => g.category === 'public' && g.owner?.id === currentUser.id);
    // Personal Gear (Everyone has these)
    const myPersonalGear = gearList.filter(g => g.category === 'personal');
    // Ingredients assigned to me
    const myIngredients = ingredients.filter(item => item.owner.id === currentUser.id);

    const total = myPublicGear.length + myPersonalGear.length + myIngredients.length;
    if (total === 0) return 0;

    const checkedCount = [
        ...myPublicGear,
        ...myPersonalGear
    ].filter(item => checkedDeparture[`gear-${item.id}`]).length + 
    myIngredients.filter(item => checkedDeparture[`food-${item.id}`]).length;

    return Math.round((checkedCount / total) * 100);
  };

  const handleLocationClick = () => {
    // FIXED: Added '$' for string interpolation and corrected the URL structure
    window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(tripInfo.location)}`, '_blank');
  };

  const handleAlbumTabClick = () => {
    if (tripInfo.albumUrl) {
      window.open(tripInfo.albumUrl, '_blank');
    } else {
      setActiveTab('album');
    }
  };

  const handleLogout = () => {
    // 快速切換，不跳出確認視窗
    setCurrentUser(null);
    setActiveTab('gear');
  };

  // 升級為島主 (Admin)
  const handleEnableAdmin = () => {
      if (currentUser) {
          setCurrentUser({ ...currentUser, isAdmin: true });
          alert("身分驗證成功！您現在擁有島主權限。");
      }
  };

  const handleResetTrip = async () => {
    if (!window.confirm("確定要開啟新旅程嗎？\n\n這將會清除目前所有的：\n1. 菜單與食材\n2. 分帳紀錄\n\n(注意：成員名單、裝備分配、API 設定與相簿連結將會「保留」，方便您延續使用！)")) {
      return;
    }
    
    // 0. Preserve existing gear but reset 'packed' status (usually for personal gear visual check)
    // We do NOT use INITIAL_GEAR, so custom items and assignments are kept.
    const preservedGearList = gearList.map(item => ({
        ...item,
        status: item.category === 'personal' ? 'pending' : item.status // Reset personal status to pending
    }));

    // 1. Reset State
    setGearList(preservedGearList); 
    setIngredients(INITIAL_INGREDIENTS);
    setMealPlans([]);
    setBills(INITIAL_BILLS);
    // Keep members and trip info (including album link)
    setTripInfo(prev => ({...DEFAULT_TRIP_INFO, albumUrl: prev.albumUrl})); 
    setCheckedDeparture({}); // Reset check marks
    setCheckedReturn({});    // Reset check marks
    
    // 2. Force Sync
    if (getGasUrl()) {
        setIsSyncing(true);
        const dataToSave: AppData = {
            gearList: preservedGearList, // Save the preserved list
            ingredients: INITIAL_INGREDIENTS,
            mealPlans: [],
            bills: INITIAL_BILLS,
            members: members,
            tripInfo: { ...DEFAULT_TRIP_INFO, albumUrl: tripInfo.albumUrl }, // Preserve album url
            checkedDeparture: {},
            checkedReturn: {},
            lastUpdated: Date.now()
        };

        try {
            await saveToCloud(dataToSave);
            alert("已開啟新旅程！資料已重置 (裝備分配已保留)。");
        } catch (e) {
            console.error(e);
            alert("本地資料已重置，但雲端同步失敗，請檢查連線。");
        } finally {
            setIsSyncing(false);
            setIsSettingsModalOpen(false);
        }
    } else {
        alert("已重置本地資料 (裝備分配已保留)。");
        setIsSettingsModalOpen(false);
    }
  };

  const progress = calculateProgress();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#E9F5D8] flex items-center justify-center flex-col gap-4">
        <div className="w-12 h-12 border-4 border-[#7BC64F] border-t-transparent rounded-full animate-spin"></div>
        <p className="text-[#5D4632] font-bold">正在跟狸克拿資料...</p>
      </div>
    );
  }

  if (!currentUser) {
    return (
      <LoginScreen 
        members={members} 
        onLogin={(user) => setCurrentUser(user)} 
      />
    );
  }

  return (
    <div className="min-h-screen bg-[#E9F5D8] font-sans text-[#5D4632] pb-24">
      {/* Header */}
      <div className="bg-[#7BC64F] text-white p-6 pb-12 shadow-sm relative overflow-hidden rounded-b-[40px]">
        <div className="relative z-10 w-full max-w-lg md:max-w-3xl mx-auto">
          <div className="flex justify-between items-start mb-4">
            <div className="flex items-center gap-2">
               <div className="text-xs bg-[#5da135] px-3 py-1 rounded-full text-white inline-block font-bold">
                {tripInfo.date}
              </div>
              
              {/* Sync Status Indicator */}
              {isSyncing ? (
                 <span className="text-xs text-[#F2CC8F] animate-pulse flex items-center gap-1">
                   <RefreshCw size={12} className="animate-spin" /> 同步中
                 </span>
              ) : syncError ? (
                 <span className="text-xs text-[#E76F51] flex items-center gap-1 font-bold">
                   <CloudOff size={12} /> 離線
                 </span>
              ) : null}
            </div>
            
            {/* 成員頭像與編輯按鈕 */}
            <div className="flex items-center gap-3">
              <div className="flex items-center -space-x-2">
                {members.slice(0, 4).map((m, i) => {
                  const isMe = m.id === currentUser.id;
                  return (
                    <div 
                      key={i} 
                      className={`
                        relative flex items-center justify-center rounded-full shadow-sm transition-all duration-300
                        ${isMe 
                          ? 'w-14 h-14 text-3xl bg-[#FFF] border-4 border-[#F4A261] z-20 -translate-y-1' 
                          : 'w-9 h-9 text-sm bg-[#E9F5D8] border-2 border-[#7BC64F] z-0 opacity-90'
                        }
                      `} 
                      title={m.name}
                    >
                      {m.avatar}
                      {isMe && (
                         <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 bg-[#F4A261] text-white text-[10px] px-2 py-0.5 rounded-full font-bold whitespace-nowrap border border-white shadow-sm leading-none">
                            {m.name}
                         </div>
                      )}
                    </div>
                  );
                })}
                {members.length > 4 && (
                  <div className="w-9 h-9 rounded-full bg-[#E9F5D8] border-2 border-[#7BC64F] flex items-center justify-center text-xs font-bold text-[#7BC64F] shadow-sm z-0 relative">
                    +{members.length - 4}
                  </div>
                )}
              </div>
              
              <button 
                  onClick={() => setIsSettingsModalOpen(true)}
                  className="bg-[#5da135] p-2 rounded-full hover:bg-[#4a8528] text-[#F2CC8F] transition-colors shadow-sm active:scale-95"
                  title="設定"
                >
                  <Settings size={18} />
                </button>
            </div>
          </div>

          <div className="mb-2">
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight flex items-center gap-2">
                <Leaf size={28} className="text-[#F7DC6F]" fill="currentColor" />
                {tripInfo.title}
            </h1>
          </div>

          <div className="flex items-center gap-2 text-xs text-white/90 font-medium overflow-x-auto scrollbar-hide pb-1">
            <button 
              onClick={handleLocationClick}
              className="flex-shrink-0 flex items-center gap-1 hover:text-[#F2CC8F] transition-colors active:scale-95 bg-white/10 px-2.5 py-1 rounded-full backdrop-blur-sm hover:bg-white/20"
              title="點擊開啟 Google Maps"
            >
              <MapPin size={12} /> <span className="truncate max-w-[150px]">{tripInfo.location}</span>
            </button>
            
            <button 
              onClick={() => setShowWeatherGuide(true)}
              className="flex-shrink-0 flex items-center gap-1 hover:text-[#F2CC8F] transition-colors active:scale-95 bg-white/10 px-2.5 py-1 rounded-full backdrop-blur-sm hover:bg-white/20"
              title="點擊查看穿著建議"
            >
              <tripInfo.weather.icon size={12} /> {tripInfo.weather.temp}
            </button>

            {/* Readiness Badge - Moved here as requested */}
            <button 
                onClick={() => setActiveTab('check')}
                className={`flex-shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold shadow-sm transition-all active:scale-95 backdrop-blur-sm ${
                    progress === 100 
                        ? 'bg-[#2A9D8F] text-white animate-pulse' 
                        : 'bg-[#F4A261] text-white hover:bg-[#E76F51]'
                }`}
                title="個人裝備準備進度"
            >
                <Backpack size={12} fill="currentColor" />
                備 {progress}%
            </button>

            {currentUser.isAdmin && (
              <span className="flex-shrink-0 flex items-center gap-1 text-[#F2CC8F] bg-[#5da135] px-2 py-1 rounded-full text-[10px] animate-pulse">
                <Shield size={10} /> 島主
              </span>
            )}
          </div>
        </div>
        
        {/* 背景裝飾 */}
        <div className="absolute -bottom-6 -right-6 w-32 h-32 bg-[#FFFFFF]/20 rounded-full blur-xl"></div>
        <div className="absolute top-0 left-0 w-full h-full opacity-10" style={{backgroundImage: 'radial-gradient(#fff 2px, transparent 2px)', backgroundSize: '20px 20px'}}></div>
      </div>

      {/* Main Content */}
      <div className="w-full max-w-lg md:max-w-3xl mx-auto px-4 -mt-8 relative z-20">
        
        {/* Sticky Tabs */}
        <div className="bg-[#FFFEF5] rounded-3xl p-1.5 shadow-md flex mb-6 overflow-x-auto border border-[#E0D8C0] scrollbar-hide sticky top-4 z-40 backdrop-blur-md bg-opacity-95">
          <button 
            onClick={() => setActiveTab('gear')}
            className={`flex-1 min-w-[65px] py-3 text-xs font-bold rounded-2xl flex flex-col items-center justify-center gap-1 transition-all active:scale-95 ${
              activeTab === 'gear' ? 'bg-[#F4A261] text-white shadow-md' : 'text-[#8C7B65] hover:bg-[#E9F5D8]'
            }`}
          >
            <CheckSquare size={18} />
            裝備
          </button>
          <button 
            onClick={() => setActiveTab('kitchen')}
            className={`flex-1 min-w-[65px] py-3 text-xs font-bold rounded-2xl flex flex-col items-center justify-center gap-1 transition-all active:scale-95 ${
              activeTab === 'kitchen' ? 'bg-[#7BC64F] text-white shadow-md' : 'text-[#8C7B65] hover:bg-[#E9F5D8]'
            }`}
          >
            <Utensils size={18} />
            廚房
          </button>
          <button 
            onClick={() => setActiveTab('menu')}
            className={`flex-1 min-w-[65px] py-3 text-xs font-bold rounded-2xl flex flex-col items-center justify-center gap-1 transition-all active:scale-95 ${
              activeTab === 'menu' ? 'bg-[#E76F51] text-white shadow-md' : 'text-[#8C7B65] hover:bg-[#E9F5D8]'
            }`}
          >
            <BookOpen size={18} />
            菜單
          </button>
          <button 
            onClick={() => setActiveTab('check')}
            className={`flex-1 min-w-[65px] py-3 text-xs font-bold rounded-2xl flex flex-col items-center justify-center gap-1 transition-all active:scale-95 ${
              activeTab === 'check' ? 'bg-[#8ECAE6] text-[#5D4632] shadow-md' : 'text-[#8C7B65] hover:bg-[#E9F5D8]'
            }`}
          >
            <ClipboardList size={18} />
            清單
          </button>
          
          {/* Album Tab in Toolbar - Direct Link Behavior */}
          <button 
            onClick={handleAlbumTabClick}
            className={`flex-1 min-w-[65px] py-3 text-xs font-bold rounded-2xl flex flex-col items-center justify-center gap-1 transition-all active:scale-95 ${
              activeTab === 'album' ? 'bg-[#9D8189] text-white shadow-md' : 'text-[#8C7B65] hover:bg-[#E9F5D8]'
            }`}
          >
            <ImageIcon size={18} />
            相本
          </button>

          <button 
            onClick={() => setActiveTab('bill')}
            className={`flex-1 min-w-[65px] py-3 text-xs font-bold rounded-2xl flex flex-col items-center justify-center gap-1 transition-all active:scale-95 ${
              activeTab === 'bill' ? 'bg-[#F2CC8F] text-[#5D4632] shadow-md' : 'text-[#8C7B65] hover:bg-[#E9F5D8]'
            }`}
          >
            <Wallet size={18} />
            分帳
          </button>
        </div>

        {activeTab === 'gear' && (
          <GearSection 
            gearList={gearList} 
            setGearList={setGearList} 
            currentUser={currentUser} 
            members={members}
            tripInfo={tripInfo}
          />
        )}
        
        {activeTab === 'kitchen' && (
          <KitchenSection 
            ingredients={ingredients} 
            setIngredients={setIngredients} 
            mealPlans={mealPlans} 
            setMealPlans={setMealPlans}
            currentUser={currentUser}
            members={members}
          />
        )}

        {activeTab === 'menu' && (
          <MenuSection 
            mealPlans={mealPlans} 
            setMealPlans={setMealPlans} 
            members={members}
            ingredients={ingredients}
            setIngredients={setIngredients}
            currentUser={currentUser}
          />
        )}

        {activeTab === 'check' && (
          <SelfCheckSection 
            gearList={gearList} 
            ingredients={ingredients} 
            mealPlans={mealPlans}
            currentUser={currentUser} 
            checkedDeparture={checkedDeparture}
            setCheckedDeparture={setCheckedDeparture}
            checkedReturn={checkedReturn}
            setCheckedReturn={setCheckedReturn}
          />
        )}
        
        {/* Album Section acts as fallback placeholder if URL not set */}
        {activeTab === 'album' && (
           <AlbumSection 
             tripInfo={tripInfo} 
             setTripInfo={setTripInfo} 
           />
        )}

        {activeTab === 'bill' && (
          <BillSection bills={bills} setBills={setBills} members={members} currentUser={currentUser} />
        )}

      </div>
      
      {/* Settings Modal */}
      <SettingsModal 
        isOpen={isSettingsModalOpen} 
        onClose={() => setIsSettingsModalOpen(false)}
        members={members}
        setMembers={setMembers}
        tripInfo={tripInfo}
        setTripInfo={setTripInfo}
        currentUser={currentUser}
        onResetTrip={handleResetTrip}
        onEnableAdmin={handleEnableAdmin}
      />

      {/* Weather Guide Modal */}
      {showWeatherGuide && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in" onClick={() => setShowWeatherGuide(false)}>
          <div className="bg-[#FFFEF5] w-full max-w-sm rounded-3xl shadow-xl overflow-hidden border-4 border-[#E0D8C0]" onClick={e => e.stopPropagation()}>
            <div className="bg-[#8ECAE6] p-4 flex justify-between items-center text-[#5D4632]">
              <h3 className="font-bold text-lg flex items-center gap-2">
                <Shirt size={20} /> 狸克氣象台建議
              </h3>
              <button onClick={() => setShowWeatherGuide(false)} className="p-1 hover:bg-white/20 rounded-full transition-colors">
                <Settings size={0} className="hidden" />
                <div className="font-bold text-xl px-2">✕</div>
              </button>
            </div>
            <div className="p-6 text-center">
              <div className="flex justify-center mb-4 text-[#F4A261]">
                <tripInfo.weather.icon size={48} />
              </div>
              <div className="text-3xl font-bold text-[#5D4632] mb-2">{tripInfo.weather.temp}</div>
              <div className="text-[#8C7B65] font-bold mb-4">{tripInfo.weather.cond}</div>
              <div className="bg-[#E9F5D8] p-4 rounded-2xl text-[#5D4632] text-sm leading-relaxed border border-[#7BC64F]/30">
                {getWeatherAdvice(tripInfo.weather.temp)}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Footer Info - Updated for Quick Switch */}
      <div className="text-center mt-8 pb-10 text-xs text-[#8C7B65] font-bold flex flex-col items-center gap-3">
        <span className="opacity-80">目前登入: {currentUser.name} {currentUser.avatar}</span>
        <button 
           onClick={handleLogout}
           className="flex items-center gap-2 text-[#E76F51] bg-white px-6 py-2 rounded-full hover:bg-[#FFF8F0] transition-all shadow-sm active:scale-95 border-2 border-transparent hover:border-[#E76F51]/20"
        >
          <LogOut size={14} /> 切換使用者
        </button>
      </div>
    </div>
  );
}