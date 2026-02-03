import React, { useState, useRef } from 'react';
import { 
  Package, Lock, Check, Trash2, Plus, Users, Minus, Coffee, Sun, Moon, Clock, Sparkles, ChefHat, Camera, Loader2, Image as ImageIcon, X, Edit2, Soup, IceCream, Calendar, ShoppingBag, ChevronDown, ChevronUp, Ban
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
  const [mealType, setMealType] = useState<'breakfast' | 'lunch' | 'dinner' | 'snack'>('dinner'); 
  const [day, setDay] = useState(1); 
  const [adults, setAdults] = useState(4);
  const [children, setChildren] = useState(2);
  const [status, setStatus] = useState<'idle' | 'loading' | 'analyzing' | 'rescuing'>('idle'); 
  
  const [assigningIngredientId, setAssigningIngredientId] = useState<string | null>(null);
  
  // State for grouping UI
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});

  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  const handleAddIngredient = () => {
    if (!newIngName.trim()) return;
    const newItem: Ingredient = {
      id: Date.now(),
      name: newIngName,
      quantity: '',
      selected: true, 
      usedInPlanId: null, 
      owner: { id: currentUser.id, name: currentUser.name, avatar: currentUser.avatar } 
    };
    setIngredients([...ingredients, newItem]);
    setNewIngName('');
  };

  const toggleIngredient = (id: number | string) => {
    setIngredients(prev => prev.map(ing => {
      if (String(ing.id) === String(id) && ing.usedInPlanId === null) {
        return { ...ing, selected: !ing.selected };
      }
      return ing;
    }));
  };

  const handleUpdateQuantity = (id: number | string, newQty: string) => {
    setIngredients(prev => prev.map(ing => 
      String(ing.id) === String(id) ? { ...ing, quantity: newQty } : ing
    ));
    
    setMealPlans(prev => prev.map(plan => ({
      ...plan,
      checklist: plan.checklist.map(item => 
        String(item.sourceIngredientId) === String(id) 
          ? { ...item, quantity: newQty } 
          : item
      )
    })));
  };

  const handleClaimIngredient = (id: number | string, assignedUser?: {id: string, name: string, avatar: string} | null) => {
    setIngredients(prev => prev.map(ing => {
        if (String(ing.id) !== String(id)) return ing;
        
        let newOwner = ing.owner;

        if (currentUser.isAdmin && assignedUser !== undefined) {
             newOwner = assignedUser;
        }
        else if (currentUser.isAdmin) {
             if (ing.owner) newOwner = null;
             else newOwner = { id: currentUser.id, name: currentUser.name, avatar: currentUser.avatar };
        } else {
             if (ing.owner?.id === currentUser.id) newOwner = null;
             else if (!ing.owner) newOwner = { id: currentUser.id, name: currentUser.name, avatar: currentUser.avatar };
             else return ing;
        }
        
        return { ...ing, owner: newOwner };
    }));

    if (assignedUser !== undefined) setAssigningIngredientId(null);

    setMealPlans(prevPlans => prevPlans.map(plan => ({
        ...plan,
        checklist: plan.checklist.map(item => {
            if (String(item.sourceIngredientId) === String(id)) {
                const currentIng = ingredients.find(i => String(i.id) === String(id));
                if (!currentIng) return item;

                let newOwner = item.owner;

                if (currentUser.isAdmin && assignedUser !== undefined) {
                     newOwner = assignedUser ? { name: assignedUser.name, avatar: assignedUser.avatar } : null;
                } else if (currentUser.isAdmin) {
                     if (item.owner) newOwner = null;
                     else newOwner = { name: currentUser.name, avatar: currentUser.avatar };
                } else {
                     if (currentIng.owner?.id === currentUser.id) newOwner = null;
                     else if (!currentIng.owner) newOwner = { name: currentUser.name, avatar: currentUser.avatar };
                }
                
                return { ...item, owner: newOwner };
            }
            return item;
        })
    })));
  };

  const handleDeleteIngredient = (id: number | string) => {
     const target = ingredients.find(i => String(i.id) === String(id));
     if (!target) return;

     if (target.owner && target.owner.id !== currentUser.id && !currentUser.isAdmin) {
       alert("您不能刪除別人提供的食材喔！");
       return;
     }

     let shouldDelete = true;
     if (target.usedInPlanId) {
         shouldDelete = window.confirm(`【${target.name}】目前被用於餐點中。\n確定要刪除嗎？(將從餐點清單中解除連結)`);
     }

     if (shouldDelete) {
         setIngredients(ingredients.filter(i => String(i.id) !== String(id)));
         
         if (target.usedInPlanId) {
             setMealPlans(prev => prev.map(p => ({
               ...p,
               checklist: p.checklist.map(c => 
                   String(c.sourceIngredientId) === String(id)
                     ? { ...c, sourceIngredientId: null, owner: null, name: `${c.name}` } 
                     : c
               )
           })));
         }
     }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    // ... (Keep existing implementation)
    const file = e.target.files?.[0];
    if (!file) return;
    setStatus('analyzing');
    try {
      const base64String = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve((reader.result as string).split(',')[1]);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      const identifiedItems = await identifyIngredientsFromImage(base64String);
      if (identifiedItems.length > 0) {
        const newIngredients: Ingredient[] = identifiedItems.map((name, index) => ({
          id: Date.now() + index,
          name: name,
          quantity: '1',
          selected: true,
          usedInPlanId: null,
          owner: { id: currentUser.id, name: currentUser.name, avatar: currentUser.avatar }
        }));
        setIngredients(prev => [...prev, ...newIngredients]);
      } else {
        alert("狸克看不太出來這張照片裡有什麼食材耶...😅");
      }
    } catch (error: any) {
      console.error(error);
      if (error.message && error.message.includes('API Key')) {
          alert("尚未設定 API Key！\n請點擊右上角設定 (齒輪) -> 系統 -> 輸入 Key。");
      } else {
          alert("圖片辨識失敗，請檢查網路連線。");
      }
    } finally {
      setStatus('idle');
      if (cameraInputRef.current) cameraInputRef.current.value = '';
      if (galleryInputRef.current) galleryInputRef.current.value = '';
    }
  };

  const handleGenerate = async () => {
    // ... (Keep existing implementation)
    const selectedItems = ingredients.filter(i => i.selected);
    setStatus('loading');
    try {
        const dayLabel = day === 0 ? '行程通用' : `第 ${day} 天`;
        const title = `${dayLabel} ${getMealLabel(mealType)}`;
        const selectedNames = selectedItems.map(i => i.name);
        
        const generatedDishes = await generateCampMeal(selectedNames, mealType === 'snack' ? 'snack/drink' : mealType, adults, children, title);
        
        if (generatedDishes.length === 0) {
            alert("AI 沒有產生任何菜單，請重試。");
            return;
        }

        const newPlans: MealPlan[] = [];
        const timestamp = Date.now();
        const newIngredientsToAdd: Ingredient[] = [];
        
        const ingredientMap = new Map<string, number>(); 
        selectedItems.forEach(ing => ingredientMap.set(ing.name, ing.id));
        const assignedIngredientIds = new Set<number>();

        generatedDishes.forEach((dish, index) => {
             const newPlanId = timestamp + index * 100;
             const dishCheckItems: CheckItem[] = [];
             
             dish.shoppingList.forEach((shopItem, itemIdx) => {
                 let matchedIngId: number | null = null;
                 let matchedOwner = null;
                 let isFromInventory = false;
                 let qty = shopItem.buy !== '0' ? shopItem.buy : (shopItem.need || '');

                 if (ingredientMap.has(shopItem.name) && !assignedIngredientIds.has(ingredientMap.get(shopItem.name)!)) {
                      matchedIngId = ingredientMap.get(shopItem.name)!;
                      const originalIng = selectedItems.find(i => i.id === matchedIngId);
                      matchedOwner = originalIng?.owner || null;
                      if(originalIng?.quantity) qty = originalIng.quantity; 
                      isFromInventory = true;
                 } else {
                     const partialMatch = selectedItems.find(i => 
                        !assignedIngredientIds.has(i.id) && 
                        (i.name.includes(shopItem.name) || shopItem.name.includes(i.name))
                     );
                     if (partialMatch) {
                          matchedIngId = partialMatch.id;
                          matchedOwner = partialMatch.owner;
                          if(partialMatch.quantity) qty = partialMatch.quantity;
                          isFromInventory = true;
                     }
                 }

                 if (isFromInventory && matchedIngId) {
                      assignedIngredientIds.add(matchedIngId);
                      dishCheckItems.push({
                          id: `check-${newPlanId}-${itemIdx}`,
                          name: shopItem.name,
                          quantity: qty,
                          checked: false,
                          owner: matchedOwner ? { name: matchedOwner.name, avatar: matchedOwner.avatar } : null,
                          sourceIngredientId: matchedIngId
                      });
                 } else {
                      const newIngId = timestamp + index * 1000 + itemIdx;
                      
                      newIngredientsToAdd.push({
                          id: newIngId,
                          name: shopItem.name,
                          quantity: qty,
                          selected: false,
                          usedInPlanId: newPlanId,
                          owner: null
                      });

                      dishCheckItems.push({
                          id: `check-${newPlanId}-${itemIdx}`,
                          name: shopItem.name,
                          quantity: qty,
                          checked: false,
                          owner: null,
                          sourceIngredientId: newIngId
                      });
                 }
             });

             newPlans.push({
                id: newPlanId,
                dayLabel,
                mealType,
                title,
                menuName: dish.menuName,
                reason: dish.reason,
                checklist: dishCheckItems,
                notes: "",
                recipe: dish.recipe
            });
        });

        if (newPlans.length > 0) {
            const firstPlan = newPlans[0];
            selectedItems.forEach(ing => {
                if (!assignedIngredientIds.has(ing.id)) {
                     firstPlan.checklist.unshift({
                          id: `inv-${ing.id}`,
                          name: ing.name,
                          quantity: ing.quantity,
                          checked: false,
                          owner: { name: ing.owner.name, avatar: ing.owner.avatar },
                          sourceIngredientId: ing.id
                     });
                     assignedIngredientIds.add(ing.id);
                }
            });
        }

        setMealPlans([...newPlans, ...mealPlans]); 
        setIngredients(prev => {
            const updatedExisting = prev.map(ing => {
                if (assignedIngredientIds.has(ing.id)) {
                    const planId = newPlans.find(p => p.checklist.some(c => c.sourceIngredientId === ing.id))?.id;
                    return { ...ing, usedInPlanId: planId || null, selected: false };
                }
                if (ing.selected) return { ...ing, selected: false };
                return ing;
            });
            return [...updatedExisting, ...newIngredientsToAdd];
        });

    } catch (error: any) {
        console.error(error);
        if (error.message && error.message.includes('API Key')) {
            alert("尚未設定 API Key！\n請點擊右上角設定 (齒輪) -> 系統 -> 輸入 Key。");
        } else {
            alert("狸克大廚去喝咖啡了，請稍後再試！");
        }
    } finally {
        setStatus('idle');
    }
  };

  const handleLeftoverRescue = async () => {
    // ... (Keep existing implementation)
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
        const usedInventoryItems: CheckItem[] = [];
        availableIngredients.forEach(ing => {
             usedInventoryItems.push({
                 id: `inv-${ing.id}`,
                 name: ing.name,
                 quantity: ing.quantity,
                 checked: false,
                 owner: ing.owner ? { name: ing.owner.name, avatar: ing.owner.avatar } : null,
                 sourceIngredientId: ing.id
             });
        });
        const newPlan: MealPlan = {
            id: newPlanId,
            dayLabel: '撤收前',
            mealType: 'lunch',
            title: '清冰箱大作戰',
            menuName: aiResponse.menuName,
            reason: aiResponse.reason,
            checklist: usedInventoryItems,
            notes: "請將所有剩餘食材確認後投入！",
            recipe: aiResponse.recipe
        };
        setMealPlans([newPlan, ...mealPlans]);
        setIngredients(prev => prev.map(ing => 
            ing.usedInPlanId === null ? { ...ing, usedInPlanId: newPlanId } : ing
        ));
    } catch (e: any) {
        console.error(e);
        if (e.message && e.message.includes('API Key')) {
            alert("尚未設定 API Key！\n請點擊右上角設定 (齒輪) -> 系統 -> 輸入 Key。");
        } else {
            alert("AI 救援失敗，請檢查網路或稍後再試！");
        }
    } finally {
        setStatus('idle');
    }
  };

  const handleDeletePlan = (planId: number | string) => {
    if (window.confirm("確定要解散這個餐點計畫嗎？相關食材將會被釋放。")) {
      setMealPlans(mealPlans.filter(p => String(p.id) !== String(planId)));
      setIngredients(prev => prev.map(ing => 
        String(ing.usedInPlanId) === String(planId) ? { ...ing, usedInPlanId: null } : ing
      ));
    }
  };

  const toggleGroupExpand = (groupKey: string) => {
      setExpandedGroups(prev => ({...prev, [groupKey]: !prev[groupKey]}));
  };

  const getMealIcon = (type: string) => {
    switch(type) {
      case 'breakfast': return <Coffee size={18} className="text-[#F4A261]" />;
      case 'lunch': return <Sun size={18} className="text-[#F2CC8F]" />;
      case 'dinner': return <Moon size={18} className="text-[#2A9D8F]" />;
      case 'snack': return <IceCream size={18} className="text-[#E76F51]" />;
      default: return <Clock size={18} />;
    }
  };

  const getMealLabel = (type: string) => {
    switch(type) {
      case 'breakfast': return '早餐';
      case 'lunch': return '午餐';
      case 'dinner': return '晚餐';
      case 'snack': return '點心';
      default: return '點心';
    }
  };

  const getPlanContext = (planId: number | null) => {
    const plan = mealPlans.find(p => String(p.id) === String(planId));
    if (!plan) return null;
    return {
        label: `${plan.dayLabel} ${getMealLabel(plan.mealType)}`,
        menu: plan.menuName,
        mealType: plan.mealType
    };
  };

  const sortedGroupKeys = Object.keys(expandedGroups).sort(); 

  // Grouping Logic
  const groupedPlans = mealPlans.reduce((acc, plan) => {
      const key = `${plan.dayLabel}-${plan.mealType}`;
      if (!acc[key]) {
          acc[key] = {
              dayLabel: plan.dayLabel,
              mealType: plan.mealType,
              plans: []
          };
      }
      acc[key].plans.push(plan);
      return acc;
  }, {} as Record<string, { dayLabel: string, mealType: string, plans: MealPlan[] }>);

  const sortedKeys = Object.keys(groupedPlans).sort();

  // Progress Calculation
  const totalIngredients = ingredients.length;
  const claimedIngredients = ingredients.filter(i => !!i.owner).length;
  const progressPercent = totalIngredients > 0 ? Math.round((claimedIngredients / totalIngredients) * 100) : 0;

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      <div className="bg-[#FFFEF5] rounded-3xl shadow-sm border border-[#E0D8C0] overflow-hidden">
        <div className="bg-[#7BC64F]/20 px-5 py-4 border-b border-[#E0D8C0] flex flex-col gap-2 sticky top-0 z-10 backdrop-blur-sm">
           <div className="flex justify-between items-center">
               <h3 className="font-bold text-[#5D4632] flex items-center gap-2 text-lg"><Package size={20} className="text-[#7BC64F]" />共享冰箱 (食材庫)</h3>
               <span className="text-xs text-[#8C7B65] bg-white/60 px-2 py-1 rounded-full">點擊可選擇 (AI用)</span>
           </div>
           {totalIngredients > 0 && (
               <div className="flex items-center gap-2 text-xs font-bold text-[#5D4632]">
                   <div className="flex-1 h-2 bg-white rounded-full overflow-hidden border border-[#E0D8C0]">
                       <div className="h-full bg-[#7BC64F] transition-all duration-500" style={{ width: `${progressPercent}%` }}></div>
                   </div>
                   <span>{claimedIngredients}/{totalIngredients} ({progressPercent}%)</span>
               </div>
           )}
        </div>
        <div className="p-3 space-y-2 max-h-[400px] overflow-y-auto">
          {ingredients.map(ing => {
            const isMine = ing.owner?.id === currentUser.id;
            const isBuy = !ing.owner; // No owner = Need to Buy
            const canDelete = isMine || currentUser.isAdmin || isBuy;
            const planContext = getPlanContext(ing.usedInPlanId);
            const isLocked = planContext !== null;
            const isAssigning = String(assigningIngredientId) === String(ing.id);
            const isUserLocked = !!ing.owner && !isMine && !currentUser.isAdmin; 
            
            return (
              <div key={ing.id} className={`flex flex-col p-3 rounded-2xl group transition-all select-none border-2 active:scale-[0.99] relative ${ing.selected ? 'bg-white border-[#7BC64F] shadow-sm' : 'bg-white border-[#E0D8C0]/30 hover:border-[#F2CC8F] cursor-pointer'}`} onClick={() => !isAssigning && toggleIngredient(ing.id)}>
                <div className="flex items-center justify-between gap-2">
                    {/* Left: Avatar Circle */}
                    <div className="flex items-center gap-3 flex-1 min-w-0 pointer-events-none">
                        <div className={`w-10 h-10 rounded-full border-2 flex items-center justify-center transition-all flex-shrink-0 relative overflow-hidden bg-white ${ing.selected ? 'border-[#7BC64F]' : 'border-[#E0D8C0]'}`}>
                            {ing.owner ? (
                                <span className="text-xl">{ing.owner.avatar}</span>
                            ) : (
                                <ShoppingBag size={18} className="text-[#E76F51]" />
                            )}
                            {ing.selected && (
                                <div className="absolute inset-0 bg-[#7BC64F]/80 flex items-center justify-center">
                                    <Check size={20} className="text-white" />
                                </div>
                            )}
                        </div>
                        <div className="flex flex-col flex-1 min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                                <span className={`font-bold text-base truncate ${ing.selected ? 'text-[#5D4632]' : 'text-[#8C7B65]'}`}>{ing.name}</span>
                            </div>
                            <div className="flex items-center gap-1 mt-0.5">
                                {ing.owner ? (
                                    <span className={`text-[10px] px-2 py-0.5 rounded-full flex items-center gap-1 truncate ${isMine ? 'bg-[#E9F5D8] text-[#5D4632]' : 'bg-[#F9F7F2] text-[#8C7B65]'}`}>
                                        {ing.owner.name}
                                    </span>
                                ) : (
                                    <span className="text-[10px] text-[#E76F51] bg-[#E76F51]/10 px-2 py-0.5 rounded-full font-bold flex items-center gap-1 whitespace-nowrap">
                                        需採買
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>
                    
                    {/* Right: Actions (Claim, Qty, Delete) */}
                    <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                        {/* Claim/Assign Button */}
                        {isAssigning ? (
                             <div className="absolute right-2 bg-white shadow-xl border-2 border-[#E76F51] rounded-2xl p-2 z-20 flex gap-2 items-center animate-fade-in max-w-[250px] overflow-x-auto" onClick={e => e.stopPropagation()}>
                                <button onClick={() => handleClaimIngredient(ing.id, null)} className="w-8 h-8 rounded-full bg-[#E0D8C0] text-white flex items-center justify-center shrink-0 hover:bg-[#E76F51]" title="設為需採買"><ShoppingBag size={14} /></button>
                                {members.map(m => ( <button key={m.id} onClick={() => handleClaimIngredient(ing.id, { id: m.id, name: m.name, avatar: m.avatar })} className="w-8 h-8 rounded-full bg-[#E9F5D8] border border-[#7BC64F] text-sm shrink-0 hover:scale-110 transition-transform" title={`指派給 ${m.name}`}>{m.avatar}</button> ))}
                                <button onClick={() => setAssigningIngredientId(null)} className="ml-1 text-[#8C7B65]"><X size={16}/></button>
                             </div>
                        ) : (
                            <button 
                                onClick={(e) => { 
                                    e.stopPropagation(); 
                                    if (currentUser.isAdmin) { 
                                        setAssigningIngredientId(String(ing.id)); 
                                    } else { 
                                        handleClaimIngredient(ing.id); 
                                    } 
                                }} 
                                disabled={isUserLocked} 
                                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all shadow-sm active:scale-95 whitespace-nowrap pointer-events-auto ${
                                    isMine ? 'bg-white border-2 border-[#7BC64F] text-[#7BC64F] hover:bg-[#7BC64F]/10' : 
                                    (ing.owner && currentUser.isAdmin) ? 'bg-[#E76F51] text-white hover:bg-[#D65F41]' : 
                                    isUserLocked ? 'bg-[#E0D8C0] text-white cursor-not-allowed' : 
                                    'bg-[#F4A261] text-white hover:bg-[#E76F51]'
                                }`}
                            >
                                {isMine ? '取消' : (ing.owner && currentUser.isAdmin) ? '指派' : isUserLocked ? '鎖定' : '我帶'}
                            </button>
                        )}

                        <input 
                            type="text" 
                            placeholder="份量" 
                            value={ing.quantity || ''} 
                            onChange={(e) => handleUpdateQuantity(ing.id, e.target.value)}
                            className="w-14 bg-[#F9F7F2] border border-[#E0D8C0] rounded-lg px-2 py-1.5 text-xs text-[#5D4632] text-center focus:border-[#7BC64F] focus:outline-none placeholder:text-[#E0D8C0]"
                        />
                        
                        {(canDelete) && (
                            <button onClick={(e) => { e.stopPropagation(); handleDeleteIngredient(ing.id); }} className={`p-1.5 rounded-full transition-all z-20 pointer-events-auto text-[#E0D8C0] hover:text-[#E76F51] hover:bg-[#E76F51]/10`} title="刪除">
                                <Trash2 size={16} />
                            </button>
                        )}
                    </div>
                </div>

                {/* Usage Context Label - SHOWING DAY/MEAL/DISH */}
                {planContext ? (
                    <div className="mt-2 ml-[52px] flex items-center gap-1.5 text-xs pointer-events-none">
                         <span className={`px-2 py-0.5 rounded-full font-bold text-white shadow-sm flex items-center gap-1 ${planContext.mealType === 'dinner' ? 'bg-[#2A9D8F]' : planContext.mealType === 'lunch' ? 'bg-[#F2CC8F] text-[#5D4632]' : 'bg-[#F4A261]'}`}>
                            {planContext.label}
                         </span>
                         <span className="text-[#5D4632] font-bold">
                             {planContext.menu}
                         </span>
                    </div>
                ) : (
                    <div className="mt-2 ml-[52px] text-[10px] text-[#E76F51] font-bold bg-[#E76F51]/5 px-2 py-0.5 rounded w-fit">
                        尚未分配到任何料理
                    </div>
                )}
              </div>
            );
          })}
          {ingredients.length === 0 && ( <div className="text-center py-8 text-[#8C7B65] text-sm italic">冰箱空空的...<br/>快用下方對話框輸入或拍照新增食材！</div> )}
        </div>
        {/* Input Bar */}
        <div className="p-3 bg-white border-t border-[#E0D8C0] flex items-end gap-2 sticky bottom-0 z-20 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
          <input type="file" accept="image/*" capture="environment" className="hidden" ref={cameraInputRef} onChange={handleImageUpload}/>
          <input type="file" accept="image/*" className="hidden" ref={galleryInputRef} onChange={handleImageUpload}/>
          <div className="flex gap-1 pb-1">
             <button onClick={() => cameraInputRef.current?.click()} disabled={status === 'analyzing'} className="p-2 rounded-xl text-[#8C7B65] hover:bg-[#F2F7E6] hover:text-[#5D4632] transition-colors active:scale-95" title="拍照"><Camera size={24} /></button>
              <button onClick={() => galleryInputRef.current?.click()} disabled={status === 'analyzing'} className="p-2 rounded-xl text-[#8C7B65] hover:bg-[#F2F7E6] hover:text-[#5D4632] transition-colors active:scale-95" title="從相簿選擇"><ImageIcon size={24} /></button>
          </div>
          <div className="flex-1 bg-[#F9F7F2] border-2 border-[#E0D8C0] rounded-2xl px-4 py-2 flex items-center focus-within:border-[#7BC64F] transition-colors">
            <input type="text" value={newIngName} onChange={(e) => setNewIngName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleAddIngredient()} placeholder={status === 'analyzing' ? "正在辨識圖片中..." : "輸入食材名稱..."} disabled={status === 'analyzing'} className="flex-1 bg-transparent border-none outline-none text-[#5D4632] placeholder:text-[#8C7B65]/50 text-sm py-1"/>
          </div>
          <button onClick={handleAddIngredient} disabled={status === 'analyzing' || !newIngName.trim()} className={`p-3 rounded-full shadow-sm flex items-center justify-center active:scale-95 transition-all mb-0.5 ${newIngName.trim() ? 'bg-[#7BC64F] text-white hover:bg-[#5da135]' : 'bg-[#E0D8C0] text-white cursor-not-allowed'}`}>{status === 'analyzing' ? ( <Loader2 size={20} className="animate-spin" /> ) : ( <Plus size={24} /> )}</button>
        </div>
      </div>

      <div className="bg-[#FFFEF5] p-5 rounded-3xl shadow-sm border border-[#E0D8C0]">
        {/* ... (Keep controls) ... */}
        <div className="mb-4 bg-[#F2CC8F]/20 p-4 rounded-2xl border border-[#F2CC8F]/50">
          <label className="block text-xs font-bold text-[#E76F51] mb-2 uppercase tracking-wide flex items-center gap-1"><Users size={14} /> 狸克提醒：用餐人數</label>
          <div className="flex gap-3">
             <div className="flex-1 flex flex-col sm:flex-row items-center justify-between bg-white px-3 py-2 rounded-xl border border-[#E0D8C0]">
               <span className="text-sm font-bold text-[#5D4632] mb-1 sm:mb-0">大人</span>
               <div className="flex items-center gap-3">
                 <button onClick={() => setAdults(Math.max(1, adults - 1))} className="w-8 h-8 rounded-full bg-[#E0D8C0] text-white hover:bg-[#F4A261] flex items-center justify-center transition-colors active:scale-95"><Minus size={16}/></button><span className="text-lg font-bold w-6 text-center text-[#5D4632]">{adults}</span><button onClick={() => setAdults(adults + 1)} className="w-8 h-8 rounded-full bg-[#E0D8C0] text-white hover:bg-[#F4A261] flex items-center justify-center transition-colors active:scale-95"><Plus size={16}/></button>
               </div>
             </div>
             <div className="flex-1 flex flex-col sm:flex-row items-center justify-between bg-white px-3 py-2 rounded-xl border border-[#E0D8C0]">
               <span className="text-sm font-bold text-[#5D4632] mb-1 sm:mb-0">小孩</span>
               <div className="flex items-center gap-3">
                 <button onClick={() => setChildren(Math.max(0, children - 1))} className="w-8 h-8 rounded-full bg-[#E0D8C0] text-white hover:bg-[#F4A261] flex items-center justify-center transition-colors active:scale-95"><Minus size={16}/></button><span className="text-lg font-bold w-6 text-center text-[#5D4632]">{children}</span><button onClick={() => setChildren(children + 1)} className="w-8 h-8 rounded-full bg-[#E0D8C0] text-white hover:bg-[#F4A261] flex items-center justify-center transition-colors active:scale-95"><Plus size={16}/></button>
               </div>
             </div>
          </div>
        </div>
        <div className="flex flex-col sm:flex-row items-end gap-3 mb-4">
          <div className="w-full sm:w-1/3">
             <label className="block text-xs font-bold text-[#8C7B65] mb-1 pl-1">第幾天 (0為行程通用)</label>
            <div className={`flex items-center bg-white rounded-2xl p-1.5 border-2 border-[#E0D8C0]`}><button onClick={() => setDay(Math.max(0, day - 1))} className="p-2 hover:bg-[#E9F5D8] rounded-full transition-colors text-[#8C7B65] active:scale-95"><Minus size={16} /></button><div className="flex-1 text-center text-base font-bold text-[#5D4632] flex items-center justify-center gap-1">{day === 0 ? <Calendar size={14}/> : null}{day === 0 ? '行程通用' : `第 ${day} 天`}</div><button onClick={() => setDay(day + 1)} className="p-2 hover:bg-[#E9F5D8] rounded-full transition-colors text-[#8C7B65] active:scale-95"><Plus size={16} /></button></div>
          </div>
          <div className="w-full sm:flex-1">
            <label className="block text-xs font-bold text-[#8C7B65] mb-1 pl-1">什麼餐</label>
            <div className="flex bg-white rounded-2xl p-1 border-2 border-[#E0D8C0] overflow-x-auto">{(['breakfast', 'lunch', 'dinner', 'snack'] as const).map((type) => ( <button key={type} onClick={() => setMealType(type)} className={`flex-1 py-2 px-1 text-sm font-bold rounded-xl flex items-center justify-center gap-1 transition-all active:scale-95 whitespace-nowrap ${mealType === type ? 'bg-[#F2CC8F] text-[#5D4632] shadow-sm' : 'text-[#8C7B65] hover:bg-[#E9F5D8]'}`}>{getMealIcon(type)}<span className="hidden sm:inline">{getMealLabel(type)}</span><span className="sm:hidden">{getMealLabel(type).substring(0,2)}</span></button> ))}</div>
          </div>
        </div>
        <div className="flex gap-2">
            <button onClick={handleGenerate} disabled={status !== 'idle'} className="flex-1 bg-[#2A9D8F] text-white py-4 rounded-full font-bold shadow-md hover:bg-[#21867a] active:scale-95 transition-all flex justify-center items-center gap-2 text-lg disabled:opacity-70 disabled:cursor-not-allowed">{status === 'loading' ? ( <><div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>大廚狸克思考中...</> ) : ( <><Sparkles size={20} />請狸克設計{mealType === 'snack' ? '清單' : '菜單'}！</> )}</button>
            <button onClick={handleLeftoverRescue} disabled={status !== 'idle'} className="bg-[#E76F51] text-white px-4 py-4 rounded-full font-bold shadow-md hover:bg-[#D65F41] active:scale-95 transition-all flex flex-col justify-center items-center text-xs gap-1 disabled:opacity-70 disabled:cursor-not-allowed w-24" title="用剩下的食材做一道料理">{status === 'rescuing' ? ( <Loader2 size={20} className="animate-spin" /> ) : ( <Soup size={20} /> )}<span>剩食大作戰</span></button>
        </div>
      </div>

      <div className="space-y-4">
        {/* GROUPED PLANS */}
        {sortedKeys.length > 0 ? (
            sortedKeys.map(key => {
                const group = groupedPlans[key];
                const isExpanded = expandedGroups[key] !== false; 
                const groupTitle = `${group.dayLabel} ${getMealLabel(group.mealType)}`;
                
                return (
                    <div key={key} className="bg-[#FFFEF5] rounded-3xl shadow-md overflow-hidden border border-[#E0D8C0]">
                         <div 
                            className="bg-[#F2CC8F]/20 p-4 border-b border-[#E0D8C0] flex items-center justify-between cursor-pointer hover:bg-[#F2CC8F]/30 transition-colors"
                            onClick={() => toggleGroupExpand(key)}
                         >
                             <div className="flex items-center gap-3">
                                 <div className={`p-2.5 rounded-full shadow-sm text-white ${
                                     group.mealType === 'breakfast' ? 'bg-[#F4A261]' :
                                     group.mealType === 'lunch' ? 'bg-[#F2CC8F] text-[#5D4632]' :
                                     group.mealType === 'dinner' ? 'bg-[#2A9D8F]' :
                                     'bg-[#E76F51]'
                                 }`}>
                                     {getMealIcon(group.mealType)}
                                 </div>
                                 <h3 className="font-bold text-[#5D4632] text-lg">{groupTitle}</h3>
                                 <span className="text-xs bg-white/60 px-2 py-1 rounded-full text-[#8C7B65] font-bold">
                                     {group.plans.length} 道料理
                                 </span>
                             </div>
                             <div className="text-[#8C7B65]">
                                 {isExpanded ? <ChevronUp size={20}/> : <ChevronDown size={20}/>}
                             </div>
                         </div>
                         
                         {isExpanded !== false && (
                             <div className="divide-y divide-[#E0D8C0]/50">
                                 {group.plans.map(plan => (
                                     <div key={plan.id} className="p-4 relative hover:bg-[#F9F7F2] transition-colors group">
                                         {/* ... (Keep existing plan details) ... */}
                                         <div className="flex justify-between items-start pr-8">
                                             <div>
                                                 <h4 className="font-bold text-[#5D4632] text-lg mb-1">{plan.menuName}</h4>
                                                 {plan.reason && (
                                                     <p className="text-xs text-[#8C7B65] opacity-80 italic line-clamp-2">"{plan.reason}"</p>
                                                 )}
                                             </div>
                                         </div>
                                         <div className="mt-3 flex items-center justify-between">
                                             <div className="flex gap-2 text-xs">
                                                  <span className="bg-[#E9F5D8] text-[#5D4632] px-2 py-1 rounded-lg border border-[#7BC64F]/20 flex items-center gap-1">
                                                     <ChefHat size={12} /> {plan.checklist.length} 項食材
                                                  </span>
                                                  {plan.recipe?.steps?.length > 0 && (
                                                       <span className="bg-[#FFFEF5] text-[#8C7B65] px-2 py-1 rounded-lg border border-[#E0D8C0] flex items-center gap-1">
                                                          <Calendar size={12}/> 有步驟
                                                       </span>
                                                  )}
                                             </div>
                                         </div>

                                         {currentUser.isAdmin && (
                                            <button 
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleDeletePlan(plan.id);
                                            }}
                                            className="absolute top-4 right-4 p-2 text-[#E0D8C0] hover:text-[#E76F51] hover:bg-[#E76F51]/10 rounded-full transition-colors active:scale-90"
                                            title="解散此料理"
                                            >
                                            <Trash2 size={18} />
                                            </button>
                                        )}
                                        
                                        <div className="text-center mt-3 pt-3 border-t border-dashed border-[#E0D8C0]/50 text-xs text-[#8C7B65] opacity-60">
                                            請至「菜單」頁面查看詳細清單
                                        </div>
                                     </div>
                                 ))}
                             </div>
                         )}
                    </div>
                );
            })
        ) : (
             <div className="text-center py-12 text-[#8C7B65] bg-[#E0D8C0]/20 rounded-3xl border-2 border-dashed border-[#E0D8C0]"><ChefHat size={48} className="mx-auto text-[#E0D8C0] mb-3" /><p>還沒有安排任何餐點喔！<br/>快去上方選擇食材吧。</p></div>
        )}
      </div>
    </div>
  );
};

export default KitchenSection;