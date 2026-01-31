import React, { useState, useRef } from 'react';
import { BookOpen, Youtube, Flame, Coffee, Sun, Moon, Clock, Check, Plus, Trash2, StickyNote, PenSquare, X, ChevronDown, ChevronUp, ShoppingBag, Edit3, Save, Camera, Image as ImageIcon, Loader2, Sparkles, FileText, CalendarDays, Wand2 } from 'lucide-react';
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
  const [expandedPlans, setExpandedPlans] = useState<Record<number, boolean>>(() => {
    if (mealPlans.length > 0) {
      return { [mealPlans[0].id]: true };
    }
    return {};
  });

  // UI State
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isGeneratingRecipe, setIsGeneratingRecipe] = useState(false);
  const [pastedMenuText, setPastedMenuText] = useState('');
  
  // Checklist Item Editing
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editOwner, setEditOwner] = useState<{name: string, avatar: string} | null>(null);
  const [newItemNames, setNewItemNames] = useState<Record<number, string>>({});

  // Plan Details Editing
  const [editingPlanId, setEditingPlanId] = useState<number | null>(null);
  const [planEditForm, setPlanEditForm] = useState<{
    menuName: string;
    reason: string;
    steps: string;
  } | null>(null);

  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const bulkCameraRef = useRef<HTMLInputElement>(null);
  const bulkGalleryRef = useRef<HTMLInputElement>(null);

  const toggleExpand = (planId: number) => {
    setExpandedPlans(prev => ({
      ...prev,
      [planId]: !prev[planId]
    }));
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
      if (type === 'breakfast') return '早餐';
      if (type === 'lunch') return '午餐';
      if (type === 'dinner') return '晚餐';
      return '餐點';
  };

  const getMealOrder = (type: string) => {
      if (type === 'breakfast') return 1;
      if (type === 'lunch') return 2;
      if (type === 'dinner') return 3;
      return 4;
  };

  // --- Grouping Logic for View ---
  // 1. Group by Day
  const groupedByDay = mealPlans.reduce((acc, plan) => {
    const day = plan.dayLabel || '其他安排';
    if (!acc[day]) {
      acc[day] = [];
    }
    acc[day].push(plan);
    return acc;
  }, {} as Record<string, MealPlan[]>);

  // 2. Sort Days
  const sortedDays = Object.keys(groupedByDay).sort((a, b) => a.localeCompare(b, 'zh-TW'));

  // 3. Helper to Group by Meal Type within a Day
  const groupPlansByMeal = (plans: MealPlan[]) => {
      const grouped = plans.reduce((acc, plan) => {
          if (!acc[plan.mealType]) acc[plan.mealType] = [];
          acc[plan.mealType].push(plan);
          return acc;
      }, {} as Record<string, MealPlan[]>);

      // Sort keys: breakfast -> lunch -> dinner
      return Object.keys(grouped)
          .sort((a, b) => getMealOrder(a) - getMealOrder(b))
          .map(type => ({
              type: type as 'breakfast' | 'lunch' | 'dinner',
              plans: grouped[type]
          }));
  };

  // --- Auto Generate Dish Logic ---
  const handleAutoGenerate = async (planId: number, currentName: string) => {
    if (!currentName.trim()) {
        alert("請先輸入料理名稱！");
        return;
    }

    setIsGeneratingRecipe(true);

    try {
        const result = await generateDishRecipe(currentName);
        
        // 1. Process Ingredients (The most important part)
        const newGlobalIngredients: Ingredient[] = [];
        const newChecklistItems: CheckItem[] = [];
        const timestamp = Date.now();

        result.ingredients.forEach((ingName, idx) => {
             // Search for existing ingredient in the global fridge (fuzzy match)
             // Case 1: Exact Match or simple inclusion
             const existingIng = ingredients.find(ing => 
                ing.name === ingName || 
                ing.name.includes(ingName) || 
                ingName.includes(ing.name)
             );

             // Case 2: New ingredient created in this very loop (to avoid duplicates)
             const newlyCreatedIng = newGlobalIngredients.find(ing => ing.name === ingName);

             if (existingIng) {
                 // Found in fridge -> Link it
                 newChecklistItems.push({
                     id: `auto-gen-${timestamp}-${idx}`,
                     name: existingIng.name,
                     checked: false,
                     owner: { name: existingIng.owner.name, avatar: existingIng.owner.avatar },
                     sourceIngredientId: existingIng.id
                 });
             } else if (newlyCreatedIng) {
                 // Already added to queue -> Link it
                 newChecklistItems.push({
                     id: `auto-gen-${timestamp}-${idx}`,
                     name: newlyCreatedIng.name,
                     checked: false,
                     owner: { name: newlyCreatedIng.owner.name, avatar: newlyCreatedIng.owner.avatar },
                     sourceIngredientId: newlyCreatedIng.id
                 });
             } else {
                 // Not found -> Create NEW Ingredient in Fridge
                 const newId = timestamp + idx + 10000;
                 const newIng: Ingredient = {
                     id: newId,
                     name: ingName,
                     selected: false,
                     usedInPlanId: planId, // Mark as used by this plan
                     owner: { id: currentUser.id, name: currentUser.name, avatar: currentUser.avatar }
                 };
                 newGlobalIngredients.push(newIng);

                 // Link checklist item to this new ingredient
                 newChecklistItems.push({
                     id: `auto-gen-${timestamp}-${idx}`,
                     name: ingName,
                     checked: false,
                     owner: { name: currentUser.name, avatar: currentUser.avatar },
                     sourceIngredientId: newId
                 });
             }
        });

        // 2. Update Global Ingredients State (Add the new ones)
        if (newGlobalIngredients.length > 0) {
            setIngredients(prev => [...prev, ...newGlobalIngredients]);
        }

        // 3. Update Local Form State (Fill inputs)
        if (planEditForm) {
            setPlanEditForm({
                ...planEditForm,
                menuName: result.dishName,
                reason: result.description,
                steps: result.steps.join('\n')
            });
        }

        // 4. Update the actual Meal Plan (Append items to checklist)
        setMealPlans(prev => prev.map(p => {
            if (p.id === planId) {
                // Combine existing checklist with new AI items (avoiding exact duplicates by name if possible, but keep simple for now)
                // Filter out new items if they already exist in current checklist
                const uniqueNewItems = newChecklistItems.filter(newItem => 
                    !p.checklist.some(existing => existing.name === newItem.name)
                );

                return {
                    ...p,
                    menuName: result.dishName,
                    reason: result.description,
                    checklist: [...p.checklist, ...uniqueNewItems],
                    recipe: {
                        steps: result.steps,
                        videoQuery: result.videoQuery
                    }
                };
            }
            return p;
        }));

    } catch (e) {
        console.error(e);
        alert("生成失敗，請稍後再試");
    } finally {
        setIsGeneratingRecipe(false);
    }
  };


  // --- Bulk Menu Logic (Itinerary) ---

  const handleBulkItinerary = async (input: string, type: 'text' | 'image') => {
    setIsAnalyzing(true);
    setShowAddMenu(false);

    try {
        const plansData: ItineraryItem[] = await parseMenuItinerary(input, type);
        
        if (plansData.length === 0) {
            alert("狸克看不懂這個行程表耶... 請試著寫清楚一點？");
            return;
        }

        const newPlans: MealPlan[] = [];
        const allNewIngredients: Ingredient[] = [];

        let currentIdCounter = Date.now();

        plansData.forEach((planData, idx) => {
            const planId = currentIdCounter + idx * 100;
            
            // 1. Create Ingredients
            const planIngs: Ingredient[] = planData.ingredients.map((name, i) => ({
                id: planId + i + 5000,
                name: name,
                selected: false,
                usedInPlanId: planId,
                owner: { id: currentUser.id, name: currentUser.name, avatar: currentUser.avatar }
            }));
            
            allNewIngredients.push(...planIngs);

            // 2. Create Checklist
            const checklistItems: CheckItem[] = planIngs.map(ing => ({
                id: `auto-${ing.id}`,
                name: ing.name,
                checked: false,
                owner: { name: ing.owner.name, avatar: ing.owner.avatar },
                sourceIngredientId: ing.id
            }));

            // 3. Create Plan
            newPlans.push({
                id: planId,
                dayLabel: planData.dayLabel,
                mealType: planData.mealType,
                title: `${planData.dayLabel} ${getMealLabel(planData.mealType)}`,
                menuName: planData.menuName,
                reason: planData.reason || '從行程表匯入',
                checklist: checklistItems,
                notes: '',
                recipe: {
                    steps: planData.steps,
                    videoQuery: planData.videoQuery
                }
            });
        });

        // Update State
        setIngredients(prev => [...prev, ...allNewIngredients]);
        setMealPlans(prev => [...prev, ...newPlans]); 
        
        // Auto expand first new plan
        if(newPlans.length > 0) {
            setExpandedPlans(prev => ({ ...prev, [newPlans[0].id]: true }));
        }

        setPastedMenuText('');

    } catch (error) {
        console.error(error);
        alert("行程分析失敗，請檢查 API Key 或網路連線。");
    } finally {
        setIsAnalyzing(false);
        if(bulkCameraRef.current) bulkCameraRef.current.value = '';
        if(bulkGalleryRef.current) bulkGalleryRef.current.value = '';
    }
  };

  const handleBulkImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const base64String = await fileToBase64(file);
      handleBulkItinerary(base64String, 'image');
  };

  // --- Single Menu Logic ---

  // Enhanced Manual Add: Can specify context
  const handleAddDishToMeal = (dayLabel: string, mealType: 'breakfast' | 'lunch' | 'dinner') => {
    const newId = Date.now();
    const newPlan: MealPlan = {
        id: newId,
        dayLabel: dayLabel,
        mealType: mealType,
        title: '自訂料理',
        menuName: '新料理',
        reason: '',
        checklist: [],
        notes: '',
        recipe: { steps: [], videoQuery: '' }
    };
    
    setMealPlans(prev => [...prev, newPlan]);
    setExpandedPlans(prev => ({ ...prev, [newId]: true }));
    startPlanEdit(newPlan);
  };

  const handleManualAdd = () => {
      // Default fallback
      const newPlanId = Date.now();
      const newPlan: MealPlan = {
          id: newPlanId,
          dayLabel: '未分類日期',
          mealType: 'dinner', 
          title: '自訂餐點',
          menuName: '新料理',
          reason: '點擊編輯按鈕來輸入詳細資訊...',
          checklist: [],
          notes: '',
          recipe: { steps: [], videoQuery: '' }
      };
      setMealPlans([newPlan, ...mealPlans]);
      setExpandedPlans(prev => ({ ...prev, [newPlanId]: true }));
      setShowAddMenu(false);
      startPlanEdit(newPlan);
  };

  const handleMenuImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsAnalyzing(true);
    setShowAddMenu(false);

    try {
        const base64String = await fileToBase64(file);
        const analyzedData = await analyzeMenuFromImage(base64String);
        
        const newPlanId = Date.now();
        
        const newIngredients: Ingredient[] = analyzedData.ingredients.map((name, idx) => ({
            id: newPlanId + idx + 1000,
            name: name,
            selected: false,
            usedInPlanId: newPlanId,
            owner: { id: currentUser.id, name: currentUser.name, avatar: currentUser.avatar }
        }));

        setIngredients(prev => [...newIngredients, ...prev]);

        const checklistItems: CheckItem[] = newIngredients.map(ing => ({
            id: `auto-${ing.id}`,
            name: ing.name,
            checked: false,
            owner: { name: ing.owner.name, avatar: ing.owner.avatar },
            sourceIngredientId: ing.id
        }));

        const newPlan: MealPlan = {
            id: newPlanId,
            dayLabel: '未分類日期', // Single upload defaults to generic
            mealType: 'dinner',
            title: 'AI 推薦',
            menuName: analyzedData.menuName,
            reason: analyzedData.reason,
            checklist: checklistItems,
            notes: '',
            recipe: {
                steps: analyzedData.steps,
                videoQuery: analyzedData.videoQuery
            }
        };

        setMealPlans([newPlan, ...mealPlans]);
        setExpandedPlans(prev => ({ ...prev, [newPlanId]: true }));

    } catch (error) {
        console.error(error);
        alert("圖片分析失敗，請確認網路連線或稍後再試。");
    } finally {
        setIsAnalyzing(false);
        if (cameraInputRef.current) cameraInputRef.current.value = '';
        if (galleryInputRef.current) galleryInputRef.current.value = '';
    }
  };

  const fileToBase64 = (file: File): Promise<string> => {
      return new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve((reader.result as string).split(',')[1]);
          reader.onerror = reject;
          reader.readAsDataURL(file);
      });
  };

  // --- Checklist & Edit Logic (Existing) ---
  
  const toggleCheck = (planId: number, itemId: string) => {
    setMealPlans(prev => prev.map(plan => {
      if (plan.id !== planId) return plan;
      return {
        ...plan,
        checklist: plan.checklist.map(item => 
          item.id === itemId ? { ...item, checked: !item.checked } : item
        )
      };
    }));
  };

  const updateNotes = (planId: number, notes: string) => {
    setMealPlans(prev => prev.map(plan => 
      plan.id === planId ? { ...plan, notes } : plan
    ));
  };

  const startEdit = (item: CheckItem) => {
    setEditingItemId(item.id);
    setEditName(item.name);
    setEditOwner(item.owner);
  };

  const saveEdit = (planId: number, itemId: string) => {
    if (!editName.trim()) return;
    
    setMealPlans(prev => prev.map(plan => {
      if (plan.id !== planId) return plan;
      
      return {
        ...plan,
        checklist: plan.checklist.map(item => {
            if (item.id === itemId) {
                const ownerChanged = JSON.stringify(item.owner) !== JSON.stringify(editOwner);
                
                if (ownerChanged && item.sourceIngredientId && editOwner) {
                     const matchedMember = members.find(m => m.name === editOwner.name && m.avatar === editOwner.avatar);
                     if (matchedMember) {
                         setIngredients(prevIngs => prevIngs.map(ing => {
                             if (ing.id === item.sourceIngredientId) {
                                 return { ...ing, owner: { id: matchedMember.id, name: matchedMember.name, avatar: matchedMember.avatar }};
                             }
                             return ing;
                         }));
                     }
                }
                return { ...item, name: editName, owner: editOwner };
            }
            return item;
        })
      };
    }));

    setEditingItemId(null);
    setEditOwner(null);
  };

  const addNewItem = (planId: number) => {
    const name = newItemNames[planId];
    if (!name || !name.trim()) return;

    setMealPlans(prev => prev.map(plan => {
      if (plan.id !== planId) return plan;
      const newItem: CheckItem = {
        id: `custom-${Date.now()}`,
        name: name,
        checked: false,
        owner: null,
        sourceIngredientId: null
      };
      return { ...plan, checklist: [...plan.checklist, newItem] };
    }));
    setNewItemNames(prev => ({ ...prev, [planId]: '' }));
  };

  const deleteItem = (planId: number, itemId: string) => {
    if (window.confirm("確定移除這個項目嗎？")) {
        setMealPlans(prev => prev.map(plan => {
            if (plan.id !== planId) return plan;
            return {
                ...plan,
                checklist: plan.checklist.filter(item => item.id !== itemId)
            };
        }));
    }
  };

  const startPlanEdit = (plan: MealPlan) => {
    setEditingPlanId(plan.id);
    setPlanEditForm({
      menuName: plan.menuName,
      reason: plan.reason,
      steps: plan.recipe.steps.join('\n')
    });
  };

  const savePlanEdit = (planId: number) => {
    if (!planEditForm) return;

    setMealPlans(prev => prev.map(plan => {
      if (plan.id !== planId) return plan;
      return {
        ...plan,
        menuName: planEditForm.menuName,
        reason: planEditForm.reason,
        recipe: {
          ...plan.recipe,
          steps: planEditForm.steps.split('\n').filter(s => s.trim())
        }
      };
    }));
    setEditingPlanId(null);
    setPlanEditForm(null);
  };

  const cancelPlanEdit = () => {
    setEditingPlanId(null);
    setPlanEditForm(null);
  };

  const deletePlan = (planId: number) => {
      if(window.confirm("確定要刪除這道料理嗎？相關的食材鎖定也會被解除。")) {
          setMealPlans(prev => prev.filter(p => p.id !== planId));
          // Unlock ingredients
          setIngredients(prev => prev.map(ing => 
             ing.usedInPlanId === planId ? { ...ing, usedInPlanId: null, selected: false } : ing 
          ));
      }
  }

  return (
    <div className="space-y-4 animate-fade-in pb-12">
      
      {/* Header & Add Button */}
      <div className="bg-[#FFFEF5] p-5 rounded-3xl shadow-sm border border-[#E0D8C0]">
        <div className="flex justify-between items-start">
            <div>
                <h3 className="font-bold text-[#5D4632] flex items-center gap-2 text-lg">
                <BookOpen size={20} className="text-[#E76F51]" />
                島民食譜
                </h3>
                <p className="text-xs text-[#8C7B65] mt-1">
                這裡存放所有計畫中的美味料理
                </p>
            </div>
            
            <button 
                onClick={() => setShowAddMenu(!showAddMenu)}
                disabled={isAnalyzing}
                className="bg-[#E76F51] text-white px-4 py-2 rounded-full font-bold shadow-sm hover:bg-[#D65F41] active:scale-95 transition-all flex items-center gap-2 text-sm"
            >
                {isAnalyzing ? <Loader2 size={16} className="animate-spin"/> : <Plus size={16} />}
                {isAnalyzing ? '分析中...' : '新增料理'}
            </button>
        </div>

        {/* Add Menu Panel */}
        {showAddMenu && (
            <div className="mt-4 p-4 bg-[#E9F5D8] rounded-2xl border border-[#7BC64F]/30 animate-fade-in">
                
                {/* 1. Bulk Import Section */}
                <div className="mb-6 pb-6 border-b border-[#7BC64F]/20">
                    <h4 className="font-bold text-[#5D4632] text-sm mb-3 flex items-center gap-2">
                        <Sparkles size={16} className="text-[#F4A261]"/>
                        大量匯入 / 貼上菜單
                    </h4>
                    <textarea 
                        value={pastedMenuText}
                        onChange={(e) => setPastedMenuText(e.target.value)}
                        placeholder={`例如：\n第一天晚餐：飯湯、水餃\n第二天早餐：蛋餅...`}
                        className="w-full h-24 bg-white border border-[#E0D8C0] rounded-xl p-3 text-sm text-[#5D4632] mb-3 focus:outline-none focus:border-[#7BC64F]"
                    />
                    
                    <div className="flex gap-2">
                        <button 
                            onClick={() => handleBulkItinerary(pastedMenuText, 'text')}
                            disabled={!pastedMenuText.trim()}
                            className="flex-1 bg-[#2A9D8F] text-white py-2 rounded-lg font-bold text-sm hover:bg-[#21867a] disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center gap-1"
                        >
                            <FileText size={16} /> 解析文字行程
                        </button>

                        <input 
                            type="file" 
                            accept="image/*" 
                            className="hidden" 
                            ref={bulkGalleryRef}
                            onChange={handleBulkImageUpload}
                        />
                         <input 
                            type="file" 
                            accept="image/*" 
                            capture="environment"
                            className="hidden" 
                            ref={bulkCameraRef}
                            onChange={handleBulkImageUpload}
                        />

                        <button 
                            onClick={() => bulkGalleryRef.current?.click()}
                            className="bg-white text-[#2A9D8F] border border-[#2A9D8F] px-3 py-2 rounded-lg font-bold text-sm hover:bg-[#2A9D8F]/10 flex items-center gap-1"
                            title="上傳行程表截圖"
                        >
                            <ImageIcon size={16} />
                        </button>
                        <button 
                            onClick={() => bulkCameraRef.current?.click()}
                            className="bg-white text-[#2A9D8F] border border-[#2A9D8F] px-3 py-2 rounded-lg font-bold text-sm hover:bg-[#2A9D8F]/10 flex items-center gap-1"
                            title="拍行程表"
                        >
                            <Camera size={16} />
                        </button>
                    </div>
                </div>

                {/* 2. Single Item Section */}
                <div>
                    <h4 className="font-bold text-[#5D4632] text-sm mb-3 text-opacity-70">
                        或新增單道料理...
                    </h4>
                    
                    <input 
                        type="file" 
                        accept="image/*" 
                        capture="environment"
                        className="hidden" 
                        ref={cameraInputRef}
                        onChange={handleMenuImageUpload}
                    />
                    <input 
                        type="file" 
                        accept="image/*" 
                        className="hidden" 
                        ref={galleryInputRef}
                        onChange={handleMenuImageUpload}
                    />

                    <div className="grid grid-cols-2 gap-3 mb-3">
                        <button 
                            onClick={() => cameraInputRef.current?.click()}
                            className="flex flex-col items-center justify-center gap-2 bg-white p-3 rounded-xl border border-[#E0D8C0] hover:border-[#7BC64F] transition-all active:scale-95 shadow-sm"
                        >
                            <Camera size={20} className="text-[#7BC64F]" />
                            <span className="text-xs font-bold text-[#5D4632]">拍成品照</span>
                        </button>
                        <button 
                            onClick={() => galleryInputRef.current?.click()}
                            className="flex flex-col items-center justify-center gap-2 bg-white p-3 rounded-xl border border-[#E0D8C0] hover:border-[#7BC64F] transition-all active:scale-95 shadow-sm"
                        >
                            <ImageIcon size={20} className="text-[#F4A261]" />
                            <span className="text-xs font-bold text-[#5D4632]">上傳照片</span>
                        </button>
                    </div>

                    <button 
                        onClick={handleManualAdd}
                        className="w-full bg-white text-[#5D4632] py-2 rounded-xl font-bold border-2 border-dashed border-[#E0D8C0] hover:border-[#7BC64F] hover:text-[#7BC64F] transition-all flex items-center justify-center gap-2 text-sm"
                    >
                        <PenSquare size={16} /> 手動建立空白食譜
                    </button>
                </div>
            </div>
        )}
      </div>

      {mealPlans.length === 0 && !showAddMenu && (
        <div className="text-center py-10 opacity-60">
           <div className="w-16 h-16 bg-[#E0D8C0] rounded-full mx-auto mb-2 flex items-center justify-center text-white">
              <BookOpen size={32} />
           </div>
           <p className="text-[#8C7B65] text-sm">目前沒有食譜，請按右上角新增。</p>
        </div>
      )}

      {/* Render Grouped Plans by Day */}
      {sortedDays.map(dayLabel => {
          // Get meal groups for this day (Breakfast, Lunch, Dinner)
          const mealGroups = groupPlansByMeal(groupedByDay[dayLabel]);
          
          return (
            <div key={dayLabel} className="space-y-4">
                {/* Day Header */}
                <div className="flex items-center gap-2 px-2 mt-6 mb-2">
                     <div className="bg-[#5D4632] text-[#F2CC8F] px-4 py-1.5 rounded-full text-sm font-bold shadow-sm flex items-center gap-2">
                         <CalendarDays size={14} />
                         {dayLabel}
                     </div>
                     <div className="h-0.5 flex-1 bg-[#E0D8C0]/50 rounded-full"></div>
                </div>
                
                {/* Meal Groups Loop */}
                {mealGroups.map(group => (
                    <div key={group.type} className="pl-2">
                         {/* Meal Type Header - Visual Anchor for the Group */}
                         <div className="sticky top-0 z-0 flex items-center gap-2 mb-3 ml-2 group/header">
                             <div className={`p-2 rounded-full border-2 ${
                                 group.type === 'breakfast' ? 'bg-[#F4A261] border-[#F4A261] text-white' : 
                                 group.type === 'lunch' ? 'bg-[#F2CC8F] border-[#F2CC8F] text-[#5D4632]' : 
                                 'bg-[#2A9D8F] border-[#2A9D8F] text-white'
                             }`}>
                                 {getMealIcon(group.type)}
                             </div>
                             <span className="text-sm font-bold text-[#8C7B65]">{getMealLabel(group.type)}</span>
                             
                             {/* Specific Add Button for this Slot */}
                             <button
                                onClick={() => handleAddDishToMeal(dayLabel, group.type)}
                                className="ml-2 p-1.5 rounded-full bg-white border border-[#E0D8C0] text-[#8C7B65] hover:bg-[#7BC64F] hover:text-white hover:border-[#7BC64F] transition-all shadow-sm active:scale-90"
                                title={`新增一道${getMealLabel(group.type)}料理`}
                            >
                                <Plus size={14} />
                            </button>
                         </div>

                         {/* List of Cards for this Meal */}
                         <div className="space-y-3 pl-4 border-l-2 border-[#E0D8C0]/40 ml-5 pb-2">
                             {group.plans.map((plan) => {
                                const isExpanded = expandedPlans[plan.id];
                                const isPlanEditing = editingPlanId === plan.id;

                                return (
                                <div key={plan.id} className="bg-[#FFFEF5] rounded-3xl shadow-md overflow-hidden border border-[#E0D8C0] transition-all relative">
                                    
                                    {/* Admin/User Delete Button */}
                                    {isExpanded && !isPlanEditing && (
                                        <button 
                                            onClick={() => deletePlan(plan.id)}
                                            className="absolute top-4 right-14 z-10 p-2 text-[#E0D8C0] hover:text-[#E76F51] bg-white rounded-full border border-[#E0D8C0] active:scale-95"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    )}

                                    {/* Card Header (Collapsed View) */}
                                    <div 
                                    className={`p-4 flex justify-between items-center cursor-pointer transition-colors ${isExpanded ? 'bg-[#E76F51]/10 border-b border-[#E0D8C0]' : 'hover:bg-[#F9F7F2]'}`}
                                    onClick={() => toggleExpand(plan.id)}
                                    >
                                        <div className="flex items-center gap-3 overflow-hidden">
                                            {/* We don't need the meal icon here again, just the name */}
                                            <div className="min-w-0">
                                                {isPlanEditing ? (
                                                    <span className="text-xs text-[#8C7B65] font-bold">正在編輯料理資訊...</span>
                                                ) : (
                                                    <h2 className={`font-bold text-[#5D4632] truncate ${isExpanded ? 'text-lg' : 'text-base'}`}>
                                                        {plan.menuName}
                                                    </h2>
                                                )}
                                                {!isExpanded && plan.reason && (
                                                    <p className="text-xs text-[#8C7B65] truncate mt-0.5 opacity-70">
                                                        {plan.reason}
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                        
                                        <div className="text-[#8C7B65] p-2">
                                            {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                                        </div>
                                    </div>

                                    {/* Expanded Content */}
                                    {isExpanded && (
                                    <div className="animate-fade-in relative">
                                        
                                        {/* Plan Info Editing Section */}
                                        {isPlanEditing && planEditForm ? (
                                        <div className="p-5 bg-white border-b border-[#E0D8C0] space-y-4">
                                            <div className="flex justify-between items-center mb-2">
                                                <h4 className="font-bold text-[#5D4632] flex items-center gap-2 text-sm">
                                                <Edit3 size={16} className="text-[#E76F51]" /> 編輯料理資訊
                                                </h4>
                                            </div>
                                            
                                            <div>
                                                <label className="block text-xs font-bold text-[#8C7B65] mb-1">料理名稱</label>
                                                <div className="flex gap-2">
                                                    <input
                                                    type="text"
                                                    value={planEditForm.menuName}
                                                    onChange={(e) => setPlanEditForm({...planEditForm, menuName: e.target.value})}
                                                    placeholder="例如: 紅燒牛肉麵"
                                                    className="flex-1 bg-[#F9F7F2] border-2 border-[#E0D8C0] rounded-xl px-3 py-2 text-sm text-[#5D4632] focus:outline-none focus:border-[#E76F51]"
                                                    />
                                                    
                                                    {/* AI Generate Button */}
                                                    <button 
                                                        onClick={() => handleAutoGenerate(plan.id, planEditForm.menuName)}
                                                        disabled={isGeneratingRecipe || !planEditForm.menuName.trim()}
                                                        className={`px-3 py-2 rounded-xl text-xs font-bold text-white shadow-sm flex items-center gap-1 transition-all active:scale-95 whitespace-nowrap ${
                                                            isGeneratingRecipe 
                                                                ? 'bg-[#E0D8C0] cursor-wait' 
                                                                : 'bg-gradient-to-r from-[#F4A261] to-[#E76F51] hover:opacity-90'
                                                        }`}
                                                        title="AI 自動生成食材與食譜"
                                                    >
                                                        {isGeneratingRecipe ? <Loader2 size={16} className="animate-spin" /> : <Wand2 size={16} />}
                                                        {isGeneratingRecipe ? '生成中...' : 'AI 自動填寫'}
                                                    </button>
                                                </div>
                                                <p className="text-[10px] text-[#8C7B65] mt-1 ml-1 opacity-70">
                                                    * 輸入名稱後點擊 AI 按鈕，會自動填入特色、步驟，並同步食材到冰箱！
                                                </p>
                                            </div>
                                            
                                            <div>
                                                <label className="block text-xs font-bold text-[#8C7B65] mb-1">料理特色/原因</label>
                                                <textarea
                                                value={planEditForm.reason}
                                                onChange={(e) => setPlanEditForm({...planEditForm, reason: e.target.value})}
                                                className="w-full bg-[#F9F7F2] border-2 border-[#E0D8C0] rounded-xl px-3 py-2 text-sm text-[#5D4632] focus:outline-none focus:border-[#E76F51] h-20 resize-none"
                                                />
                                            </div>

                                            <div>
                                                <label className="block text-xs font-bold text-[#8C7B65] mb-1">烹飪步驟 (每行一步驟)</label>
                                                <textarea
                                                value={planEditForm.steps}
                                                onChange={(e) => setPlanEditForm({...planEditForm, steps: e.target.value})}
                                                className="w-full bg-[#F9F7F2] border-2 border-[#E0D8C0] rounded-xl px-3 py-2 text-sm text-[#5D4632] focus:outline-none focus:border-[#E76F51] h-32"
                                                />
                                            </div>

                                            <div className="flex gap-2 justify-end pt-2">
                                                <button onClick={cancelPlanEdit} className="px-4 py-2 rounded-full text-xs font-bold text-[#8C7B65] hover:bg-[#F2F7E6]">取消</button>
                                                <button onClick={() => savePlanEdit(plan.id)} className="px-5 py-2 rounded-full text-xs font-bold bg-[#7BC64F] text-white hover:bg-[#5da135] shadow-sm flex items-center gap-1">
                                                <Save size={14} /> 儲存變更
                                                </button>
                                            </div>
                                        </div>
                                        ) : (
                                            <>
                                                {/* Edit Button */}
                                                <div className="absolute top-4 right-4 z-10">
                                                    <button 
                                                    onClick={() => startPlanEdit(plan)}
                                                    className="p-2 bg-white/80 hover:bg-[#F2CC8F] hover:text-[#5D4632] text-[#8C7B65] rounded-full shadow-sm border border-[#E0D8C0] transition-colors active:scale-95"
                                                    title="編輯料理資訊"
                                                    >
                                                        <Edit3 size={16} />
                                                    </button>
                                                </div>

                                                {/* Links */}
                                                {plan.recipe?.videoQuery && (
                                                    <div className="px-5 py-2 bg-[#fffcf5] border-b border-[#E0D8C0] flex justify-end mr-14">
                                                        <a 
                                                            href={`https://www.youtube.com/results?search_query=${encodeURIComponent(plan.recipe.videoQuery)}`}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="flex items-center gap-2 text-[#E76F51] text-xs font-bold bg-white border border-[#E0D8C0] px-3 py-1.5 rounded-full hover:bg-[#E76F51] hover:text-white transition-all shadow-sm active:scale-95"
                                                        >
                                                            <Youtube size={14} /> 看教學影片
                                                        </a>
                                                    </div>
                                                )}
                                            </>
                                        )}

                                        {/* Checklist Area */}
                                        <div className="p-5 border-b border-[#E0D8C0] bg-white/50">
                                            <h4 className="font-bold text-[#5D4632] mb-3 flex items-center gap-2 text-sm">
                                                <Check size={16} className="text-[#7BC64F]" />
                                                食材檢核 & 準備
                                                {plan.checklist.some(i => i.sourceIngredientId) && (
                                                    <span className="text-[10px] bg-[#E9F5D8] text-[#5D4632] px-2 py-0.5 rounded-full ml-auto font-normal">
                                                        已連動共享冰箱
                                                    </span>
                                                )}
                                            </h4>
                                            
                                            <div className="space-y-2">
                                                {plan.checklist.map((item) => (
                                                    <div 
                                                        key={item.id} 
                                                        className={`group flex flex-col gap-2 p-3 rounded-2xl transition-all border-2 ${
                                                            item.checked 
                                                                ? 'bg-[#E0D8C0]/20 border-transparent' 
                                                                : editingItemId === item.id 
                                                                    ? 'bg-white border-[#F4A261] shadow-md ring-2 ring-[#F4A261]/20'
                                                                    : 'bg-white border-[#E0D8C0] hover:border-[#F2CC8F]'
                                                        }`}
                                                    >
                                                        <div className="flex items-center gap-3">
                                                            <button 
                                                                onClick={() => toggleCheck(plan.id, item.id)}
                                                                className={`w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all active:scale-90 ${
                                                                    item.checked ? 'bg-[#7BC64F] border-[#7BC64F]' : 'border-[#E0D8C0] hover:border-[#F4A261]'
                                                                }`}
                                                            >
                                                                {item.checked && <Check size={14} className="text-white" />}
                                                            </button>

                                                            <div className="flex-1 min-w-0">
                                                                {editingItemId === item.id ? (
                                                                    <div className="flex items-center gap-2">
                                                                        <input 
                                                                            type="text" 
                                                                            value={editName}
                                                                            onChange={(e) => setEditName(e.target.value)}
                                                                            className="w-full bg-[#F9F7F2] border border-[#E0D8C0] rounded-lg px-2 py-1.5 text-sm outline-none focus:border-[#F4A261]"
                                                                            autoFocus
                                                                            placeholder="輸入食材名稱"
                                                                        />
                                                                    </div>
                                                                ) : (
                                                                    <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
                                                                        <span 
                                                                            onClick={() => {
                                                                                if (!item.checked || currentUser.isAdmin) startEdit(item);
                                                                            }}
                                                                            className={`font-bold text-sm cursor-pointer hover:underline decoration-dashed decoration-[#E0D8C0] underline-offset-4 ${item.checked ? 'text-[#8C7B65] line-through' : 'text-[#5D4632]'}`}
                                                                        >
                                                                            {item.name}
                                                                        </span>
                                                                        
                                                                        {item.owner ? (
                                                                            <span className={`text-[10px] w-fit px-2 py-0.5 rounded-full flex items-center gap-1 ${item.checked ? 'opacity-50' : ''} bg-[#E9F5D8] text-[#5D4632]`}>
                                                                                {item.owner.avatar} {item.owner.name}
                                                                            </span>
                                                                        ) : (
                                                                            <span className={`text-[10px] w-fit px-2 py-0.5 rounded-full bg-[#E76F51]/10 text-[#E76F51] flex items-center gap-1 ${item.checked ? 'opacity-50' : ''}`}>
                                                                                <ShoppingBag size={10} /> 需採買
                                                                            </span>
                                                                        )}
                                                                        
                                                                        {item.sourceIngredientId && (
                                                                        <span className="text-[9px] text-[#7BC64F] border border-[#7BC64F] px-1 rounded ml-1 opacity-60">冰箱</span>
                                                                        )}
                                                                    </div>
                                                                )}
                                                            </div>

                                                            {/* Action Buttons */}
                                                            {editingItemId === item.id ? (
                                                                <div className="flex gap-1">
                                                                    <button onClick={() => saveEdit(plan.id, item.id)} className="p-2 bg-[#7BC64F] text-white rounded-full shadow-sm active:scale-95"><Check size={16}/></button>
                                                                    <button onClick={() => setEditingItemId(null)} className="p-2 text-[#8C7B65] hover:bg-[#E0D8C0] rounded-full"><X size={16}/></button>
                                                                </div>
                                                            ) : (
                                                                (!item.checked || currentUser.isAdmin) && (
                                                                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                                        <button onClick={() => startEdit(item)} className="p-1.5 text-[#8C7B65] hover:bg-[#F2CC8F]/20 rounded-full" title="編輯項目與負責人">
                                                                            <PenSquare size={16} />
                                                                        </button>
                                                                        <button onClick={() => deleteItem(plan.id, item.id)} className="p-1.5 text-[#E0D8C0] hover:text-[#E76F51] hover:bg-[#E76F51]/10 rounded-full">
                                                                            <Trash2 size={16} />
                                                                        </button>
                                                                    </div>
                                                                )
                                                            )}
                                                        </div>

                                                        {/* Owner Selector (Only when editing) */}
                                                        {editingItemId === item.id && (
                                                            <div className="flex items-center gap-2 overflow-x-auto pb-1 mt-1 pl-9">
                                                                <span className="text-[10px] text-[#8C7B65] font-bold whitespace-nowrap">指派給:</span>
                                                                <button
                                                                    onClick={() => setEditOwner(null)}
                                                                    className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs border whitespace-nowrap transition-all ${
                                                                        editOwner === null 
                                                                            ? 'bg-[#E76F51] text-white border-[#E76F51]' 
                                                                            : 'bg-white border-[#E0D8C0] text-[#8C7B65]'
                                                                    }`}
                                                                >
                                                                    <ShoppingBag size={10} /> 需採買
                                                                </button>
                                                                {members.map(m => (
                                                                    <button
                                                                        key={m.id}
                                                                        onClick={() => setEditOwner({ name: m.name, avatar: m.avatar })}
                                                                        className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs border whitespace-nowrap transition-all ${
                                                                            editOwner?.name === m.name
                                                                                ? 'bg-[#7BC64F] text-white border-[#7BC64F]' 
                                                                                : 'bg-white border-[#E0D8C0] text-[#5D4632]'
                                                                        }`}
                                                                    >
                                                                        {m.avatar} {m.name}
                                                                    </button>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </div>
                                                ))}

                                                {/* Add New Item Row */}
                                                <div className="flex gap-2 mt-3 pt-2 border-t border-[#E0D8C0] border-dashed">
                                                    <input 
                                                        type="text"
                                                        value={newItemNames[plan.id] || ''}
                                                        onChange={(e) => setNewItemNames(prev => ({...prev, [plan.id]: e.target.value}))}
                                                        placeholder="新增其他食材或備註..."
                                                        className="flex-1 bg-[#F9F7F2] border-2 border-[#E0D8C0] rounded-full px-4 py-2 text-sm focus:outline-none focus:border-[#F4A261] text-[#5D4632]"
                                                        onKeyDown={(e) => e.key === 'Enter' && addNewItem(plan.id)}
                                                    />
                                                    <button 
                                                        onClick={() => addNewItem(plan.id)}
                                                        className="bg-[#F4A261] text-white p-2 rounded-full hover:bg-[#E76F51] active:scale-95 transition-all"
                                                    >
                                                        <Plus size={20} />
                                                    </button>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Notes Section (Hide if editing plan details to avoid clutter, visually simpler) */}
                                        {!isPlanEditing && (
                                            <div className="p-5 border-b border-[#E0D8C0]">
                                                <h4 className="font-bold text-[#5D4632] mb-3 flex items-center gap-2 text-sm">
                                                <StickyNote size={16} className="text-[#F2CC8F]" />
                                                主廚筆記
                                                </h4>
                                                <textarea 
                                                    value={plan.notes}
                                                    onChange={(e) => updateNotes(plan.id, e.target.value)}
                                                    placeholder="寫下備料提醒..."
                                                    className="w-full h-20 bg-[#FFF] border-2 border-[#E0D8C0] rounded-2xl p-3 text-sm text-[#5D4632] focus:outline-none focus:border-[#F2CC8F] resize-none"
                                                />
                                            </div>
                                        )}

                                        {/* Steps */}
                                        {!isPlanEditing && (
                                            <div className="p-5">
                                                <h4 className="font-bold text-[#5D4632] mb-4 flex items-center gap-2 text-sm">
                                                <Flame size={16} className="text-[#E76F51]" />
                                                料理步驟
                                                </h4>
                                                
                                                <div className="space-y-4">
                                                {plan.recipe?.steps && plan.recipe.steps.length > 0 ? (
                                                    plan.recipe.steps.map((step, idx) => (
                                                    <div key={idx} className="flex gap-4 text-[#5D4632]">
                                                        <span className="flex-shrink-0 w-6 h-6 bg-[#F2CC8F] text-[#5D4632] rounded-full flex items-center justify-center text-xs font-bold mt-0.5">
                                                        {idx + 1}
                                                        </span>
                                                        <span className="leading-relaxed text-sm">{step}</span>
                                                    </div>
                                                    ))
                                                ) : (
                                                    <div className="text-[#8C7B65] text-sm italic">
                                                        沒有詳細步驟資料。
                                                        <button onClick={() => startPlanEdit(plan)} className="underline text-[#E76F51] ml-1">點擊編輯新增</button>
                                                    </div>
                                                )}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                    )}
                                </div>
                                );
                            })}
                         </div>
                    </div>
                ))}
            </div>
          );
      })}
    </div>
  );
};

export default MenuSection;