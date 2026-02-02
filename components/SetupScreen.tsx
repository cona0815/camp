import React, { useState } from 'react';
import { Database, Wifi, CheckCircle, AlertTriangle, HelpCircle, ChevronDown, ChevronUp, Copy, ExternalLink, Save, ArrowRight, Link as LinkIcon, MessageCircle, ClipboardPaste } from 'lucide-react';
import { setGasUrl, testConnection } from '../services/storage';

interface SetupScreenProps {
  onComplete: () => void;
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

const SetupScreen: React.FC<SetupScreenProps> = ({ onComplete }) => {
  const [gasUrl, setGasUrlState] = useState('');
  const [testStatus, setTestStatus] = useState<{success?: boolean, msg?: string} | null>(null);
  const [showCreateTutorial, setShowCreateTutorial] = useState(false);
  const [copyStatus, setCopyStatus] = useState('');
  const [pasteStatus, setPasteStatus] = useState(''); // New state for paste feedback

  const isValidGasUrl = gasUrl.trim() === '' || (gasUrl.includes('script.google.com') && gasUrl.endsWith('/exec'));

  const handleCopyCode = () => {
    navigator.clipboard.writeText(GAS_BACKEND_CODE);
    setCopyStatus('已複製！');
    setTimeout(() => setCopyStatus(''), 2000);
  };

  const handleTestConnection = async () => {
    if (!gasUrl.trim()) return;
    setTestStatus({ msg: '正在呼叫狸克...' });
    const result = await testConnection(gasUrl.trim());
    setTestStatus({ success: result.success, msg: result.message });
    
    if (result.success) {
      // Auto save on success
      setGasUrl(gasUrl.trim());
    }
  };

  const handleStart = () => {
      if (testStatus?.success) {
          onComplete();
      }
  };

  const handlePaste = async () => {
      try {
          const text = await navigator.clipboard.readText();
          setGasUrlState(text);
          setTestStatus(null); 
          
          // Visual Feedback
          setPasteStatus('已貼上！');
          setTimeout(() => setPasteStatus(''), 2000);
          
      } catch (err) {
          alert('瀏覽器安全性限制無法自動讀取剪貼簿。\n請點擊輸入框後，使用 Ctrl+V (或長按貼上) 手動輸入。');
      }
  };

  return (
    <div className="min-h-screen bg-[#E9F5D8] flex items-center justify-center p-4 relative overflow-hidden font-sans text-[#5D4632]">
      {/* Background Decoration */}
      <div className="absolute top-[-100px] left-[-100px] w-64 h-64 bg-[#7BC64F]/20 rounded-full blur-3xl"></div>
      <div className="absolute bottom-[-100px] right-[-100px] w-64 h-64 bg-[#F4A261]/20 rounded-full blur-3xl"></div>

      <div className="w-full max-w-lg bg-[#FFFEF5] rounded-[40px] shadow-2xl border-4 border-[#E0D8C0] overflow-hidden relative z-10 animate-fade-in flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="bg-[#7BC64F] p-6 text-center text-white relative shrink-0">
          <div className="relative z-10">
            <h1 className="text-2xl font-extrabold mb-1 tracking-tight flex items-center justify-center gap-2">
                <Database size={24} className="text-[#F2CC8F]" />
                無人島移居申請
            </h1>
            <p className="text-[#E9F5D8] font-bold text-sm opacity-90">
                請輸入島主提供的通行證連結
            </p>
          </div>
          <div className="absolute top-0 left-0 w-full h-full opacity-10" style={{backgroundImage: 'radial-gradient(#fff 2px, transparent 2px)', backgroundSize: '15px 15px'}}></div>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto">
            
            {/* Step 1: Input & Test */}
            <div className="space-y-4">
                <div className="bg-white p-4 rounded-2xl border-2 border-[#E0D8C0] shadow-sm">
                    <h3 className="font-bold text-[#5D4632] flex items-center gap-2 mb-3">
                        <LinkIcon size={20} className="text-[#F4A261]" />
                        步驟 1：貼上資料庫連結
                    </h3>
                    
                    <div className="text-xs text-[#8C7B65] mb-3 bg-[#F9F7F2] p-3 rounded-xl leading-relaxed">
                        <p className="flex items-start gap-2">
                            <MessageCircle size={14} className="mt-0.5 shrink-0"/>
                            請去 <span className="font-bold text-[#2A9D8F]">LINE 群組</span> 或記事本，複製島主分享的網址 (以 script.google.com 開頭)。
                        </p>
                    </div>

                    <div className="relative">
                        <input 
                        type="text" 
                        value={gasUrl}
                        onChange={(e) => {
                            setGasUrlState(e.target.value);
                            setTestStatus(null);
                        }}
                        placeholder="在此貼上連結..."
                        className={`w-full bg-[#F9F7F2] border-2 rounded-xl pl-4 pr-24 py-3 text-sm text-[#5D4632] focus:outline-none focus:border-[#7BC64F] transition-colors ${
                            !isValidGasUrl && gasUrl ? 'border-[#E76F51] bg-[#E76F51]/5' : 'border-[#E0D8C0]'
                        }`}
                        />
                        <button 
                            onClick={handlePaste}
                            className={`absolute right-2 top-1/2 -translate-y-1/2 text-xs border px-3 py-1.5 rounded-lg active:scale-95 transition-all font-bold flex items-center gap-1 ${
                                pasteStatus 
                                    ? 'bg-[#7BC64F] text-white border-[#7BC64F]' 
                                    : 'bg-white border-[#E0D8C0] text-[#8C7B65] hover:bg-[#F2F7E6]'
                            }`}
                        >
                            {pasteStatus ? <CheckCircle size={12}/> : <ClipboardPaste size={12}/>}
                            {pasteStatus || '貼上'}
                        </button>
                    </div>
                    
                    {!isValidGasUrl && gasUrl && (
                        <div className="text-[10px] text-[#E76F51] font-bold flex items-center gap-1 mt-1 pl-1">
                            <AlertTriangle size={10} /> 網址格式錯誤 (結尾應為 /exec)
                        </div>
                    )}
                </div>

                <div className="bg-white p-4 rounded-2xl border-2 border-[#E0D8C0] shadow-sm">
                    <h3 className="font-bold text-[#5D4632] flex items-center gap-2 mb-3">
                        <Wifi size={20} className="text-[#219EBC]" />
                        步驟 2：測試連線
                    </h3>
                    <p className="text-xs text-[#8C7B65] mb-3 pl-1">
                        確認網址正確且您可以存取。
                    </p>

                    <button 
                        onClick={handleTestConnection}
                        disabled={!gasUrl.trim() || !isValidGasUrl || !!testStatus?.msg?.includes('正在')}
                        className={`w-full py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all ${
                            testStatus?.success 
                                ? 'bg-[#7BC64F] text-white shadow-md' 
                                : testStatus?.success === false
                                    ? 'bg-[#E76F51] text-white shadow-md'
                                    : 'bg-[#F2F7E6] text-[#5D4632] border border-[#E0D8C0] hover:bg-[#E0D8C0]/50'
                        }`}
                    >
                        {testStatus?.success === true ? <CheckCircle size={18} /> : 
                        testStatus?.success === false ? <AlertTriangle size={18} /> : 
                        <Wifi size={18} />}
                        {testStatus?.msg || '點此測試連線'}
                    </button>
                </div>
            </div>

            {/* Admin Creator Toggle */}
            <div className="mt-8 text-center">
                   <button 
                      onClick={() => setShowCreateTutorial(!showCreateTutorial)}
                      className="text-xs font-bold text-[#8C7B65] opacity-60 hover:opacity-100 transition-opacity flex items-center gap-1 mx-auto border-b border-dashed border-[#8C7B65]"
                   >
                      {showCreateTutorial ? <ChevronUp size={12}/> : <ChevronDown size={12}/>}
                      我是島主，我要建立新資料庫
                   </button>
                   
                   {showCreateTutorial && (
                     <div className="mt-4 p-5 text-xs text-[#5D4632] space-y-5 bg-white border-2 border-[#E0D8C0] rounded-2xl text-left animate-fade-in">
                        <div className="font-bold text-center text-[#E76F51] mb-2">
                            ⚠️ 只有島主需要做這個步驟
                        </div>
                        {/* Step 1: Code */}
                        <div>
                           <div className="font-bold mb-2 text-[#7BC64F] text-sm">1. 複製程式碼</div>
                           <button 
                              onClick={handleCopyCode}
                              className="w-full flex items-center justify-center gap-2 bg-[#5D4632] text-[#F2CC8F] py-3 rounded-xl font-bold hover:bg-[#4a3828] active:scale-95 transition-all mb-1 shadow-sm"
                           >
                              {copyStatus ? <CheckCircle size={16} /> : <Copy size={16} />}
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

        {/* Footer Action */}
        <div className="p-6 bg-[#F9F7F2] border-t border-[#E0D8C0]">
             <button 
                onClick={handleStart}
                disabled={!testStatus?.success}
                className="w-full bg-[#F4A261] text-white py-4 rounded-2xl font-bold shadow-lg hover:bg-[#E76F51] active:scale-95 transition-all flex justify-center items-center gap-2 text-lg disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-[#E0D8C0]"
             >
                出發！前往露營島 <ArrowRight size={20} />
             </button>
             {!testStatus?.success && (
                 <p className="text-center text-[10px] text-[#8C7B65] mt-2 opacity-60">
                     請先測試連線成功才能進入
                 </p>
             )}
        </div>
      </div>
    </div>
  );
};

export default SetupScreen;