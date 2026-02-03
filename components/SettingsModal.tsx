import React, { useState, useEffect } from 'react';
import { Users, X, UserPlus, UserMinus, MapPin, Calendar, Type, Settings, Key, Database, Save, CheckCircle, HelpCircle, Copy, ExternalLink, ChevronDown, ChevronUp, AlertTriangle, Shield, Lock, Image as ImageIcon, ArrowRight, Edit2, Wifi, Minus, Plus, Loader2, Wallet } from 'lucide-react';
import { User, TripInfo } from '../types';
import { AVATAR_POOL } from '../constants';
import { getGasUrl, setGasUrl, testConnection } from '../services/storage';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  members: User[];
  setMembers: React.Dispatch<React.SetStateAction<User[]>>;
  tripInfo: TripInfo;
  setTripInfo: React.Dispatch<React.SetStateAction<TripInfo>>;
  currentUser: User;
  onResetTrip?: () => void;
  onEnableAdmin?: () => void;
  onManualSave: () => Promise<void>;
  onRefreshData: () => Promise<void>; 
}

// The backend code for the user to copy
const GAS_BACKEND_CODE = `// 狸克的露營計畫書 V2.4 後端程式碼 (全面列式儲存版)
// 功能：
// 1. 支援將裝備、食材、菜單、帳單等清單類資料拆解成多列儲存 (一項一列)，方便在試算表中查看。
// 2. 支援資料庫自動重整 (Atomic Write)，確保資料完整性。
// 3. 支援封存舊旅程並建立新工作表。

function doGet(e) {
  return handleRequest(e);
}

function doPost(e) {
  return handleRequest(e);
}

function handleRequest(e) {
  var lock = LockService.getScriptLock();
  // 嘗試獲取鎖定，最多等待 10 秒
  if (!lock.tryLock(10000)) {
    return createJson({ status: 'error', message: 'Server is busy, please try again.' });
  }

  try {
    var doc = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = doc.getSheetByName('DB');

    if (e.postData) { // POST Request (存檔)
      var payload = JSON.parse(e.postData.contents);

      // --- 封存功能 ---
      if (payload.action === 'archive') {
         if (sheet) {
           var dateStr = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyyMMdd_HHmm");
           var safeTitle = (payload.archiveName || "").replace(/[:\\/\\?*\\[\\]\\\\]/g, "_");
           var newName = safeTitle ? (safeTitle + "_" + dateStr) : ("Trip_" + dateStr);
           // 確保名稱唯一
           if (doc.getSheetByName(newName)) newName += "_" + new Date().getTime();
           sheet.setName(newName);
         }
         var newSheet = doc.insertSheet('DB');
         newSheet.appendRow(['Key', 'Value']);
         newSheet.setFrozenRows(1);
         return createJson({ status: 'success', message: 'Archived to ' + newName });
      }
      // ----------------

      if (!sheet) {
        sheet = doc.insertSheet('DB');
        sheet.appendRow(['Key', 'Value']);
        sheet.setFrozenRows(1);
      }

      // 讀取目前所有資料到 Map (記憶體中處理，減少 I/O)
      var data = sheet.getDataRange().getValues();
      var dbMap = new Map();
      // 從第二列開始讀 (跳過標題)
      for (var i = 1; i < data.length; i++) {
        if (data[i][0]) dbMap.set(data[i][0], data[i][1]);
      }

      // 定義需要拆解成多列的清單欄位 (新增 ingredients, mealPlans, bills)
      var splitKeys = ['gear_public', 'gear_personal', 'ingredients', 'mealPlans', 'bills'];

      // 更新資料
      for (var key in payload) {
        if (splitKeys.indexOf(key) !== -1) {
           // 針對清單類資料進行特殊處理：拆解成單列
           var list = payload[key];
           var prefix = key + '_item_'; // 例如: ingredients_item_
           
           // 1. 清除該類別所有舊資料 (確保刪除的項目會消失)
           var existingKeys = Array.from(dbMap.keys());
           for(var k of existingKeys) {
             if(k.indexOf(prefix) === 0) dbMap.delete(k);
           }
           
           // 2. 寫入新資料 (一格一物)
           if (Array.isArray(list)) {
             list.forEach(function(item) {
               // 確保 item 有 id，若無則產生臨時 ID
               var itemId = item.id || new Date().getTime() + Math.floor(Math.random()*10000); 
               dbMap.set(prefix + itemId, JSON.stringify(item));
             });
           }
           // 移除原本的陣列 Key (避免重複佔用空間)
           dbMap.delete(key);
        } else {
           // 一般資料直接儲存 (如 tripInfo 等維持原樣)
           dbMap.set(key, JSON.stringify(payload[key]));
        }
      }

      // 將 Map 轉回二維陣列準備寫入
      var output = [['Key', 'Value']];
      // 排序 Keys 讓試算表看起來整齊
      var sortedKeys = Array.from(dbMap.keys()).sort();
      for (var k of sortedKeys) {
        output.push([k, dbMap.get(k)]);
      }

      // 一次性寫入 (Atomic Update)，先清空再寫入最安全
      sheet.clear();
      sheet.getRange(1, 1, output.length, 2).setValues(output);

      return createJson({ status: 'success' });

    } else { // GET Request (讀取)
      if (!sheet) return createJson({ status: 'empty' });
      
      var data = sheet.getDataRange().getValues();
      var result = {};
      
      for (var i = 1; i < data.length; i++) {
        var key = data[i][0];
        var valueString = data[i][1];
        if (key) {
          try {
            result[key] = JSON.parse(valueString);
          } catch (err) {
            result[key] = valueString;
          }
        }
      }
      return createJson(result);
    }

  } catch (e) {
    return createJson({ status: 'error', message: e.toString() });
  } finally {
    lock.releaseLock();
  }
}

function createJson(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}`;

