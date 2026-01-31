import React, { useState, useRef } from 'react';
import { 
  Package, Lock, Check, Trash2, Plus, Users, Minus, Coffee, Sun, Moon, Clock, Sparkles, ChefHat, Camera, Loader2, Image as ImageIcon, X, Edit2, Soup
} from 'lucide-react';
import { Ingredient, MealPlan, CheckItem, User } from '../types';
import { generateCampMeal, identifyIngredientsFromImage, generateLeftoverRecipe } from '../services/geminiService';

interface KitchenSectionProps {
  ingredients: Ingredient[];
  setIngredients: React.Dispatch<React.SetStateAction<Ingredient[]>>;
  mealPlans: MealPlan[];
  setMealPlans: React.Dispatch<React.SetStateAction<MealPlan[]>>;
  currentUser: User;
  members: User[];
}

const KitchenSection: React.FC<KitchenSectionProps> = ({ ingredients, setIngredients, mealPlans, setMealPlans, currentUser, members }) => {
  const [newIngName, setNewIngName] = useState('');
  const [mealType, setMealType] = useState<'breakfast' | 'lunch' | 'dinner'>('dinner'); 
  const [day, setDay] = useState(1); 
  const [adults, setAdults] = useState(4);
  const [children, setChildren] = useState(2);
  const [status, setStatus] = useState<'idle' | 'loading' | 'analyzing' | 'rescuing'>('idle'); 
  
  // Admin Editing State
  const [reassigningId, setReassigningId] = useState<number | null>(null);

  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  const handleAddIngredient = () => {
    if (!newIngName.trim()) return;
    const newItem: Ingredient = {
      id: Date.now(),
      name: newIngName,
      selected: true, 
      usedInPlanId: null, 
      owner: { id: currentUser.id, name: currentUser.name, avatar: currentUser.avatar } 
    };
    setIngredients([...ingredients, newItem]);
    setNewIngName('');
  };

  const toggleIngredient = (id: number) => {
    setIngredients(prev => prev.map(ing => {
      if (ing.id === id && ing.usedInPlanId === null) {
        return { ...ing, selected: !ing.selected };
      }
      return ing;
    }));
  };

  const handleReassign = (id: number, member: User) => {
    setIngredients(prev => prev.map(ing => {
        if (ing.id === id) {
            return { ...ing, owner: { id: member.id, name: member.name, avatar: member.avatar } };
        }
        return ing;
    }));
    setReassigningId(null);
  };

  const handleDeleteIngredient = (id: number) => {
     const target = ingredients.find(i => i.id === id);
     
     if (target?.usedInPlanId) {
       alert("此食材已被使用在某餐點中，無法刪除！請先解散該餐點。");
       return;
     }

     if (target && (target.owner.id === currentUser.id || currentUser.isAdmin)) {
       if(window.confirm(`確定要刪除 ${target.name} 嗎？`)) {
         setIngredients(ingredients.filter(i => i.id !== id));
       }
     } else {
       alert("您不能刪除別人提供的食材喔！");
     }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setStatus('analyzing');
    
    try {
      // Convert to Base64
      const base64String = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result as string;
          // Remove "data:image/jpeg;base64," prefix
          const base64Data = result.split(',')[1];
          resolve(base64Data);
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      const identifiedItems = await identifyIngredientsFromImage(base64String);
      
      if (identifiedItems.length > 0) {
        const newIngredients: Ingredient[] = identifiedItems.map((name, index) => ({
          id: Date.now() + index,
          name: name,
          selected: true,
          usedInPlanId: null,
          owner: { id: currentUser.id, name: currentUser.name, avatar: currentUser.avatar }
        }));
        
        setIngredients(prev => [...prev, ...newIngredients]);
      } else {
        alert("狸克看不太出來這張照片裡有什麼食材耶...😅");
      }

    } catch (error) {
      console.error(error);
      alert("圖片辨識失敗，請檢查 API Key 或網路連線。");
    } finally {
      setStatus('idle');
      // Clear inputs
      if (cameraInputRef.current) cameraInputRef.current.value = '';
      if (galleryInputRef.current) galleryInputRef.current.value = '';
    }
  };

  const handleGenerate = async () => {
    const selectedItems = ingredients.filter(i => i.selected);
    if (selectedItems.length === 0) {
      alert("請至少勾選一項食材！");
      return;
    }

    const newPlanId = Date.now(); 
    setStatus('loading');
    
    try {
        const dayLabel = `第 ${day} 天`;
        const title = `${dayLabel} ${getMealLabel(mealType)}`;
        const selectedNames = selectedItems.map(i => i.name);
        
        // Call Real AI Service
        const aiResponse = await generateCampMeal(
            selectedNames,
            mealType,
            adults,
            children,
            title
        );

        // 1. Convert selected ingredients (Inventory) to Checklist Items
        const inventoryCheckItems: CheckItem[] = selectedItems.map(ing => ({
            id: `inv-${ing.id}`,
            name: ing.name,
            checked: false,
            owner: { name: ing.owner.name, avatar: ing.owner.avatar },
            sourceIngredientId: ing.id
        }));

        // 2. Parse AI Shopping List for "Buy" items
        const buyCheckItems: CheckItem[] = aiResponse.shoppingList
            .filter(item => item.buy !== '0') // Filter items that need to be bought
            .map((item, idx) => ({
                id: `buy-${Date.now()}-${idx}`,
                name: `${item.name} (需買: ${item.buy})`,
                checked: false,
                owner: null, // No owner yet, needs to be bought
                sourceIngredientId: null
            }));

        const newPlan: MealPlan = {
            id: newPlanId,
            dayLabel,
            mealType,
            title,
            menuName: aiResponse.menuName,
            reason: aiResponse.reason,
            checklist: [...inventoryCheckItems, ...buyCheckItems],
            notes: "",
            recipe: aiResponse.recipe
        };

        setMealPlans([newPlan, ...mealPlans]);

        // Lock ingredients
        setIngredients(prev => prev.map(ing => 
            ing.selected ? { ...ing, usedInPlanId: newPlanId, selected: false } : ing
        ));

    } catch (error) {
        console.error(error);
        alert("狸克大廚去喝咖啡了，請稍後再試！(請確認是否設定 API_KEY)");
    } finally {
        setStatus('idle');
    }
  };

  // New Function: Leftover Rescue
  const handleLeftoverRescue = async () => {
    const availableIngredients = ingredients.filter(i => i.usedInPlanId === null);
    if (availableIngredients.length === 0) {
        alert("目前冰箱是空的或所有食材都已分配，沒有剩食可以拯救喔！");
        return;
    }

    setStatus('rescuing');
    const newPlanId = Date.now();
    
    try {
        const ingredientNames = availableIngredients.map(i => i.name);
        const aiResponse = await generateLeftoverRecipe(ingredientNames);

        // Map AI selected items back to our inventory
        // (Simplified: link ALL available ingredients that match AI's text roughly)
        const usedInventoryItems: CheckItem[] = [];
        
        // Simple string matching
        availableIngredients.forEach(ing => {
             // If AI mentioned it in shopping list (as 'have') or if we just want to dump everything in
             // For "Rescue", we generally try to use everything available that fits.
             // Here we assume the AI used what we gave it.
             usedInventoryItems.push({
                 id: `inv-${ing.id}`,
                 name: ing.name,
                 checked: false,
                 owner: { name: ing.owner.name, avatar: ing.owner.avatar },
                 sourceIngredientId: ing.id
             });
        });

        const newPlan: MealPlan = {
            id: newPlanId,
            dayLabel: '撤收前',
            mealType: 'lunch', // Default to a final meal
            title: '清冰箱大作戰',
            menuName: aiResponse.menuName,
            reason: aiResponse.reason,
            checklist: usedInventoryItems, // We use what we have
            notes: "請將所有剩餘食材確認後投入！",
            recipe: aiResponse.recipe
        };

        setMealPlans([newPlan, ...mealPlans]);

        // Lock ALL available ingredients (Since it's a rescue mission)
        setIngredients(prev => prev.map(ing => 
            ing.usedInPlanId === null ? { ...ing, usedInPlanId: newPlanId } : ing
        ));

    } catch (e) {
        console.error(e);
        alert("AI 救援失敗，請檢查網路或稍後再試！");
    } finally {
        setStatus('idle');
    }
  };

  const handleDeletePlan = (planId: number) => {
    if (window.confirm("確定要解散這個餐點計畫嗎？相關食材將會被釋放。")) {
      setMealPlans(mealPlans.filter(p => p.id !== planId));
      setIngredients(prev => prev.map(ing => 
        ing.usedInPlanId === planId ? { ...ing, usedInPlanId: null } : ing
      ));
    }
  };

  const getMealIcon = (type: string) => {
    switch(type) {
      case 'breakfast': return <Coffee size={18} className="text-[#F4A261]" />;
      case 'lunch': return <Sun size={18} className="text-[#F2CC8F]" />;
      case 'dinner': return <Moon size={18} className="text-[#2A9D8F]" />;
      default: return <Clock size={18} />;
    }
  };

  const getMealLabel = (type: string) => {
    switch(type) {
      case 'breakfast': return '早餐';
      case 'lunch': return '午餐';
      case 'dinner': return '晚餐';
      default: return '點心';
    }
  };

  const getPlanName = (planId: number | null) => {
    const plan = mealPlans.find(p => p.id === planId);
    return plan ? plan.menuName : '未知餐點';
  };

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      <div className="bg-[#FFFEF5] rounded-3xl shadow-sm border border-[#E0D8C0] overflow-hidden">
        <div className="bg-[#7BC64F]/20 px-5 py-4 border-b border-[#E0D8C0] flex justify-between items-center sticky top-0 z-10 backdrop-blur-sm">
           <h3 className="font-bold text-[#5D4632] flex items-center gap-2 text-lg">
             <Package size={20} className="text-[#7BC64F]" />
             共享冰箱
           </h3>
           <span className="text-xs text-[#8C7B65] bg-white/60 px-2 py-1 rounded-full">點擊選擇</span>
        </div>
        
        <div className="p-3 space-y-2 max-h-[400px] overflow-y-auto">
          {ingredients.map(ing => {
            const isMine = ing.owner.id === currentUser.id;
            const canDelete = isMine || currentUser.isAdmin;
            const isLocked = ing.usedInPlanId !== null;
            const isReassigning = reassigningId === ing.id;

            return (
              <div 
                key={ing.id} 
                className={`flex items-center justify-between p-3 rounded-2xl group transition-all select-none border-2 active:scale-[0.99] relative ${
                  isLocked 
                    ? 'bg-[#E0D8C0]/30 border-transparent cursor-not-allowed opacity-60' 
                    : ing.selected 
                        ? 'bg-white border-[#7BC64F] shadow-sm'
                        : 'bg-white border-[#E0D8C0]/30 hover:border-[#F2CC8F] cursor-pointer'
                }`}
                onClick={() => !isReassigning && toggleIngredient(ing.id)}
              >
                <div className="flex items-center gap-3 flex-1 pointer-events-none">
                  {/* Checkbox Icon - Larger for touch */}
                  <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center transition-all flex-shrink-0 ${
                    isLocked 
                      ? 'bg-[#E0D8C0] border-[#E0D8C0]'
                      : ing.selected 
                        ? 'bg-[#7BC64F] border-[#7BC64F]' 
                        : 'border-[#E0D8C0] bg-white'
                  }`}>
                    {isLocked && <Lock size={14} className="text-white" />}
                    {!isLocked && ing.selected && <Check size={16} className="text-white" />}
                  </div>
                  
                  <div className="flex flex-col">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`font-bold text-base ${ing.selected || isLocked ? 'text-[#5D4632]' : 'text-[#8C7B65]'} ${isLocked ? 'line-through' : ''}`}>
                        {ing.name}
                      </span>
                      {isLocked && (
                        <span className="text-[10px] bg-[#E0D8C0] text-[#5D4632] px-2 py-0.5 rounded-full flex items-center gap-1 font-bold whitespace-nowrap">
                          🔒 用於 {getPlanName(ing.usedInPlanId)}
                        </span>
                      )}
                    </div>
                    
                    {/* Interactive Owner Label for Admin */}
                    <div 
                        onClick={(e) => {
                            if (currentUser.isAdmin) {
                                e.stopPropagation();
                                setReassigningId(ing.id);
                            }
                        }}
                        className={`text-xs flex items-center gap-1 mt-0.5 w-fit rounded-full transition-colors ${
                            currentUser.isAdmin 
                                ? 'cursor-pointer hover:bg-[#E0D8C0]/50 pointer-events-auto pr-2 -ml-1 pl-1 border border-transparent hover:border-[#E0D8C0]' 
                                : 'text-[#8C7B65]'
                        }`}
                    >
                      {ing.owner.avatar} <span className={currentUser.isAdmin ? 'underline decoration-dashed decoration-[#8C7B65]' : ''}>{ing.owner.name} 提供</span>
                      {currentUser.isAdmin && <Edit2 size={10} className="opacity-50" />}
                    </div>
                  </div>
                </div>
                
                {!isLocked && canDelete && (
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteIngredient(ing.id);
                    }} 
                    className="text-[#E0D8C0] hover:text-[#E76F51] p-3 rounded-full transition-all"
                    title="刪除"
                  >
                    <Trash2 size={20} />
                  </button>
                )}

                {/* Reassignment Popover */}
                {isReassigning && (
                    <div 
                        className="absolute left-2 bottom-12 bg-white shadow-xl border-2 border-[#E76F51] rounded-2xl p-2 z-30 flex gap-2 items-center animate-fade-in max-w-[280px] overflow-x-auto"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <span className="text-[10px] font-bold text-[#E76F51] whitespace-nowrap px-1">改為:</span>
                        {members.map(m => (
                            <button
                                key={m.id}
                                onClick={() => handleReassign(ing.id, m)}
                                className="w-8 h-8 rounded-full bg-[#E9F5D8] border border-[#7BC64F] text-sm shrink-0 hover:scale-110 transition-transform"
                                title={`指派給 ${m.name}`}
                            >
                                {m.avatar}
                            </button>
                        ))}
                        <button onClick={() => setReassigningId(null)} className="ml-1 text-[#8C7B65] p-1"><X size={16}/></button>
                    </div>
                )}
              </div>
            );
          })}
          {ingredients.length === 0 && (
             <div className="text-center py-8 text-[#8C7B65] text-sm italic">
                冰箱空空的...<br/>快用下方對話框輸入或拍照新增食材！
             </div>
          )}
        </div>

        {/* Chat-like Input Bar - LINE Style */}
        <div className="p-3 bg-white border-t border-[#E0D8C0] flex items-end gap-2 sticky bottom-0 z-20 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
          <input 
            type="file" 
            accept="image/*" 
            capture="environment"
            className="hidden" 
            ref={cameraInputRef}
            onChange={handleImageUpload}
          />
          <input 
            type="file" 
            accept="image/*" 
            className="hidden" 
            ref={galleryInputRef}
            onChange={handleImageUpload}
          />
          
          <div className="flex gap-1 pb-1">
             <button
                onClick={() => cameraInputRef.current?.click()}
                disabled={status === 'analyzing'}
                className="p-2 rounded-xl text-[#8C7B65] hover:bg-[#F2F7E6] hover:text-[#5D4632] transition-colors active:scale-95"
                title="拍照"
              >
                 <Camera size={24} />
              </button>
              <button
                onClick={() => galleryInputRef.current?.click()}
                disabled={status === 'analyzing'}
                className="p-2 rounded-xl text-[#8C7B65] hover:bg-[#F2F7E6] hover:text-[#5D4632] transition-colors active:scale-95"
                title="從相簿選擇"
              >
                 <ImageIcon size={24} />
              </button>
          </div>
          
          <div className="flex-1 bg-[#F9F7F2] border-2 border-[#E0D8C0] rounded-2xl px-4 py-2 flex items-center focus-within:border-[#7BC64F] transition-colors">
            <input 
                type="text" 
                value={newIngName}
                onChange={(e) => setNewIngName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddIngredient()}
                placeholder={status === 'analyzing' ? "正在辨識圖片中..." : "輸入食材名稱..."}
                disabled={status === 'analyzing'}
                className="flex-1 bg-transparent border-none outline-none text-[#5D4632] placeholder:text-[#8C7B65]/50 text-sm py-1"
            />
          </div>

          <button 
            onClick={handleAddIngredient}
            disabled={status === 'analyzing' || !newIngName.trim()}
            className={`p-3 rounded-full shadow-sm flex items-center justify-center active:scale-95 transition-all mb-0.5 ${
                newIngName.trim() 
                    ? 'bg-[#7BC64F] text-white hover:bg-[#5da135]' 
                    : 'bg-[#E0D8C0] text-white cursor-not-allowed'
            }`}
          >
            {status === 'analyzing' ? (
                <Loader2 size={20} className="animate-spin" />
            ) : (
                <Plus size={24} />
            )}
          </button>
        </div>
      </div>

      <div className="bg-[#FFFEF5] p-5 rounded-3xl shadow-sm border border-[#E0D8C0]">
        
        {/* 人數設定區 - 響應式調整 */}
        <div className="mb-4 bg-[#F2CC8F]/20 p-4 rounded-2xl border border-[#F2CC8F]/50">
          <label className="block text-xs font-bold text-[#E76F51] mb-2 uppercase tracking-wide flex items-center gap-1">
            <Users size={14} /> 狸克提醒：用餐人數
          </label>
          <div className="flex gap-3">
             <div className="flex-1 flex flex-col sm:flex-row items-center justify-between bg-white px-3 py-2 rounded-xl border border-[#E0D8C0]">
               <span className="text-sm font-bold text-[#5D4632] mb-1 sm:mb-0">大人</span>
               <div className="flex items-center gap-3">
                 <button onClick={() => setAdults(Math.max(1, adults - 1))} className="w-8 h-8 rounded-full bg-[#E0D8C0] text-white hover:bg-[#F4A261] flex items-center justify-center transition-colors active:scale-95"><Minus size={16}/></button>
                 <span className="text-lg font-bold w-6 text-center text-[#5D4632]">{adults}</span>
                 <button onClick={() => setAdults(adults + 1)} className="w-8 h-8 rounded-full bg-[#E0D8C0] text-white hover:bg-[#F4A261] flex items-center justify-center transition-colors active:scale-95"><Plus size={16}/></button>
               </div>
             </div>
             <div className="flex-1 flex flex-col sm:flex-row items-center justify-between bg-white px-3 py-2 rounded-xl border border-[#E0D8C0]">
               <span className="text-sm font-bold text-[#5D4632] mb-1 sm:mb-0">小孩</span>
               <div className="flex items-center gap-3">
                 <button onClick={() => setChildren(Math.max(0, children - 1))} className="w-8 h-8 rounded-full bg-[#E0D8C0] text-white hover:bg-[#F4A261] flex items-center justify-center transition-colors active:scale-95"><Minus size={16}/></button>
                 <span className="text-lg font-bold w-6 text-center text-[#5D4632]">{children}</span>
                 <button onClick={() => setChildren(children + 1)} className="w-8 h-8 rounded-full bg-[#E0D8C0] text-white hover:bg-[#F4A261] flex items-center justify-center transition-colors active:scale-95"><Plus size={16}/></button>
               </div>
             </div>
          </div>
        </div>

        {/* 響應式日期與餐別選擇 - 手機上堆疊，平板並排 */}
        <div className="flex flex-col sm:flex-row items-end gap-3 mb-4">
          <div className="w-full sm:w-1/3">
             <label className="block text-xs font-bold text-[#8C7B65] mb-1 pl-1">
              第幾天
            </label>
            <div className="flex items-center bg-white rounded-2xl p-1.5 border-2 border-[#E0D8C0]">
               <button 
                onClick={() => setDay(Math.max(1, day - 1))}
                className="p-2 hover:bg-[#E9F5D8] rounded-full transition-colors text-[#8C7B65] active:scale-95"
               >
                 <Minus size={16} />
               </button>
               <div className="flex-1 text-center text-base font-bold text-[#5D4632]">
                 第 {day} 天
               </div>
               <button 
                onClick={() => setDay(day + 1)}
                className="p-2 hover:bg-[#E9F5D8] rounded-full transition-colors text-[#8C7B65] active:scale-95"
               >
                 <Plus size={16} />
               </button>
            </div>
          </div>

          <div className="w-full sm:flex-1">
            <label className="block text-xs font-bold text-[#8C7B65] mb-1 pl-1">
              什麼餐
            </label>
            <div className="flex bg-white rounded-2xl p-1 border-2 border-[#E0D8C0]">
              {(['breakfast', 'lunch', 'dinner'] as const).map((type) => (
                <button
                  key={type}
                  onClick={() => setMealType(type)}
                  className={`flex-1 py-2 text-sm font-bold rounded-xl flex items-center justify-center gap-1 transition-all active:scale-95 ${
                    mealType === type 
                      ? 'bg-[#F2CC8F] text-[#5D4632] shadow-sm' 
                      : 'text-[#8C7B65] hover:bg-[#E9F5D8]'
                  }`}
                >
                  {getMealIcon(type)}
                  {getMealLabel(type)}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex gap-2">
           {/* Main Generate Button */}
            <button 
              onClick={handleGenerate}
              disabled={status !== 'idle'}
              className="flex-1 bg-[#2A9D8F] text-white py-4 rounded-full font-bold shadow-md hover:bg-[#21867a] active:scale-95 transition-all flex justify-center items-center gap-2 text-lg disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {status === 'loading' ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  大廚狸克思考中...
                </>
              ) : (
                <>
                  <Sparkles size={20} />
                  請狸克設計菜單！
                </>
              )}
            </button>
            
            {/* Leftover Rescue Button */}
            <button 
                onClick={handleLeftoverRescue}
                disabled={status !== 'idle'}
                className="bg-[#E76F51] text-white px-4 py-4 rounded-full font-bold shadow-md hover:bg-[#D65F41] active:scale-95 transition-all flex flex-col justify-center items-center text-xs gap-1 disabled:opacity-70 disabled:cursor-not-allowed w-24"
                title="用剩下的食材做一道料理"
            >
                 {status === 'rescuing' ? (
                     <Loader2 size={20} className="animate-spin" />
                 ) : (
                     <Soup size={20} />
                 )}
                 <span>剩食大作戰</span>
            </button>
        </div>
      </div>

      <div className="space-y-4">
        {mealPlans.map((plan) => (
          <div key={plan.id} className="bg-[#FFFEF5] rounded-3xl shadow-lg overflow-hidden border border-[#E0D8C0] relative group">
            <button 
              onClick={() => handleDeletePlan(plan.id)}
              className="absolute top-3 right-3 p-2 text-[#E0D8C0] hover:text-[#E76F51] bg-white rounded-full transition-colors z-10 shadow-sm border border-[#E0D8C0] active:scale-90"
              title="解散餐點"
            >
              <Trash2 size={20} />
            </button>

            <div className="bg-[#F2CC8F]/20 p-5 border-b border-[#E0D8C0]">
              <div className="flex items-center gap-2 text-[#E76F51] font-bold text-xs uppercase mb-1 bg-white/60 px-2 py-1 rounded-full w-fit">
                {getMealIcon(plan.mealType)}
                {plan.title}
              </div>
              <h2 className="text-xl font-bold text-[#5D4632] mt-2">{plan.menuName}</h2>
              <p className="text-sm text-[#8C7B65] mt-2 bg-white/50 p-3 rounded-2xl border border-[#E0D8C0]/50 italic">
                "{plan.reason}"
              </p>
            </div>
            
            <div className="p-5 text-center text-[#8C7B65] text-sm">
                請至「菜單」頁面查看詳細食材清單與料理步驟。
            </div>
          </div>
        ))}
        
        {mealPlans.length === 0 && (
          <div className="text-center py-12 text-[#8C7B65] bg-[#E0D8C0]/20 rounded-3xl border-2 border-dashed border-[#E0D8C0]">
            <ChefHat size={48} className="mx-auto text-[#E0D8C0] mb-3" />
            <p>還沒有安排任何餐點喔！<br/>快去上方選擇食材吧。</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default KitchenSection;