import React, { useState, useRef } from 'react';
import { BookOpen, Youtube, Flame, Coffee, Sun, Moon, Clock, Check, Plus, Trash2, StickyNote, PenSquare, X, ChevronDown, ChevronUp, ShoppingBag, Edit3, Save, Camera, Image as ImageIcon, Loader2, Sparkles, FileText, CalendarDays, Wand2, IceCream, Package, AlertTriangle } from 'lucide-react';
import { MealPlan, CheckItem, User, Ingredient } from '../types';
import { analyzeMenuFromImage, parseMenuItinerary, ItineraryItem, generateDishRecipe } from '../services/geminiService';

interface MenuSectionProps {
  mealPlans: MealPlan[];
  setMealPlans: React.Dispatch<React.SetStateAction<MealPlan[]>>;
  members: User[];
  ingredients: Ingredient[];
  setIngredients: React.Dispatch<React.SetStateAction<Ingredient[]>>;
  currentUser: User;
}

const MenuSection: React.FC<MenuSectionProps> = ({ mealPlans, setMealPlans, members, ingredients, setIngredients, currentUser }) => {
  const [expandedPlans, setExpandedPlans] = useState<Record<string, boolean>>(() => {
    if (mealPlans.length > 0) {
      return { [String(mealPlans[0].id)]: true };
    }
    return {};
  });

  const [addModalState, setAddModalState] = useState<{isOpen: boolean, context: { dayLabel: string, mealType: any } | null}>({
      isOpen: false,
      context: null
  });
  
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isGeneratingRecipe, setIsGeneratingRecipe] = useState(false);
  const [pastedMenuText, setPastedMenuText] = useState('');
  
  // Checklist Item Editing
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editQuantity, setEditQuantity] = useState('');
  const [editOwner, setEditOwner] = useState<{name: string, avatar: string} | null>(null);
  
  // Assignment State
  const [assigningItemId, setAssigningItemId] = useState<string | null>(null);

  // New Item Input
  const [newItemNames, setNewItemNames] = useState<Record<string, string>>({});

  const [editingPlanId, setEditingPlanId] = useState<string | null>(null);
  const [planEditForm, setPlanEditForm] = useState<{
    menuName: string;
    reason: string;
    steps: string;
    videoQuery: string;
    mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack'; 
  } | null>(null);

  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const bulkCameraRef = useRef<HTMLInputElement>(null);
  const bulkGalleryRef = useRef<HTMLInputElement>(null);

  const toggleExpand = (planId: number | string) => {
    const idStr = String(planId);
    setExpandedPlans(prev => ({
      ...prev,
      [idStr]: !prev[idStr]
    }));
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
      if (type === 'breakfast') return '早餐';
      if (type === 'lunch') return '午餐';
      if (type === 'dinner') return '晚餐';
      if (type === 'snack') return '點心/飲料';
      return '餐點';
  };

  const getMealOrder = (type: string) => {
      if (type === 'breakfast') return 1;
      if (type === 'lunch') return 2;
      if (type === 'dinner') return 3;
      if (type === 'snack') return 4;
      return 5;
  };

  // --- Grouping Logic for View ---
  const groupedByDay = mealPlans.reduce((acc, plan) => {
    const day = plan.mealType === 'snack' ? '行程通用' : (plan.dayLabel || '其他安排');
    if (!acc[day]) {
      acc[day] = [];
    }
    acc[day].push(plan);
    return acc;
  }, {} as Record<string, MealPlan[]>);

  const sortedDays = Object.keys(groupedByDay).sort((a, b) => {
      if (a === '行程通用') return -1;
      if (b === '行程通用') return 1;
      return a.localeCompare(b, 'zh-TW');
  });

  const groupPlansByMeal = (plans: MealPlan[]) => {
      const grouped = plans.reduce((acc, plan) => {
          if (!acc[plan.mealType]) acc[plan.mealType] = [];
          acc[plan.mealType].push(plan);
          return acc;
      }, {} as Record<string, MealPlan[]>);

      return Object.keys(grouped)
          .sort((a, b) => getMealOrder(a) - getMealOrder(b))
          .map(type => ({
              type: type as 'breakfast' | 'lunch' | 'dinner' | 'snack',
              plans: grouped[type]
          }));
  };

  // ... (Keep Modal Logic) ...
  const handleOpenAddModal = (dayLabel?: string, mealType?: any) => {
      setAddModalState({
          isOpen: true,
          context: dayLabel && mealType ? { dayLabel, mealType } : null
      });
      setPastedMenuText(''); 
  };

  const handleCloseAddModal = () => {
      if (isAnalyzing) return;
      setAddModalState({ isOpen: false, context: null });
  };

  // ... (Keep Logic Methods: handleAutoGenerate, handleBulkItinerary, handleManualAdd, handleBulkImageUpload, fileToBase64) ...
  // Re-inserting them condensed to save space, assuming they haven't changed logic significantly.
  // Actually I need to include them for the file to be valid.
  
  const handleAutoGenerate = async (planId: number | string, currentName: string) => {
    if (!currentName.trim()) { alert("請先輸入料理名稱！"); return; }
    setIsGeneratingRecipe(true);
    try {
        const result = await generateDishRecipe(currentName);
        const newGlobalIngredients: Ingredient[] = [];
        const newChecklistItems: CheckItem[] = [];
        const timestamp = Date.now();

        result.ingredients.forEach((ingName, idx) => {
             const existingIng = ingredients.find(ing => 
                ing.name === ingName || ing.name.includes(ingName) || ingName.includes(ing.name)
             );
             if (existingIng) {
                 newChecklistItems.push({
                     id: `auto-gen-${timestamp}-${idx}`,
                     name: existingIng.name,
                     quantity: existingIng.quantity,
                     checked: false,
                     owner: existingIng.owner ? { name: existingIng.owner.name, avatar: existingIng.owner.avatar } : null,
                     sourceIngredientId: existingIng.id
                 });
             } else {
                 const newId = timestamp + idx + 10000;
                 const newIng: Ingredient = {
                     id: newId,
                     name: ingName,
                     quantity: '',
                     selected: false,
                     usedInPlanId: typeof planId === 'number' ? planId : parseInt(String(planId)) || 0,
                     owner: null
                 };
                 newGlobalIngredients.push(newIng);
                 newChecklistItems.push({
                     id: `auto-gen-${timestamp}-${idx}`,
                     name: ingName,
                     quantity: '',
                     checked: false,
                     owner: null,
                     sourceIngredientId: newId
                 });
             }
        });
        if (newGlobalIngredients.length > 0) setIngredients(prev => [...prev, ...newGlobalIngredients]);
        if (planEditForm) { setPlanEditForm({ ...planEditForm, menuName: result.dishName, reason: result.description, steps: result.steps.join('\n'), videoQuery: result.videoQuery }); }
        setMealPlans(prev => prev.map(p => {
            if (String(p.id) === String(planId)) {
                return { ...p, menuName: result.dishName, reason: result.description, checklist: [...p.checklist, ...newChecklistItems], recipe: { steps: result.steps, videoQuery: result.videoQuery } };
            }
            return p;
        }));
    } catch (e) { console.error(e); alert("生成失敗"); } finally { setIsGeneratingRecipe(false); }
  };

  const handleBulkItinerary = async (input: string, type: 'text' | 'image') => {
    setIsAnalyzing(true);
    try {
        const plansData: ItineraryItem[] = await parseMenuItinerary(input, type);
        if (plansData.length === 0) { alert("無法辨識行程表"); return; }
        const newPlans: MealPlan[] = [];
        const allNewIngredients: Ingredient[] = [];
        let currentIdCounter = Date.now();
        const context = addModalState.context;
        plansData.forEach((planData, idx) => {
            const planId = currentIdCounter + idx * 100;
            const finalMealType = context ? context.mealType : planData.mealType;
            const isSnack = finalMealType === 'snack';
            const planIngs: Ingredient[] = isSnack ? [] : planData.ingredients.map((name, i) => ({ id: planId + i + 5000, name: name, quantity: '', selected: false, usedInPlanId: planId, owner: null }));
            if (planIngs.length > 0) allNewIngredients.push(...planIngs);
            let checklistItems: CheckItem[] = [];
            if (isSnack) { checklistItems = planData.ingredients.map((name, i) => ({ id: `snack-${planId}-${i}`, name: name, quantity: '', checked: false, owner: null, sourceIngredientId: null })); } else { checklistItems = planIngs.map(ing => ({ id: `auto-${ing.id}`, name: ing.name, quantity: '', checked: false, owner: null, sourceIngredientId: ing.id })); }
            const finalDayLabel = context ? context.dayLabel : (planData.dayLabel || '行程通用');
            newPlans.push({ id: planId, dayLabel: finalDayLabel, mealType: finalMealType, title: `${finalDayLabel} ${getMealLabel(finalMealType)}`, menuName: planData.menuName, reason: planData.reason || '匯入', checklist: checklistItems, notes: '', recipe: { steps: planData.steps, videoQuery: planData.videoQuery } });
        });
        if (allNewIngredients.length > 0) setIngredients(prev => [...prev, ...allNewIngredients]);
        setMealPlans(prev => [...prev, ...newPlans]); 
        handleCloseAddModal();
    } catch (error) { console.error(error); alert("分析失敗"); } finally { setIsAnalyzing(false); }
  };

  const handleManualAdd = () => {
      const context = addModalState.context;
      const newPlanId = Date.now();
      const newPlan: MealPlan = { id: newPlanId, dayLabel: context ? context.dayLabel : '未分類日期', mealType: context ? context.mealType : 'dinner', title: '自訂餐點', menuName: context?.mealType === 'snack' ? '新點心' : '新料理', reason: '點擊編輯按鈕來輸入詳細資訊...', checklist: [], notes: '', recipe: { steps: [], videoQuery: '' } };
      setMealPlans([newPlan, ...mealPlans]);
      setExpandedPlans(prev => ({ ...prev, [String(newPlanId)]: true }));
      handleCloseAddModal();
      startPlanEdit(newPlan);
  };

  const handleBulkImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const base64String = await fileToBase64(file);
      handleBulkItinerary(base64String, 'image');
  };
  const fileToBase64 = (file: File): Promise<string> => {
      return new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve((reader.result as string).split(',')[1]);
          reader.onerror = reject;
          reader.readAsDataURL(file);
      });
  };

  const toggleCheck = (planId: number | string, itemId: string) => {
    setMealPlans(prev => prev.map(plan => {
      if (String(plan.id) !== String(planId)) return plan;
      return {
        ...plan,
        checklist: plan.checklist.map(item => 
          item.id === itemId ? { ...item, checked: !item.checked } : item
        )
      };
    }));
  };

  // SYNCED CLAIM FUNCTION
  const handleClaimItem = (planId: number | string, itemId: string, assignedUser?: {id: string, name: string, avatar: string} | null) => {
      const plan = mealPlans.find(p => String(p.id) === String(planId));
      const item = plan?.checklist.find(i => i.id === itemId);
      if(!item) return;

      // Determine new owner
      let newOwner = item.owner;
      if (currentUser.isAdmin && assignedUser !== undefined) {
           newOwner = assignedUser ? { name: assignedUser.name, avatar: assignedUser.avatar } : null;
      } else if (currentUser.isAdmin) {
           if (item.owner) newOwner = null;
           else newOwner = { name: currentUser.name, avatar: currentUser.avatar };
      } else {
           // User Logic: Only modify if it's mine or unowned. 
           // NOTE: 'item.owner' is derived from ChecklistItem, which might be out of sync visually if we relied only on local state, but we render from linked ingredients.
           // However, for the update action we check existing state.
           if (item.owner?.name === currentUser.name) newOwner = null; // Unclaim (Match by name since ID isn't in CheckItem owner)
           else if (!item.owner) newOwner = { name: currentUser.name, avatar: currentUser.avatar };
           else return; // Locked
      }

      // Sync to Global Ingredients if linked
      if (item.sourceIngredientId) {
          setIngredients(prev => prev.map(ing => {
              if (String(ing.id) === String(item.sourceIngredientId)) {
                  // Map CheckItem Owner {name, avatar} back to Ingredient Owner {id, name, avatar}
                  // We need the ID.
                  if (newOwner === null) return { ...ing, owner: null };
                  // If assignedUser provided, use it.
                  if (assignedUser) return { ...ing, owner: assignedUser };
                  // If claiming for self
                  if (newOwner.name === currentUser.name) return { ...ing, owner: { id: currentUser.id, name: currentUser.name, avatar: currentUser.avatar }};
                  
                  // Fallback: If Admin toggled, we don't have the ID handy unless we look it up.
                  // For simplicity, if Admin toggled "on", it sets to Admin (current user).
                  return { ...ing, owner: { id: currentUser.id, name: currentUser.name, avatar: currentUser.avatar }}; 
              }
              return ing;
          }));
      }

      // Update Local MealPlan
      setMealPlans(prev => prev.map(p => {
          if (String(p.id) !== String(planId)) return p;
          return {
              ...p,
              checklist: p.checklist.map(i => i.id === itemId ? { ...i, owner: newOwner } : i)
          };
      }));
      
      if(assignedUser !== undefined) setAssigningItemId(null);
  };

  const handleUpdateItemQuantity = (planId: number | string, itemId: string, newQty: string) => {
      // Sync to Global Ingredients
      const plan = mealPlans.find(p => String(p.id) === String(planId));
      const item = plan?.checklist.find(i => i.id === itemId);
      
      if (item?.sourceIngredientId) {
          setIngredients(prev => prev.map(ing => 
              String(ing.id) === String(item.sourceIngredientId) ? { ...ing, quantity: newQty } : ing
          ));
      }

      // Update Local
      setMealPlans(prev => prev.map(p => {
          if (String(p.id) !== String(planId)) return p;
          return {
              ...p,
              checklist: p.checklist.map(i => i.id === itemId ? { ...i, quantity: newQty } : i)
          };
      }));
  };

  const updateNotes = (planId: number | string, notes: string) => {
    setMealPlans(prev => prev.map(plan => String(plan.id) === String(planId) ? { ...plan, notes } : plan));
  };

  const startEdit = (item: CheckItem) => {
    setEditingItemId(item.id);
    setEditName(item.name);
    // Use linked quantity if available
    if (item.sourceIngredientId) {
        const linked = ingredients.find(i => i.id === item.sourceIngredientId);
        setEditQuantity(linked?.quantity || item.quantity || '');
    } else {
        setEditQuantity(item.quantity || '');
    }
    setEditOwner(item.owner);
  };

  const saveEdit = (planId: number | string, itemId: string) => {
    // ... (Keep existing implementation logic, just ensure sync)
    if (!editName.trim()) return;
    const plan = mealPlans.find(p => String(p.id) === String(planId));
    const item = plan?.checklist.find(i => i.id === itemId);
    if (item?.sourceIngredientId) {
        setIngredients(prev => prev.map(ing => ing.id === item.sourceIngredientId ? { ...ing, quantity: editQuantity } : ing));
        if (item.owner && editOwner && JSON.stringify(item.owner) !== JSON.stringify(editOwner)) {
             const matchedMember = members.find(m => m.name === editOwner.name && m.avatar === editOwner.avatar);
             if (matchedMember) {
                 setIngredients(prev => prev.map(ing => ing.id === item.sourceIngredientId ? { ...ing, owner: { id: matchedMember.id, name: matchedMember.name, avatar: matchedMember.avatar } } : ing));
             } else if (!editOwner) {
                 setIngredients(prev => prev.map(ing => ing.id === item.sourceIngredientId ? { ...ing, owner: null } : ing));
             }
        }
    }
    setMealPlans(prev => prev.map(plan => {
      if (String(plan.id) !== String(planId)) return plan;
      return {
        ...plan,
        checklist: plan.checklist.map(item => {
            if (item.id === itemId) return { ...item, name: editName, quantity: editQuantity, owner: editOwner };
            return item;
        })
      };
    }));
    setEditingItemId(null); setEditOwner(null);
  };

  const addNewItem = (planId: number | string) => {
    const idStr = String(planId);
    const name = newItemNames[idStr];
    if (!name || !name.trim()) return;
    setMealPlans(prev => prev.map(plan => {
      if (String(plan.id) !== idStr) return plan;
      const newItem: CheckItem = { id: `custom-${Date.now()}`, name: name, quantity: '', checked: false, owner: null, sourceIngredientId: null };
      return { ...plan, checklist: [...plan.checklist, newItem] };
    }));
    setNewItemNames(prev => ({ ...prev, [idStr]: '' }));
  };

  const deleteItem = (planId: number | string, itemId: string) => {
    const plan = mealPlans.find(p => String(p.id) === String(planId));
    const itemToDelete = plan?.checklist.find(i => i.id === itemId);
    if (itemToDelete?.sourceIngredientId) {
         setIngredients(prev => prev.map(ing => String(ing.id) === String(itemToDelete.sourceIngredientId) ? { ...ing, usedInPlanId: null } : ing));
    }
    setMealPlans(prev => prev.map(plan => {
        if (String(plan.id) !== String(planId)) return plan;
        return { ...plan, checklist: plan.checklist.filter(item => item.id !== itemId) };
    }));
  };

  const startPlanEdit = (plan: MealPlan) => {
    setEditingPlanId(String(plan.id));
    setPlanEditForm({ menuName: plan.menuName, reason: plan.reason, steps: plan.recipe.steps.join('\n'), videoQuery: plan.recipe.videoQuery || plan.menuName, mealType: plan.mealType });
  };

  const savePlanEdit = (planId: number | string) => {
    if (!planEditForm) return;
    setMealPlans(prev => prev.map(plan => {
      if (String(plan.id) !== String(planId)) return plan;
      const newMealType = planEditForm.mealType;
      const typeChanged = newMealType !== plan.mealType;
      let newChecklist = plan.checklist;
      if (typeChanged && newMealType === 'snack') { newChecklist = plan.checklist.map(item => ({ ...item, sourceIngredientId: null })); }
      return { ...plan, menuName: planEditForm.menuName, reason: planEditForm.reason, mealType: newMealType, dayLabel: newMealType === 'snack' ? '行程通用' : plan.dayLabel, checklist: newChecklist, recipe: { ...plan.recipe, steps: planEditForm.steps.split('\n').filter(s => s.trim()), videoQuery: planEditForm.videoQuery } };
    }));
    setEditingPlanId(null); setPlanEditForm(null);
  };

  const cancelPlanEdit = () => { setEditingPlanId(null); setPlanEditForm(null); };

  const deletePlan = (planId: number | string, isNewItem: boolean = false) => {
      setMealPlans(prev => prev.filter(p => String(p.id) !== String(planId)));
      setIngredients(prev => prev.map(ing => String(ing.usedInPlanId) === String(planId) ? { ...ing, usedInPlanId: null } : ing));
      if (String(editingPlanId) === String(planId)) { setEditingPlanId(null); setPlanEditForm(null); }
  }

  const renderPlanCard = (plan: MealPlan) => {
    const isExpanded = expandedPlans[String(plan.id)];
    const isPlanEditing = String(editingPlanId) === String(plan.id);
    const isSnack = plan.mealType === 'snack';
    const isNewItem = plan.menuName === '新點心' || plan.menuName === '新料理';
    const videoQuery = plan.recipe?.videoQuery || plan.menuName;

    // Calculate Progress for Dish
    // It's ready if: 
    // 1. It has a local owner (custom item claimed)
    // 2. OR it is linked to a global ingredient that has an owner
    // 3. OR it is checked off
    const totalItems = plan.checklist.length;
    const readyItems = plan.checklist.filter(item => {
        if(item.checked) return true;
        if(item.owner) return true;
        if(item.sourceIngredientId) {
            const ing = ingredients.find(i => i.id === item.sourceIngredientId);
            return !!ing?.owner;
        }
        return false;
    }).length;
    const progress = totalItems > 0 ? Math.round((readyItems / totalItems) * 100) : 0;

    return (
        <div key={plan.id} className="bg-[#FFFEF5] rounded-3xl shadow-md overflow-hidden border border-[#E0D8C0] transition-all relative">
            <div className={`flex items-stretch min-h-[72px] transition-colors ${isExpanded ? 'bg-[#E76F51]/10 border-b border-[#E0D8C0]' : 'hover:bg-[#F9F7F2]'}`}>
                <div className="flex-1 p-4 flex items-center gap-3 cursor-pointer select-none" onClick={() => toggleExpand(plan.id)}>
                    <div className="min-w-0 pr-2 flex-1"> 
                        {isPlanEditing ? ( <span className="text-xs text-[#8C7B65] font-bold">正在編輯...</span> ) : ( 
                            <div className="flex flex-col gap-1">
                                <h2 className={`font-bold text-[#5D4632] leading-tight ${isExpanded ? 'text-lg' : 'text-base'}`}>
                                    {plan.menuName}
                                </h2>
                                {!isExpanded && plan.reason && ( <p className="text-xs text-[#8C7B65] truncate opacity-70">{plan.reason}</p> )}
                            </div>
                        )}
                    </div>
                    {/* Dish Progress Pill */}
                    {!isPlanEditing && totalItems > 0 && (
                        <div className={`text-[10px] font-bold px-2 py-1 rounded-full border flex items-center gap-1 ${progress === 100 ? 'bg-[#7BC64F] text-white border-[#7BC64F]' : 'bg-white text-[#8C7B65] border-[#E0D8C0]'}`}>
                            <ShoppingBag size={10} /> {readyItems}/{totalItems}
                        </div>
                    )}
                </div>
                <div className="flex items-center gap-2 pr-4 pl-2 border-l border-transparent">
                    <button type="button" onClick={(e) => { e.stopPropagation(); deletePlan(plan.id, isNewItem); }} className={`w-10 h-10 flex items-center justify-center text-white rounded-full border-2 active:scale-90 transition-all shadow-md z-20 cursor-pointer bg-[#E0D8C0] hover:bg-[#E76F51] border-[#E0D8C0] hover:border-[#E76F51]`} title="刪除"><Trash2 size={18} fill="white" className="pointer-events-none" /></button>
                    <button onClick={(e) => { e.stopPropagation(); toggleExpand(plan.id); }} className="w-10 h-10 flex items-center justify-center text-[#8C7B65] rounded-full hover:bg-black/5 transition-colors cursor-pointer">{isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}</button>
                </div>
            </div>

            {isExpanded && (
            <div className="animate-fade-in relative">
                {isPlanEditing && planEditForm ? (
                <div className="p-5 bg-white border-b border-[#E0D8C0] space-y-4">
                    {/* ... (Plan Edit Form, same as before) ... */}
                    <div className="flex justify-between items-center mb-2"><h4 className="font-bold text-[#5D4632] flex items-center gap-2 text-sm"><Edit3 size={16} className="text-[#E76F51]" /> 編輯資訊</h4></div>
                    <div><label className="block text-xs font-bold text-[#8C7B65] mb-1">名稱</label><div className="flex gap-2"><input type="text" value={planEditForm.menuName} onChange={(e) => setPlanEditForm({...planEditForm, menuName: e.target.value})} className="flex-1 bg-[#F9F7F2] border-2 border-[#E0D8C0] rounded-xl px-3 py-2 text-sm text-[#5D4632] focus:outline-none focus:border-[#E76F51]"/>{!isSnack && ( <button onClick={() => handleAutoGenerate(plan.id, planEditForm.menuName)} disabled={isGeneratingRecipe || !planEditForm.menuName.trim()} className={`px-3 py-2 rounded-xl text-xs font-bold text-white shadow-sm flex items-center gap-1 transition-all active:scale-95 whitespace-nowrap ${isGeneratingRecipe ? 'bg-[#E0D8C0] cursor-wait' : 'bg-gradient-to-r from-[#F4A261] to-[#E76F51] hover:opacity-90'}`}>{isGeneratingRecipe ? <Loader2 size={16} className="animate-spin" /> : <Wand2 size={16} />}{isGeneratingRecipe ? '生成中...' : 'AI 自動填寫'}</button> )}</div></div>
                    <div><label className="block text-xs font-bold text-[#8C7B65] mb-1">餐點類型</label><div className="flex gap-2">{(['breakfast', 'lunch', 'dinner', 'snack'] as const).map(type => ( <button key={type} onClick={() => setPlanEditForm({...planEditForm, mealType: type})} className={`flex-1 py-2 text-xs font-bold rounded-lg border ${planEditForm.mealType === type ? 'bg-[#E76F51] text-white border-[#E76F51]' : 'bg-white text-[#8C7B65] border-[#E0D8C0]'}`}>{getMealLabel(type)}</button> ))}</div></div>
                    <div><label className="block text-xs font-bold text-[#8C7B65] mb-1">備註/原因</label><textarea value={planEditForm.reason} onChange={(e) => setPlanEditForm({...planEditForm, reason: e.target.value})} className="w-full bg-[#F9F7F2] border-2 border-[#E0D8C0] rounded-xl px-3 py-2 text-sm text-[#5D4632] focus:outline-none focus:border-[#E76F51] h-20 resize-none"/></div>
                    {!isSnack && ( <><div><label className="block text-xs font-bold text-[#8C7B65] mb-1">YouTube 關鍵字</label><input type="text" value={planEditForm.videoQuery} onChange={(e) => setPlanEditForm({...planEditForm, videoQuery: e.target.value})} className="w-full bg-[#F9F7F2] border-2 border-[#E0D8C0] rounded-xl px-3 py-2 text-sm text-[#5D4632] focus:outline-none focus:border-[#E76F51]"/></div><div><label className="block text-xs font-bold text-[#8C7B65] mb-1">步驟</label><textarea value={planEditForm.steps} onChange={(e) => setPlanEditForm({...planEditForm, steps: e.target.value})} className="w-full bg-[#F9F7F2] border-2 border-[#E0D8C0] rounded-xl px-3 py-2 text-sm text-[#5D4632] focus:outline-none focus:border-[#E76F51] h-32"/></div></> )}
                    <div className="flex justify-between items-center pt-2"><button onClick={() => deletePlan(plan.id, isNewItem)} className="px-4 py-2 rounded-full text-xs font-bold text-white bg-[#E76F51] hover:bg-[#D65F41] flex items-center gap-1 transition-colors shadow-sm active:scale-95"><Trash2 size={14} /> 刪除</button><div className="flex gap-2 ml-auto"><button onClick={cancelPlanEdit} className="px-4 py-2 rounded-full text-xs font-bold text-[#8C7B65] hover:bg-[#F2F7E6]">取消</button><button onClick={() => savePlanEdit(plan.id)} className="px-5 py-2 rounded-full text-xs font-bold bg-[#7BC64F] text-white hover:bg-[#5da135] shadow-sm flex items-center gap-1"><Save size={14} /> 儲存</button></div></div>
                </div>
                ) : (
                    <div className="absolute top-4 right-4 z-10">
                        <button onClick={() => startPlanEdit(plan)} className="p-2 bg-white/80 hover:bg-[#F2CC8F] hover:text-[#5D4632] text-[#8C7B65] rounded-full shadow-sm border border-[#E0D8C0] transition-colors active:scale-95"><Edit3 size={16} /></button>
                    </div>
                )}

                <div className="p-5 border-b border-[#E0D8C0] bg-white/50">
                    <h4 className="font-bold text-[#5D4632] mb-3 flex items-center gap-2 text-sm">
                        <Check size={16} className="text-[#7BC64F]" />
                        {isSnack ? '清單內容' : '採購 & 準備清單'}
                        {!isSnack && plan.checklist.some(i => i.sourceIngredientId) && (
                            <span className="text-[10px] bg-[#E9F5D8] text-[#5D4632] px-2 py-0.5 rounded-full ml-auto font-normal">已連動共享冰箱</span>
                        )}
                    </h4>
                    <div className="space-y-2">
                        {plan.checklist.map((item) => {
                            // Link Logic
                            const linkedIng = item.sourceIngredientId 
                                ? ingredients.find(i => String(i.id) === String(item.sourceIngredientId)) 
                                : null;
                            const displayOwner = linkedIng ? linkedIng.owner : item.owner;
                            const displayQuantity = linkedIng ? (linkedIng.quantity || '') : (item.quantity || '');
                            const isMine = displayOwner?.name === currentUser.name;
                            const isUserLocked = !!displayOwner && !isMine && !currentUser.isAdmin;
                            const isAssigning = String(assigningItemId) === String(item.id);

                            return (
                            <div key={item.id} className={`group flex flex-col p-3 rounded-2xl transition-all border-2 ${item.checked ? 'bg-[#E0D8C0]/20 border-transparent' : editingItemId === item.id ? 'bg-white border-[#F4A261] shadow-md' : 'bg-white border-[#E0D8C0]'}`}>
                                <div className="flex items-center gap-2" onClick={() => !isAssigning && toggleCheck(plan.id, item.id)}>
                                    {/* Left: Avatar Circle / Checkbox */}
                                    <div className={`w-10 h-10 rounded-full border-2 flex items-center justify-center transition-all flex-shrink-0 relative overflow-hidden bg-white ${item.checked ? 'border-[#E0D8C0]' : 'border-[#E0D8C0]'}`}>
                                        {item.checked ? (
                                            <Check size={20} className="text-[#8C7B65]" />
                                        ) : displayOwner ? (
                                            <span className="text-xl">{displayOwner.avatar}</span>
                                        ) : (
                                            <ShoppingBag size={18} className="text-[#E76F51]" />
                                        )}
                                    </div>

                                    {/* Middle: Name & Status */}
                                    <div className="flex-1 min-w-0">
                                        {editingItemId === item.id ? (
                                            <input type="text" value={editName} onChange={(e) => setEditName(e.target.value)} className="w-full bg-[#F9F7F2] border border-[#E0D8C0] rounded-lg px-2 py-1.5 text-sm" autoFocus/>
                                        ) : (
                                            <div className="flex flex-col justify-center">
                                                <div className="flex items-center gap-2">
                                                    <span className={`font-bold text-sm ${item.checked ? 'text-[#8C7B65] line-through' : 'text-[#5D4632]'}`}>{item.name}</span>
                                                </div>
                                                <div className="flex items-center gap-1 mt-0.5">
                                                    {displayOwner ? (
                                                        <span className={`text-[10px] px-2 py-0.5 rounded-full flex items-center gap-1 truncate ${isMine ? 'bg-[#E9F5D8] text-[#5D4632]' : 'bg-[#F9F7F2] text-[#8C7B65]'} ${item.checked ? 'opacity-50' : ''}`}>
                                                            {displayOwner.name}
                                                        </span>
                                                    ) : (
                                                        <span className={`text-[10px] text-[#E76F51] bg-[#E76F51]/10 px-2 py-0.5 rounded-full font-bold flex items-center gap-1 whitespace-nowrap ${item.checked ? 'opacity-50' : ''}`}>
                                                            需採買
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {/* Right: Actions */}
                                    <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                                        {editingItemId === item.id ? (
                                            <div className="flex gap-1">
                                                <button onClick={() => saveEdit(plan.id, item.id)} className="p-2 bg-[#7BC64F] text-white rounded-full shadow-sm"><Check size={16}/></button>
                                                <button onClick={() => setEditingItemId(null)} className="p-2 text-[#8C7B65] hover:bg-[#E0D8C0] rounded-full"><X size={16}/></button>
                                            </div>
                                        ) : (
                                            <>
                                                {/* Claim/Assign Button */}
                                                {isAssigning ? (
                                                    <div className="absolute right-2 bg-white shadow-xl border-2 border-[#E76F51] rounded-2xl p-2 z-20 flex gap-2 items-center animate-fade-in max-w-[250px] overflow-x-auto" onClick={e => e.stopPropagation()}>
                                                        <button onClick={() => handleClaimItem(plan.id, item.id, null)} className="w-8 h-8 rounded-full bg-[#E0D8C0] text-white flex items-center justify-center shrink-0 hover:bg-[#E76F51]" title="設為需採買"><ShoppingBag size={14} /></button>
                                                        {members.map(m => ( <button key={m.id} onClick={() => handleClaimItem(plan.id, item.id, { id: m.id, name: m.name, avatar: m.avatar })} className="w-8 h-8 rounded-full bg-[#E9F5D8] border border-[#7BC64F] text-sm shrink-0 hover:scale-110 transition-transform" title={`指派給 ${m.name}`}>{m.avatar}</button> ))}
                                                        <button onClick={() => setAssigningItemId(null)} className="ml-1 text-[#8C7B65]"><X size={16}/></button>
                                                    </div>
                                                ) : (
                                                    <button 
                                                        onClick={(e) => { 
                                                            e.stopPropagation(); 
                                                            if (currentUser.isAdmin) { setAssigningItemId(String(item.id)); } else { handleClaimItem(plan.id, item.id); } 
                                                        }} 
                                                        disabled={isUserLocked || item.checked} 
                                                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all shadow-sm active:scale-95 whitespace-nowrap pointer-events-auto ${
                                                            item.checked ? 'hidden' :
                                                            isMine ? 'bg-white border-2 border-[#7BC64F] text-[#7BC64F] hover:bg-[#7BC64F]/10' : 
                                                            (displayOwner && currentUser.isAdmin) ? 'bg-[#E76F51] text-white hover:bg-[#D65F41]' : 
                                                            isUserLocked ? 'bg-[#E0D8C0] text-white cursor-not-allowed' : 
                                                            'bg-[#F4A261] text-white hover:bg-[#E76F51]'
                                                        }`}
                                                    >
                                                        {isMine ? '取消' : (displayOwner && currentUser.isAdmin) ? '指派' : isUserLocked ? '鎖定' : '我帶'}
                                                    </button>
                                                )}

                                                <input 
                                                    type="text" 
                                                    placeholder="份量" 
                                                    value={displayQuantity} 
                                                    onChange={(e) => handleUpdateItemQuantity(plan.id, item.id, e.target.value)}
                                                    className="w-14 bg-[#F9F7F2] border border-[#E0D8C0] rounded-lg px-2 py-1.5 text-xs text-[#5D4632] text-center focus:border-[#7BC64F] focus:outline-none placeholder:text-[#E0D8C0]"
                                                    disabled={item.checked}
                                                />

                                                {(!item.checked || currentUser.isAdmin) && ( 
                                                    <button onClick={() => startEdit(item)} className="p-1.5 text-[#E0D8C0] hover:text-[#8C7B65] hover:bg-[#E0D8C0]/30 rounded-full transition-colors"><PenSquare size={16} /></button> 
                                                )}
                                                <button onClick={(e) => { e.stopPropagation(); deleteItem(plan.id, item.id); }} className={`p-1.5 rounded-full transition-all text-[#E0D8C0] hover:text-[#E76F51] hover:bg-[#E76F51]/10`} title="刪除">
                                                    <Trash2 size={16} />
                                                </button> 
                                            </>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )})}
                        <div className="flex gap-2 mt-3 pt-2 border-t border-[#E0D8C0] border-dashed">
                            <input type="text" value={newItemNames[String(plan.id)] || ''} onChange={(e) => setNewItemNames(prev => ({...prev, [String(plan.id)]: e.target.value}))} placeholder={isSnack ? "新增零食或飲料..." : "新增其他食材或備註..."} className="flex-1 bg-[#F9F7F2] border-2 border-[#E0D8C0] rounded-full px-4 py-2 text-sm focus:outline-none focus:border-[#F4A261] text-[#5D4632]" onKeyDown={(e) => e.key === 'Enter' && addNewItem(plan.id)}/>
                            <button onClick={() => addNewItem(plan.id)} className="bg-[#F4A261] text-white p-2 rounded-full hover:bg-[#E76F51] active:scale-95 transition-all"><Plus size={20} /></button>
                        </div>
                    </div>
                </div>

                {/* ... (Keep Notes and Steps) ... */}
                {!isPlanEditing && !isSnack && ( <>
                    <div className="p-5 border-b border-[#E0D8C0]">
                        <h4 className="font-bold text-[#5D4632] mb-3 flex items-center gap-2 text-sm"><StickyNote size={16} className="text-[#F2CC8F]" />主廚筆記</h4>
                        <textarea value={plan.notes} onChange={(e) => updateNotes(plan.id, e.target.value)} placeholder="寫下備料提醒..." className="w-full h-20 bg-[#FFF] border-2 border-[#E0D8C0] rounded-2xl p-3 text-sm text-[#5D4632] focus:outline-none focus:border-[#F2CC8F] resize-none"/>
                    </div>
                    <div className="p-5">
                        <h4 className="font-bold text-[#5D4632] mb-4 flex items-center gap-2 text-sm">
                            <Flame size={16} className="text-[#E76F51]" />料理步驟
                            {videoQuery && ( <a href={`https://www.youtube.com/results?search_query=${encodeURIComponent(videoQuery)}`} target="_blank" rel="noopener noreferrer" className="ml-auto flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#FF0000] text-white text-xs font-bold hover:bg-[#CC0000] transition-colors shadow-sm"><Youtube size={14} fill="currentColor" /> 教學影片</a> )}
                        </h4>
                        <div className="space-y-4">
                        {plan.recipe?.steps && plan.recipe.steps.length > 0 ? ( plan.recipe.steps.map((step, idx) => ( <div key={idx} className="flex gap-4 text-[#5D4632]"><span className="flex-shrink-0 w-6 h-6 bg-[#F2CC8F] text-[#5D4632] rounded-full flex items-center justify-center text-xs font-bold mt-0.5">{idx + 1}</span><span className="leading-relaxed text-sm">{step}</span></div> )) ) : ( <div className="text-[#8C7B65] text-sm italic">沒有詳細步驟資料。<button onClick={() => startPlanEdit(plan)} className="underline text-[#E76F51] ml-1">點擊編輯新增</button></div> )}
                        </div>
                    </div>
                </> )}
            </div>
            )}
        </div>
    );
  };

  return (
    <div className="space-y-4 animate-fade-in pb-12">
        {/* ... (Keep Header) ... */}
      <div className="bg-[#FFFEF5] p-5 rounded-3xl shadow-sm border border-[#E0D8C0]">
        <div className="flex justify-between items-start">
            <div><h3 className="font-bold text-[#5D4632] flex items-center gap-2 text-lg"><BookOpen size={20} className="text-[#E76F51]" />島民食譜</h3><p className="text-xs text-[#8C7B65] mt-1">這裡存放所有計畫中的美味料理</p></div>
            <div className="flex gap-2">
                <button onClick={() => handleOpenAddModal('行程通用', 'snack')} disabled={isAnalyzing} className="bg-[#2A9D8F] text-white px-4 py-2 rounded-full font-bold shadow-sm hover:bg-[#21867a] active:scale-95 transition-all flex items-center gap-2 text-sm"><IceCream size={16} /><span className="hidden sm:inline">新增零食飲料</span></button>
                <button onClick={() => handleOpenAddModal()} disabled={isAnalyzing} className="bg-[#E76F51] text-white px-4 py-2 rounded-full font-bold shadow-sm hover:bg-[#D65F41] active:scale-95 transition-all flex items-center gap-2 text-sm">{isAnalyzing ? <Loader2 size={16} className="animate-spin"/> : <Plus size={16} />}{isAnalyzing ? '分析中...' : '新增料理'}</button>
            </div>
        </div>
      </div>
      {/* ... (Keep Add Modal) ... */}
      {addModalState.isOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
            <div className="bg-[#E9F5D8] w-full max-w-lg rounded-[32px] shadow-2xl overflow-hidden border-4 border-[#E0D8C0] flex flex-col max-h-[90vh]">
                <div className="bg-[#7BC64F] p-4 flex justify-between items-center text-white shrink-0">
                    <h3 className="font-bold text-lg flex items-center gap-2">{addModalState.context ? ( <>{getMealIcon(addModalState.context.mealType)} 新增：{addModalState.context.dayLabel} {getMealLabel(addModalState.context.mealType)}</> ) : ( <><Sparkles size={20} /> 新增/匯入菜單</> )}</h3><button onClick={handleCloseAddModal} className="p-1 hover:bg-white/20 rounded-full transition-colors"><X size={24} /></button>
                </div>
                <div className="p-5 overflow-y-auto">
                    <div className="mb-6 pb-6 border-b border-[#7BC64F]/20">
                        <h4 className="font-bold text-[#5D4632] text-sm mb-3 flex items-center gap-2"><FileText size={16} className="text-[#F4A261]"/>{addModalState.context?.mealType === 'snack' ? '貼上零食/飲料清單' : '貼上菜單內容'}</h4>
                        <textarea value={pastedMenuText} onChange={(e) => setPastedMenuText(e.target.value)} placeholder={addModalState.context?.mealType === 'snack' ? "例如：可樂 6罐、洋芋片 3包、科學麵..." : "例如：\n第一天晚餐：飯湯、水餃\n第二天早餐：蛋餅..."} className="w-full h-24 bg-white border border-[#E0D8C0] rounded-xl p-3 text-sm text-[#5D4632] mb-3 focus:outline-none focus:border-[#7BC64F]"/>
                        <div className="flex gap-2"><button onClick={() => handleBulkItinerary(pastedMenuText, 'text')} disabled={!pastedMenuText.trim() || isAnalyzing} className="flex-1 bg-[#2A9D8F] text-white py-3 rounded-xl font-bold text-sm hover:bg-[#21867a] disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center gap-2 shadow-sm active:scale-95 transition-all">{isAnalyzing ? <Loader2 size={16} className="animate-spin"/> : <Sparkles size={16} />}{isAnalyzing ? '分析中...' : 'AI 解析匯入'}</button></div>
                    </div>
                    <div className="mb-6 pb-6 border-b border-[#7BC64F]/20">
                        <h4 className="font-bold text-[#5D4632] text-sm mb-3 flex items-center gap-2"><ImageIcon size={16} className="text-[#F4A261]"/>{addModalState.context?.mealType === 'snack' ? '拍照辨識零食' : '拍照辨識菜單'}</h4>
                        <input type="file" accept="image/*" className="hidden" ref={bulkGalleryRef} onChange={handleBulkImageUpload}/>
                         <input type="file" accept="image/*" capture="environment" className="hidden" ref={bulkCameraRef} onChange={handleBulkImageUpload}/>
                        <div className="grid grid-cols-2 gap-3">
                            <button onClick={() => bulkCameraRef.current?.click()} disabled={isAnalyzing} className="flex flex-col items-center justify-center gap-2 bg-white p-4 rounded-xl border border-[#E0D8C0] hover:border-[#7BC64F] transition-all active:scale-95 shadow-sm group disabled:opacity-50"><Camera size={24} className="text-[#7BC64F] group-hover:scale-110 transition-transform" /><span className="text-xs font-bold text-[#5D4632]">拍實物/菜單</span></button>
                            <button onClick={() => bulkGalleryRef.current?.click()} disabled={isAnalyzing} className="flex flex-col items-center justify-center gap-2 bg-white p-4 rounded-xl border border-[#E0D8C0] hover:border-[#7BC64F] transition-all active:scale-95 shadow-sm group disabled:opacity-50"><ImageIcon size={24} className="text-[#F4A261] group-hover:scale-110 transition-transform" /><span className="text-xs font-bold text-[#5D4632]">上傳圖片</span></button>
                        </div>
                    </div>
                    <div>
                        <h4 className="font-bold text-[#5D4632] text-sm mb-3 flex items-center gap-2 opacity-70">或...</h4>
                        <button onClick={handleManualAdd} className="w-full bg-white text-[#5D4632] py-3 rounded-xl font-bold border-2 border-dashed border-[#E0D8C0] hover:border-[#7BC64F] hover:text-[#7BC64F] transition-all flex items-center justify-center gap-2 text-sm active:scale-95"><PenSquare size={16} /> 手動建立空白食譜</button>
                    </div>
                </div>
            </div>
        </div>
      )}
      {mealPlans.length === 0 && ( <div className="text-center py-10 opacity-60"><div className="w-16 h-16 bg-[#E0D8C0] rounded-full mx-auto mb-2 flex items-center justify-center text-white"><BookOpen size={32} /></div><p className="text-[#8C7B65] text-sm">目前沒有食譜，請按右上角新增。</p></div> )}
      {sortedDays.map(dayLabel => {
          const mealGroups = groupPlansByMeal(groupedByDay[dayLabel]);
          const isGeneral = dayLabel === '行程通用';
          return (
            <div key={dayLabel} className="space-y-4">
                <div className="flex items-center gap-2 px-2 mt-6 mb-2">
                     <div className={`px-4 py-1.5 rounded-full text-sm font-bold shadow-sm flex items-center gap-2 ${isGeneral ? 'bg-[#E76F51] text-white' : 'bg-[#5D4632] text-[#F2CC8F]'}`}>{isGeneral ? <Package size={14}/> : <CalendarDays size={14} />}{dayLabel}</div>
                     <div className={`h-0.5 flex-1 rounded-full ${isGeneral ? 'bg-[#E76F51]/30' : 'bg-[#E0D8C0]/50'}`}></div>
                </div>
                {mealGroups.map(group => (
                    <div key={group.type} className="pl-2">
                         <div className="sticky top-0 z-0 flex items-center gap-2 mb-3 ml-2 group/header">
                             <div className={`p-2 rounded-full border-2 ${group.type === 'breakfast' ? 'bg-[#F4A261] border-[#F4A261] text-white' : group.type === 'lunch' ? 'bg-[#F2CC8F] border-[#F2CC8F] text-[#5D4632]' : group.type === 'snack' ? 'bg-[#E76F51] border-[#E76F51] text-white' : 'bg-[#2A9D8F] border-[#2A9D8F] text-white'}`}>{getMealIcon(group.type)}</div>
                             <span className="text-sm font-bold text-[#8C7B65]">{getMealLabel(group.type)}</span>
                             <button onClick={() => handleOpenAddModal(dayLabel, group.type)} className="ml-2 p-1.5 rounded-full bg-white border border-[#E0D8C0] text-[#8C7B65] hover:bg-[#7BC64F] hover:text-white hover:border-[#7BC64F] transition-all shadow-sm active:scale-90" title={`新增${getMealLabel(group.type)}`}><Plus size={14} /></button>
                         </div>
                         <div className="space-y-3 pl-4 border-l-2 border-[#E0D8C0]/40 ml-5 pb-2">{group.plans.map((plan) => renderPlanCard(plan))}</div>
                    </div>
                ))}
            </div>
          );
      })}
    </div>
  );
};

export default MenuSection;