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
  LogOut,
  RefreshCw,
  Backpack,
  Image as ImageIcon,
  AlertTriangle
} from 'lucide-react';
import { 
  INITIAL_GEAR, 
  INITIAL_INGREDIENTS, 
  INITIAL_BILLS, 
  INITIAL_MEMBERS, 
  TRIP_INFO as DEFAULT_TRIP_INFO
} from './constants';
import { TabType, TripInfo, User } from './types';
import { fetchFromCloud, saveToCloud, getGasUrl, AppData, archiveTrip } from './services/storage';

// Components
import LoginScreen from './components/LoginScreen';
import SetupScreen from './components/SetupScreen'; // Import SetupScreen
import GearSection from './components/GearSection';
import KitchenSection from './components/KitchenSection';
import MenuSection from './components/MenuSection';
import SelfCheckSection from './components/SelfCheckSection';
import BillSection from './components/BillSection';
import AlbumSection from './components/AlbumSection';
import SettingsModal from './components/SettingsModal';

export default function App() {
  // Check if setup is required (no GAS URL)
  const [isSetupRequired, setIsSetupRequired] = useState(!getGasUrl());
  
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
  const [isLoading, setIsLoading] = useState(false); // Changed default to false, will be set true in loadData
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncError, setSyncError] = useState(false);
  
  // Debounce Ref for auto-save
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isFirstLoad = useRef(true);

  // Function to load data from cloud
  const loadData = async () => {
      setIsLoading(true);
      const gasUrl = getGasUrl();
      
      if (!gasUrl) {
        // No DB configured, use defaults. 
        // NOTE: INITIAL_MEMBERS already includes Admin, so new users are fine.
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
          
          // --- MIGRATION LOGIC: Ensure Admin Exists & Permissions ---
          let loadedMembers = cloudData.members || [];
          
          // 1. Force Admin Permissions for 'admin_tanuki'
          // This fixes the issue where old cloud data without 'isAdmin: true' strips admin rights
          loadedMembers = loadedMembers.map(m => 
             m.id === 'admin_tanuki' ? { ...m, isAdmin: true } : m
          );

          // 2. Inject Admin if missing entirely (legacy migration)
          const hasAdmin = loadedMembers.some(m => m.id === 'admin_tanuki');
          if (!hasAdmin) {
              const defaultAdmin = INITIAL_MEMBERS.find(m => m.isAdmin);
              if (defaultAdmin) {
                  loadedMembers = [defaultAdmin, ...loadedMembers];
              }
          }
          
          setMembers(loadedMembers);
          // ---------------------------------------------
          
          // Merge trip info carefully to default if missing (and strip potential garbage)
          const mergedTripInfo = { ...DEFAULT_TRIP_INFO, ...cloudData.tripInfo };
          // Ensure we don't have legacy icon data causing issues (though types say it shouldn't exist)
          if ('icon' in mergedTripInfo.weather) {
             delete (mergedTripInfo.weather as any).icon;
          }
          setTripInfo(mergedTripInfo);

          setCheckedDeparture(cloudData.checkedDeparture || {});
          setCheckedReturn(cloudData.checkedReturn || {});
        } else {
          // *** CRITICAL FIX FOR NEW DB ***
          // If cloudData is null (empty DB), we MUST reset to defaults to clear old data
          console.log("Empty DB detected. Resetting to defaults.");
          setGearList(INITIAL_GEAR);
          setIngredients(INITIAL_INGREDIENTS);
          setMealPlans([]);
          setBills(INITIAL_BILLS);
          setMembers(INITIAL_MEMBERS);
          setTripInfo(DEFAULT_TRIP_INFO);
          setCheckedDeparture({});
          setCheckedReturn({});
        }
        setSyncError(false);
      } catch (e) {
        console.error("Load Failed", e);
        setSyncError(true);
        // Error is alerted in fetchFromCloud usually, or handled here silently to show Offline badge
      } finally {
        setIsLoading(false);
      }
  };

  // 1. Initial Load Logic
  useEffect(() => {
    // Only load data if we are NOT in setup mode
    if (!isSetupRequired) {
        loadData();
    }
  }, [isSetupRequired]);

  // Effect: When settings modal closes, retry connection if we were offline or just to be safe
  useEffect(() => {
      if (!isSettingsModalOpen && getGasUrl()) {
          loadData();
      }
  }, [isSettingsModalOpen]);

  // Manual Save Function
  const handleManualSave = async () => {
    if (!getGasUrl()) return;

    // Clear any pending auto-save to avoid double saves
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

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
      console.error("Manual Save Failed", e);
      setSyncError(true);
      throw e; // Re-throw to let the caller (modal) know it failed
    } finally {
      setIsSyncing(false);
    }
  };

  // 2. Auto Save Effect
  useEffect(() => {
    if (isSetupRequired) return; // Don't save if setting up
    if (isFirstLoad.current || isLoading) {
      isFirstLoad.current = false;
      return;
    }

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    // Debounce save reduced to 1000ms for faster sync perception
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
    }, 1000);

    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  }, [gearList, ingredients, mealPlans, bills, members, tripInfo, checkedDeparture, checkedReturn, isSetupRequired]);


  const calculateProgress = () => {
    if (!currentUser) return 0;

    // Items assigned to me (Public)
    const myPublicGear = gearList.filter(g => g.category === 'public' && g.owner?.id === currentUser.id);
    // Personal Gear (Everyone has these)
    const myPersonalGear = gearList.filter(g => g.category === 'personal');
    // Ingredients assigned to me
    // FIXED: Added optional chaining 'item.owner?.id' to prevent crash on 'Need to Buy' items (owner: null)
    const myIngredients = ingredients.filter(item => item.owner && item.owner.id === currentUser.id);

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

  // 1. 完全封存並重置 (New Trip)
  const handleResetTrip = async () => {
    if (!window.confirm("確定要將目前的旅程封存並開啟新旅程嗎？\n\n系統將會：\n1. 將目前的 Google Sheet 分頁改名封存\n2. 建立全新的 DB 分頁\n3. 徹底清空所有資料 (包含裝備、食材、帳單)")) {
      return;
    }
    
    setIsSyncing(true);

    try {
        if (getGasUrl()) {
             // 1. Archive Cloud Data
             const safeTitle = tripInfo.title.replace(/[\\\/:*?"<>|]/g, "_");
             const archiveName = `Backup_${tripInfo.date.replace(/\//g, '-')}_${safeTitle}`;
             await archiveTrip(archiveName);
        }

        // 2. Reset Local State - COMPLETELY WIPE
        setGearList(INITIAL_GEAR); 
        setIngredients(INITIAL_INGREDIENTS);
        setMealPlans([]);
        setBills(INITIAL_BILLS);
        setTripInfo(prev => ({...DEFAULT_TRIP_INFO, albumUrl: prev.albumUrl})); 
        setCheckedDeparture({});
        setCheckedReturn({});
        
        // 3. Save new empty state to the NEW 'DB' sheet
        if (getGasUrl()) {
            const dataToSave: AppData = {
                gearList: INITIAL_GEAR, // Send empty list
                ingredients: INITIAL_INGREDIENTS,
                mealPlans: [],
                bills: INITIAL_BILLS,
                members: members,
                tripInfo: { ...DEFAULT_TRIP_INFO, albumUrl: tripInfo.albumUrl },
                checkedDeparture: {},
                checkedReturn: {},
                lastUpdated: Date.now()
            };
            await saveToCloud(dataToSave);
            alert(`舊旅程已成功封存！\n新旅程已建立，資料已完全重置。`);
        } else {
             alert("已重置本地資料 (未設定雲端，僅本地重置)。");
        }
    } catch (e) {
        console.error(e);
        alert("封存或建立新旅程時發生錯誤，請檢查網路。");
    } finally {
        setIsSyncing(false);
        setIsSettingsModalOpen(false);
    }
  };

  // 2. 清空目前資料 (Delete Simulated Data) - NO ARCHIVE
  const handleClearCurrentTrip = async () => {
    if (!window.confirm("⚠️ 危險操作！\n\n確定要「清空」目前的所有資料嗎？\n(包含裝備、食材、菜單、帳單)\n\n此操作「不會」封存備份，資料將直接消失！\n\n(通常用於刪除模擬測試資料)")) {
      return;
    }

    setIsSyncing(true);
    try {
        // Reset Local State
        setGearList(INITIAL_GEAR); 
        setIngredients(INITIAL_INGREDIENTS);
        setMealPlans([]);
        setBills(INITIAL_BILLS);
        setTripInfo(prev => ({...DEFAULT_TRIP_INFO, albumUrl: prev.albumUrl})); 
        setCheckedDeparture({});
        setCheckedReturn({});

        // Force Save Empty State to Current DB
        if (getGasUrl()) {
            const dataToSave: AppData = {
                gearList: INITIAL_GEAR, 
                ingredients: INITIAL_INGREDIENTS,
                mealPlans: [],
                bills: INITIAL_BILLS,
                members: members,
                tripInfo: { ...DEFAULT_TRIP_INFO, albumUrl: tripInfo.albumUrl },
                checkedDeparture: {},
                checkedReturn: {},
                lastUpdated: Date.now()
            };
            await saveToCloud(dataToSave);
            alert("已清空所有資料！(模擬資料已移除)");
        } else {
            alert("已清空本地資料。");
        }
    } catch (e) {
        console.error(e);
        alert("清空資料失敗，請檢查網路。");
    } finally {
        setIsSyncing(false);
        setIsSettingsModalOpen(false);
    }
  };

  const handleSetupComplete = () => {
      setIsSetupRequired(false);
      // Trigger load data immediately
      // loadData will be called by useEffect since isSetupRequired changes to false
  };

  // --- Render Conditions ---

  // 1. Force Setup Screen if no URL
  if (isSetupRequired) {
      return <SetupScreen onComplete={handleSetupComplete} />;
  }

  // 2. Loading State (Fetching initial data)
  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#E9F5D8] flex items-center justify-center flex-col gap-4">
        <div className="w-12 h-12 border-4 border-[#7BC64F] border-t-transparent rounded-full animate-spin"></div>
        <p className="text-[#5D4632] font-bold">正在跟狸克拿資料...</p>
      </div>
    );
  }

  // 3. Login Screen
  if (!currentUser) {
    return (
      <LoginScreen 
        members={members} 
        onLogin={(user) => setCurrentUser(user)} 
      />
    );
  }

  // 4. Main App
  const progress = calculateProgress();

  return (
    <div className="min-h-screen bg-[#E9F5D8] font-sans text-[#5D4632] pb-24">
      {/* Sync Error Banner - CRITICAL FOR DEBUGGING */}
      {syncError && (
          <div className="bg-[#E76F51] text-white p-3 text-center text-xs font-bold flex items-center justify-center gap-2 animate-pulse sticky top-0 z-50">
              <AlertTriangle size={16} />
              <span>存檔失敗！請檢查 Google Sheet 部署 (需建立新版本) 或網路連線。</span>
          </div>
      )}

      {/* Header */}
      <div className="bg-[#7BC64F] text-white p-6 pb-12 shadow-sm relative overflow-hidden rounded-b-[40px]">
        {/* ... (Header Content Same as Before) ... */}
        <div className="relative z-10 w-full max-w-lg md:max-w-3xl mx-auto">
          <div className="flex justify-between items-start mb-4">
            <div className="flex items-center gap-2">
               <div className="text-xs bg-[#5da135] px-3 py-1 rounded-full text-white inline-block font-bold">
                {tripInfo.date}
              </div>
              
              {/* Sync Status Indicator */}
              {isSyncing && (
                 <span className="text-xs text-[#F2CC8F] animate-pulse flex items-center gap-1">
                   <RefreshCw size={12} className="animate-spin" /> 同步中
                 </span>
              )}
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
        onManualSave={handleManualSave}
        onRefreshData={loadData}
        // Force casting to pass the new prop if TS complains (since we updated SettingsModal interface but context might lag)
        // Actually, SettingsModal interface WAS updated in this response, so this is valid.
        // We cast handleClearCurrentTrip to any just in case, but strict typing should work if everything is synced.
        {...{ onClearCurrentTrip: handleClearCurrentTrip } as any}
      />

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