const SettingsModal: React.FC<SettingsModalProps> = ({ 
  isOpen, 
  onClose, 
  members, 
  setMembers, 
  tripInfo, 
  setTripInfo, 
  currentUser,
  onResetTrip,
  onEnableAdmin,
  onManualSave,
  onRefreshData
}) => {
  const [newMemberName, setNewMemberName] = useState('');
  const [newMemberBillable, setNewMemberBillable] = useState(true); // New state for billable checkbox
  const [activeTab, setActiveTab] = useState<'info' | 'members' | 'system'>('info');
  
  // System Config State
  const [apiKey, setApiKey] = useState('');
  const [gasUrl, setGasUrlState] = useState('');
  const [saveStatus, setSaveStatus] = useState('');
  const [testStatus, setTestStatus] = useState<{success?: boolean, msg?: string} | null>(null);
  
  // Tutorial Toggles
  const [showGeminiHelp, setShowGeminiHelp] = useState(false);
  const [showGasHelp, setShowGasHelp] = useState(false);
  const [copyStatus, setCopyStatus] = useState('');
  
  // Admin Login State
  const [adminPassword, setAdminPassword] = useState('');
  const [showAdminLogin, setShowAdminLogin] = useState(false);
  const [adminError, setAdminError] = useState('');

  // Data Save State
  const [isSavingData, setIsSavingData] = useState(false);
  const [dataSaveMsg, setDataSaveMsg] = useState('');

  // Avatar Picker State
  const [pickingAvatarForId, setPickingAvatarForId] = useState<string | null>(null);

  const isAdmin = currentUser.isAdmin;

  // Validation
  const isValidGasUrl = gasUrl.trim() === '' || (gasUrl.includes('script.google.com') && gasUrl.endsWith('/exec'));

  useEffect(() => {
    if (isOpen) {
        setApiKey(localStorage.getItem('tanuki_gemini_key') || '');
        setGasUrlState(getGasUrl());
        // Reset Admin Login UI
        setShowAdminLogin(false);
        setAdminPassword('');
        setAdminError('');
        setTestStatus(null);
        setDataSaveMsg('');
        setNewMemberBillable(true); // Reset to default true
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSaveSystemConfig = () => {
    localStorage.setItem('tanuki_gemini_key', apiKey.trim());
    const trimmedUrl = gasUrl.trim();
    if (trimmedUrl) {
       setGasUrl(trimmedUrl);
       // Trigger refresh if we saved a new URL
       onRefreshData(); 
    }
    setSaveStatus('已儲存！');
    setTimeout(() => setSaveStatus(''), 2000);
  };

  const handleTestConnection = async () => {
      setTestStatus({ msg: '測試中...' });
      const result = await testConnection(gasUrl.trim());
      setTestStatus({ success: result.success, msg: result.message });
      if (result.success) {
          // If successful, auto save and RELOAD data immediately
          setGasUrl(gasUrl.trim());
          onRefreshData();
      }
  };

  const handleCopyCode = () => {
    navigator.clipboard.writeText(GAS_BACKEND_CODE);
    setCopyStatus('已複製！');
    setTimeout(() => setCopyStatus(''), 2000);
  };

  const handleAddMember = () => {
    if (!newMemberName.trim()) return;
    const randomAvatar = AVATAR_POOL[Math.floor(Math.random() * AVATAR_POOL.length)];
    const newMember: User = {
      id: `user_${Date.now()}`,
      name: newMemberName,
      avatar: randomAvatar,
      headcount: newMemberBillable ? 1 : 0 // Use checkbox state
    };
    setMembers([...members, newMember]);
    setNewMemberName('');
    setNewMemberBillable(true); // Reset checkbox
  };

  const handleRemoveMember = (id: string) => {
    if (members.length <= 1) {
      alert("至少要有一位成員！");
      return;
    }
    if (id === currentUser.id) {
      alert("不能將自己移出名單喔！");
      return;
    }
    if (window.confirm("確定要移除這位成員嗎？")) {
      setMembers(members.filter(m => m.id !== id));
    }
  };

  const handleUpdateAvatar = (memberId: string, newAvatar: string) => {
      setMembers(prev => prev.map(m => 
          m.id === memberId ? { ...m, avatar: newAvatar } : m
      ));
      setPickingAvatarForId(null);
  };

  const handleChangeHeadcount = (memberId: string, delta: number) => {
     setMembers(prev => prev.map(m => {
         if (m.id === memberId) {
             const current = m.headcount !== undefined ? m.headcount : 1;
             const newCount = Math.max(0, current + delta); // Allow 0
             return { ...m, headcount: newCount };
         }
         return m;
     }));
  };

  const handleChangeInfo = (field: keyof TripInfo, value: string) => {
    setTripInfo(prev => ({ ...prev, [field]: value }));
  };

  const handleAdminAuth = () => {
      if (adminPassword === 'young') {
          if(onEnableAdmin) onEnableAdmin();
          setAdminPassword('');
          setShowAdminLogin(false);
      } else {
          setAdminError('密碼錯誤！(提示: young)');
          setAdminPassword('');
      }
  };

  const handleManualSaveClick = async () => {
      setIsSavingData(true);
      try {
          await onManualSave();
          setDataSaveMsg('儲存成功！');
          setTimeout(() => setDataSaveMsg(''), 2000);
      } catch (e) {
          alert("儲存失敗，請檢查網路連線");
      } finally {
          setIsSavingData(false);
      }
  };
  
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
      <div className="bg-[#FFFEF5] w-full max-w-md rounded-3xl shadow-xl overflow-hidden border-4 border-[#E0D8C0] flex flex-col max-h-[90vh] relative">
        
        {/* Avatar Picker Overlay */}
        {pickingAvatarForId && (
            <div className="absolute inset-0 z-50 bg-[#FFFEF5] flex flex-col animate-fade-in">
                <div className="bg-[#E76F51] p-4 flex justify-between items-center text-white shrink-0">
                    <h3 className="font-bold text-lg">選擇動物頭像</h3>
                    <button onClick={() => setPickingAvatarForId(null)} className="p-1 hover:bg-white/20 rounded-full transition-colors">
                        <X size={24} />
                    </button>
                </div>
                <div className="flex-1 overflow-y-auto p-4 grid grid-cols-5 gap-3">
                    {AVATAR_POOL.map((avatar, idx) => (
                        <button
                            key={idx}
                            onClick={() => handleUpdateAvatar(pickingAvatarForId, avatar)}
                            className="text-3xl p-2 rounded-xl hover:bg-[#E0D8C0]/30 border-2 border-transparent hover:border-[#E76F51] transition-all active:scale-90"
                        >
                            {avatar}
                        </button>
                    ))}
                </div>
            </div>
        )}

        <div className="bg-[#7BC64F] p-4 flex justify-between items-center text-white shrink-0">
          <h3 className="font-bold text-lg flex items-center gap-2">
            <Settings size={20} /> 露營計畫設定
          </h3>
          <button onClick={onClose} className="p-1 hover:bg-white/20 rounded-full transition-colors">
            <X size={24} />
          </button>
        </div>

        {/* --- Not Admin Warning Block --- */}
        {!isAdmin && (
            <div className="bg-[#F2CC8F]/20 p-4 border-b border-[#E0D8C0]">
                {!showAdminLogin ? (
                    <div className="flex items-center justify-between">
                        <div className="text-xs text-[#8C7B65] font-bold">
                            <Lock size={14} className="inline mr-1" />
                            目前為一般成員模式 (僅檢視)
                        </div>
                        <button 
                            onClick={() => setShowAdminLogin(true)}
                            className="text-[#E76F51] bg-white border border-[#E76F51] px-3 py-1.5 rounded-full text-xs font-bold hover:bg-[#E76F51] hover:text-white transition-all shadow-sm active:scale-95"
                        >
                            我是島主 (登入)
                        </button>
                    </div>
                ) : (
                    <div className="animate-fade-in">
                         <div className="flex justify-between items-center mb-2">
                            <label className="text-xs font-bold text-[#E76F51]">請輸入島主密碼：</label>
                            <button onClick={() => setShowAdminLogin(false)} className="text-[#8C7B65] p-1"><X size={14}/></button>
                         </div>
                         <div className="flex gap-2">
                             <input 
                                type="password" 
                                value={adminPassword}
                                onChange={(e) => { setAdminPassword(e.target.value); setAdminError(''); }}
                                placeholder="密碼..."
                                autoFocus
                                className="flex-1 bg-white border border-[#E0D8C0] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#E76F51]"
                                onKeyDown={(e) => e.key === 'Enter' && handleAdminAuth()}
                             />
                             <button 
                                onClick={handleAdminAuth}
                                className="bg-[#E76F51] text-white px-3 py-2 rounded-lg font-bold text-sm shadow-sm active:scale-95"
                             >
                                <ArrowRight size={16} />
                             </button>
                         </div>
                         {adminError && <p className="text-[#E76F51] text-[10px] mt-1 font-bold">{adminError}</p>}
                    </div>
                )}
            </div>
        )}

        {/* Tabs */}
        <div className="flex border-b border-[#E0D8C0] bg-white shrink-0">
          <button 
            onClick={() => setActiveTab('info')}
            className={`flex-1 py-3 text-sm font-bold transition-colors ${activeTab === 'info' ? 'text-[#7BC64F] border-b-2 border-[#7BC64F] bg-[#E9F5D8]/30' : 'text-[#8C7B65]'}`}
          >
            活動
          </button>
          <button 
            onClick={() => setActiveTab('members')}
            className={`flex-1 py-3 text-sm font-bold transition-colors ${activeTab === 'members' ? 'text-[#7BC64F] border-b-2 border-[#7BC64F] bg-[#E9F5D8]/30' : 'text-[#8C7B65]'}`}
          >
            成員
          </button>
          <button 
            onClick={() => setActiveTab('system')}
            className={`flex-1 py-3 text-sm font-bold transition-colors ${activeTab === 'system' ? 'text-[#7BC64F] border-b-2 border-[#7BC64F] bg-[#E9F5D8]/30' : 'text-[#8C7B65]'}`}
          >
            系統
          </button>
        </div>
        
        <div className="p-5 overflow-y-auto scrollbar-hide">
          {activeTab === 'info' && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-[#8C7B65] mb-1 flex items-center gap-1">
                  <Type size={14}/> 活動名稱
                </label>
                <input 
                  type="text" 
                  value={tripInfo.title}
                  onChange={(e) => handleChangeInfo('title', e.target.value)}
                  disabled={!isAdmin}
                  className={`w-full bg-[#F9F7F2] border-2 border-[#E0D8C0] rounded-xl px-3 py-2 text-sm text-[#5D4632] ${!isAdmin ? 'opacity-70 cursor-not-allowed bg-[#E0D8C0]/20' : 'focus:outline-none focus:border-[#7BC64F]'}`}
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-[#8C7B65] mb-1 flex items-center gap-1">
                  <Calendar size={14}/> 日期
                </label>
                <input 
                  type="text" 
                  value={tripInfo.date}
                  onChange={(e) => handleChangeInfo('date', e.target.value)}
                  disabled={!isAdmin}
                  className={`w-full bg-[#F9F7F2] border-2 border-[#E0D8C0] rounded-xl px-3 py-2 text-sm text-[#5D4632] ${!isAdmin ? 'opacity-70 cursor-not-allowed bg-[#E0D8C0]/20' : 'focus:outline-none focus:border-[#7BC64F]'}`}
                />
              </div>
              
              {/* Location */}
              <div>
                <label className="block text-xs font-bold text-[#8C7B65] mb-1 flex items-center gap-1">
                  <MapPin size={14}/> 地點
                </label>
                <input 
                  type="text" 
                  value={tripInfo.location}
                  onChange={(e) => handleChangeInfo('location', e.target.value)}
                  disabled={!isAdmin}
                  className={`w-full bg-[#F9F7F2] border-2 border-[#E0D8C0] rounded-xl px-3 py-2 text-sm text-[#5D4632] ${!isAdmin ? 'opacity-70 cursor-not-allowed bg-[#E0D8C0]/20' : 'focus:outline-none focus:border-[#7BC64F]'}`}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#8C7B65] mb-1 flex items-center gap-1">
                  <ImageIcon size={14}/> 相簿連結 (Google Photos)
                </label>
                <input 
                  type="text" 
                  value={tripInfo.albumUrl || ''}
                  onChange={(e) => handleChangeInfo('albumUrl', e.target.value)}
                  disabled={!isAdmin}
                  placeholder="https://photos.app.goo.gl/..."
                  className={`w-full bg-[#F9F7F2] border-2 border-[#E0D8C0] rounded-xl px-3 py-2 text-sm text-[#5D4632] ${!isAdmin ? 'opacity-70 cursor-not-allowed bg-[#E0D8C0]/20' : 'focus:outline-none focus:border-[#7BC64F]'}`}
                />
              </div>

              {/* Manual Save Button for Info */}
              {isAdmin && (
                  <button 
                      onClick={handleManualSaveClick}
                      disabled={isSavingData}
                      className="w-full bg-[#7BC64F] text-white py-3 rounded-xl font-bold shadow-md hover:bg-[#5da135] active:scale-95 transition-all flex justify-center items-center gap-2 mt-4"
                  >
                      {isSavingData ? <Loader2 size={18} className="animate-spin"/> : (dataSaveMsg ? <CheckCircle size={18} /> : <Save size={18} />)}
                      {isSavingData ? '儲存中...' : (dataSaveMsg || '儲存變更')}
                  </button>
              )}

              {isAdmin && onResetTrip && (
                  <div className="border-t-2 border-[#E76F51]/20 pt-6 mt-6">
                      <h4 className="text-xs font-bold text-[#E76F51] mb-2 uppercase tracking-wide flex items-center gap-1">
                          <Shield size={12} fill="currentColor"/> 島主專用：行程管理
                      </h4>
                      <div className="bg-[#E76F51]/5 p-4 rounded-xl border border-[#E76F51]/20 space-y-3">
                          <p className="text-xs text-[#8C7B65] leading-relaxed">
                              封存目前的旅程並開始新的。舊資料會被備份在 Google Sheet 的新分頁中。
                          </p>
                          <button 
                            onClick={onResetTrip}
                            className="w-full bg-white border-2 border-[#E76F51] text-[#E76F51] py-3 rounded-xl font-bold hover:bg-[#E76F51] hover:text-white transition-all flex justify-center items-center gap-2 active:scale-95 shadow-sm"
                          >
                            <Save size={16} /> 封存並開啟新旅程
                          </button>
                      </div>
                  </div>
              )}
            </div>
          )}
          
          {/* Members and System tabs remain unchanged */}
          {activeTab === 'members' && (
            <>
              {isAdmin && (
                <div className="flex flex-col gap-2 mb-4 bg-white p-3 rounded-2xl border border-[#E0D8C0]">
                  <div className="flex gap-2">
                    <input 
                        type="text" 
                        value={newMemberName}
                        onChange={(e) => setNewMemberName(e.target.value)}
                        placeholder="輸入新成員名字"
                        className="flex-1 bg-[#F9F7F2] border-2 border-[#E0D8C0] rounded-full px-4 py-2 text-sm focus:outline-none focus:border-[#7BC64F] text-[#5D4632]"
                        onKeyDown={(e) => e.key === 'Enter' && handleAddMember()}
                    />
                    <button 
                        onClick={handleAddMember}
                        className="bg-[#7BC64F] text-white p-2.5 rounded-full hover:bg-[#5da135] shadow-sm flex-shrink-0 active:scale-95"
                    >
                        <UserPlus size={20} />
                    </button>
                  </div>
                  {/* New Checkbox for Participation */}
                  <label className="flex items-center gap-2 text-xs text-[#8C7B65] cursor-pointer select-none ml-2">
                      <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${newMemberBillable ? 'bg-[#F4A261] border-[#F4A261]' : 'bg-white border-[#E0D8C0]'}`}>
                          {newMemberBillable && <CheckCircle size={12} className="text-white"/>}
                      </div>
                      <input 
                          type="checkbox" 
                          checked={newMemberBillable} 
                          onChange={(e) => setNewMemberBillable(e.target.checked)} 
                          className="hidden"
                      />
                      參與分帳 (若為管理員或小孩可取消勾選)
                  </label>
                </div>
              )}

              <div className="space-y-2">
                {members.map(member => {
                  const currentCount = member.headcount !== undefined ? member.headcount : 1;
                  return (
                  <div key={member.id} className="p-3 bg-white border border-[#E0D8C0] rounded-2xl group flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                        <button 
                            onClick={() => {
                                if(isAdmin) setPickingAvatarForId(member.id);
                            }}
                            className={`w-10 h-10 bg-[#E9F5D8] rounded-full flex items-center justify-center border-2 border-[#7BC64F] text-xl transition-transform active:scale-90 relative overflow-hidden ${isAdmin ? 'hover:scale-105 cursor-pointer' : 'cursor-default'}`}
                            title={isAdmin ? "點擊更換頭像" : ""}
                        >
                            {member.avatar}
                            {isAdmin && <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 hover:opacity-100"><Edit2 size={14} className="text-white"/></div>}
                        </button>
                        <span className="font-bold text-[#5D4632]">{member.name}</span>
                        {member.id === currentUser.id && (
                            <span className="text-[10px] bg-[#E0D8C0] text-[#5D4632] px-2 py-0.5 rounded-full">我自己</span>
                        )}
                        </div>
                        {isAdmin && member.id !== currentUser.id && (
                        <button 
                            onClick={() => handleRemoveMember(member.id)}
                            className="text-[#E0D8C0] hover:text-[#E76F51] p-2 rounded-full hover:bg-[#E76F51]/10 transition-colors"
                        >
                            <UserMinus size={18} />
                        </button>
                        )}
                    </div>
                    
                    {/* Headcount Control */}
                    {isAdmin && (
                        <div className="flex items-center gap-2 pl-14 text-xs text-[#8C7B65]">
                            <span>分帳時代表：</span>
                            <div className="flex items-center bg-[#F9F7F2] rounded-full px-1 border border-[#E0D8C0]">
                                <button 
                                    onClick={() => handleChangeHeadcount(member.id, -1)}
                                    className="p-1 hover:bg-[#E0D8C0] rounded-full"
                                >
                                    <Minus size={12}/>
                                </button>
                                <span className={`w-8 text-center font-bold ${currentCount === 0 ? 'text-[#E76F51]' : 'text-[#5D4632]'}`}>
                                    {currentCount} 人
                                </span>
                                <button 
                                    onClick={() => handleChangeHeadcount(member.id, 1)}
                                    className="p-1 hover:bg-[#E0D8C0] rounded-full"
                                >
                                    <Plus size={12}/>
                                </button>
                            </div>
                            {currentCount === 0 && <span className="text-[#E76F51] text-[10px] font-bold bg-[#E76F51]/10 px-1.5 rounded">不參與</span>}
                        </div>
                    )}
                    {!isAdmin && (
                         <div className="pl-14 text-[10px] text-[#8C7B65] opacity-70 flex items-center gap-1">
                             <Wallet size={10}/>
                             {currentCount === 0 ? '不參與分帳' : `分帳權重: ${currentCount} 人`}
                         </div>
                    )}
                  </div>
                )})}
              </div>
              
              {!isAdmin ? (
                  <div className="text-center text-xs text-[#8C7B65] py-4 bg-[#F9F7F2] rounded-xl mt-4 border border-[#E0D8C0]">
                      如需新增成員、修改頭像或調整分帳人數，請登入島主權限。
                  </div>
              ) : (
                  <>
                      <div className="text-center text-xs text-[#8C7B65] mt-4 opacity-70">
                          點擊頭像即可更換圖示 🐻
                      </div>
                      <button 
                          onClick={handleManualSaveClick}
                          disabled={isSavingData}
                          className="w-full bg-[#7BC64F] text-white py-3 rounded-xl font-bold shadow-md hover:bg-[#5da135] active:scale-95 transition-all flex justify-center items-center gap-2 mt-4"
                      >
                          {isSavingData ? <Loader2 size={18} className="animate-spin"/> : (dataSaveMsg ? <CheckCircle size={18} /> : <Save size={18} />)}
                          {isSavingData ? '儲存中...' : (dataSaveMsg || '儲存成員設定')}
                      </button>
                  </>
              )}
            </>
          )}

          {activeTab === 'system' && (
            <div className="space-y-6">
               <div className="bg-[#F2CC8F]/30 p-3 rounded-xl border border-[#F2CC8F] text-xs text-[#5D4632] leading-relaxed">
                 <strong className="block mb-1 text-[#E76F51] flex items-center gap-1">
                    <AlertTriangle size={14}/> 重要
                 </strong>
                 資料儲存在您的 Google 試算表 (免費/隱私)。設定存於此裝置，若未填寫 Key，僅 AI 功能無法使用，其他功能皆正常。
               </div>

               {/* --- API Key Section --- */}
               <div className="space-y-2">
                <label className="block text-xs font-bold text-[#8C7B65] flex items-center gap-1">
                  <Key size={14}/> Gemini API Key (AI 功能)
                </label>
                <input 
                  type="password" 
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="輸入 AI Studio Key (可留空)"
                  className="w-full bg-[#F9F7F2] border-2 border-[#E0D8C0] rounded-xl px-3 py-2 text-sm text-[#5D4632] focus:outline-none focus:border-[#7BC64F]"
                />
                
                {/* Gemini Tutorial */}
                <div className="bg-white rounded-xl border border-[#E0D8C0] overflow-hidden">
                   <button 
                      onClick={() => setShowGeminiHelp(!showGeminiHelp)}
                      className="w-full flex items-center justify-between p-3 text-xs font-bold text-[#2A9D8F] bg-[#E0D8C0]/10 hover:bg-[#E0D8C0]/30 transition-colors"
                   >
                      <span className="flex items-center gap-2"><HelpCircle size={14}/> 狸克教學：如何取得 Key?</span>
                      {showGeminiHelp ? <ChevronUp size={14}/> : <ChevronDown size={14}/>}
                   </button>
                   
                   {showGeminiHelp && (
                     <div className="p-4 text-xs text-[#5D4632] space-y-3 bg-white">
                        <ol className="list-decimal pl-4 space-y-1">
                           <li>前往 <a href="https://aistudio.google.com/app/apikey" target="_blank" className="text-[#2A9D8F] underline font-bold flex inline-flex items-center">Google AI Studio <ExternalLink size={10} className="ml-0.5"/></a></li>
                           <li>登入您的 Google 帳號。</li>
                           <li>點擊 <strong>"Create API Key"</strong> 按鈕。</li>
                           <li>複製生成的 Key 並貼到上方欄位。</li>
                        </ol>
                     </div>
                   )}
                </div>
              </div>

              {/* --- GAS URL Section --- */}
              <div className="space-y-2">
                <label className="block text-xs font-bold text-[#8C7B65] flex items-center gap-1">
                  <Database size={14}/> GAS Web App URL (雲端同步)
                </label>
                <input 
                  type="text" 
                  value={gasUrl}
                  onChange={(e) => {
                      setGasUrlState(e.target.value);
                      setTestStatus(null);
                  }}
                  placeholder="https://script.google.com/macros/s/.../exec"
                  className={`w-full bg-[#F9F7F2] border-2 rounded-xl px-3 py-2 text-sm text-[#5D4632] focus:outline-none focus:border-[#7BC64F] transition-colors ${
                      !isValidGasUrl ? 'border-[#E76F51] bg-[#E76F51]/5' : 'border-[#E0D8C0]'
                  }`}
                />
                {!isValidGasUrl && (
                    <div className="text-[10px] text-[#E76F51] font-bold flex items-center gap-1">
                        <AlertTriangle size={10} /> 網址格式似乎不正確 (應為 script.google.com ... /exec)
                    </div>
                )}

                <div className="flex gap-2">
                    <button 
                        onClick={handleTestConnection}
                        disabled={!gasUrl.trim() || !!testStatus?.msg?.includes('測試中')}
                        className={`flex-1 py-2 rounded-xl font-bold text-xs flex items-center justify-center gap-1 transition-all ${
                            testStatus?.success 
                                ? 'bg-[#7BC64F] text-white' 
                                : testStatus?.success === false
                                    ? 'bg-[#E76F51] text-white'
                                    : 'bg-white border-2 border-[#E0D8C0] text-[#5D4632]'
                        }`}
                    >
                        {testStatus?.success === true && <CheckCircle size={14} />}
                        {testStatus?.success === false && <AlertTriangle size={14} />}
                        {!testStatus && <Wifi size={14} />}
                        {testStatus?.msg || '測試連線'}
                    </button>
                </div>

                {/* GAS Tutorial */}
                <div className="bg-white rounded-xl border border-[#E0D8C0] overflow-hidden">
                   <button 
                      onClick={() => setShowGasHelp(!showGasHelp)}
                      className="w-full flex items-center justify-between p-3 text-xs font-bold text-[#2A9D8F] bg-[#E0D8C0]/10 hover:bg-[#E0D8C0]/30 transition-colors"
                   >
                      <span className="flex items-center gap-2"><HelpCircle size={14}/> 狸克教學：如何建立資料庫?</span>
                      {showGasHelp ? <ChevronUp size={14}/> : <ChevronDown size={14}/>}
                   </button>
                   
                   {showGasHelp && (
                     <div className="p-4 text-xs text-[#5D4632] space-y-4 bg-white">
                        {/* Step 1: Code */}
                        <div>
                           <div className="font-bold mb-1 text-[#E76F51]">步驟 1：複製後端程式碼 (已更新支援列式儲存)</div>
                           <button 
                              onClick={handleCopyCode}
                              className="w-full flex items-center justify-center gap-2 bg-[#5D4632] text-[#F2CC8F] py-2 rounded-lg font-bold hover:bg-[#4a3828] active:scale-95 transition-all mb-1"
                           >
                              {copyStatus ? <CheckCircle size={14} /> : <Copy size={14} />}
                              {copyStatus || '點此複製 GAS 程式碼'}
                           </button>
                        </div>

                        {/* Step 2: Create Sheet */}
                        <div>
                           <div className="font-bold mb-1 text-[#7BC64F] text-sm">2. 建立 Google Sheet</div>
                           <ol className="list-decimal pl-4 space-y-1.5 opacity-80">
                              <li>新增一個 <a href="https://sheets.new" target="_blank" className="text-[#2A9D8F] underline font-bold">Google 試算表</a>。</li>
                              <li>點擊上方選單 <strong>擴充功能</strong> &gt; <strong>Apps Script</strong>。</li>
                              <li>清空內容，<strong>貼上</strong>程式碼，按磁片存檔。</li>
                           </ol>
                        </div>

                        {/* Step 3: Deploy */}
                        <div>
                           <div className="font-bold mb-1 text-[#E76F51] text-sm">3. 部署 (關鍵！)</div>
                           <ol className="list-decimal pl-4 space-y-1.5 opacity-80">
                              <li>點擊右上角 <strong>部署</strong> &gt; <strong>新增部署</strong>。</li>
                              <li>左側齒輪選 <strong>網頁應用程式</strong>。</li>
                              <li>執行身分：<strong>我 (Me)</strong>。</li>
                              <li className="text-[#E76F51] font-bold bg-[#E76F51]/10 px-1 rounded">誰可以存取：所有人 (Anyone)</li>
                              <li>點擊部署 &gt; 授予權限 &gt; 複製網址。</li>
                           </ol>
                        </div>
                     </div>
                   )}
                </div>
              </div>

              <button 
                  onClick={handleSaveSystemConfig}
                  className="w-full bg-[#F4A261] text-white py-3 rounded-xl font-bold shadow-md hover:bg-[#E76F51] active:scale-95 transition-all flex justify-center items-center gap-2 mt-2"
              >
                  {saveStatus ? <CheckCircle size={18} /> : <Save size={18} />}
                  {saveStatus || '儲存系統設定'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;