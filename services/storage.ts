import { GearItem, Ingredient, MealPlan, Bill, User, TripInfo } from '../types';

export interface AppData {
  gearList: GearItem[];
  ingredients: Ingredient[];
  mealPlans: MealPlan[];
  bills: Bill[];
  members: User[];
  tripInfo: TripInfo;
  checkedDeparture?: Record<string, boolean>;
  checkedReturn?: Record<string, boolean>;
  lastUpdated: number;
}

const STORAGE_KEY_GAS_URL = 'tanuki_gas_url';
const STORAGE_KEY_LOCAL_DATA = 'tanuki_local_data';

export const getGasUrl = (): string => localStorage.getItem(STORAGE_KEY_GAS_URL) || '';
export const setGasUrl = (url: string) => localStorage.setItem(STORAGE_KEY_GAS_URL, url);

export const saveToLocal = (data: AppData) => {
  localStorage.setItem(STORAGE_KEY_LOCAL_DATA, JSON.stringify(data));
};

export const loadFromLocal = (): AppData | null => {
  const data = localStorage.getItem(STORAGE_KEY_LOCAL_DATA);
  return data ? JSON.parse(data) : null;
};

// Test connection to GAS
export const testConnection = async (url: string): Promise<{ success: boolean; message: string }> => {
    if (!url) return { success: false, message: "網址為空" };
    
    // Basic validation
    if (!url.includes('/exec')) {
        return { success: false, message: "網址格式錯誤：結尾必須是 /exec" };
    }

    try {
        // Use credentials: 'omit' to prevent CORS issues with Google cookies
        const response = await fetch(url, {
            method: 'GET',
            credentials: 'omit',
            redirect: 'follow'
        });
        
        if (!response.ok) {
            return { success: false, message: `HTTP 錯誤: ${response.status}` };
        }

        const text = await response.text();
        
        // Check for HTML (Google Login Page usually indicates permission issues)
        if (text.trim().startsWith("<") || text.includes("<!DOCTYPE html>")) {
            return { success: false, message: "權限不足：請確認 GAS 部署設定為「任何人 (Anyone)」" };
        }

        try {
            const json = JSON.parse(text);
            if (json.status === 'error') return { success: false, message: `GAS 錯誤: ${json.message}` };
            return { success: true, message: "連線成功！" };
        } catch (e) {
            return { success: false, message: "回傳格式錯誤 (非 JSON)" };
        }
    } catch (error) {
        console.error("Test connection error:", error);
        return { success: false, message: "網路請求失敗 (可能是 CORS 或網址錯誤)" };
    }
};

// Fetch data from Google Apps Script
export const fetchFromCloud = async (): Promise<AppData | null> => {
  const url = getGasUrl();
  if (!url) return null;

  try {
    const response = await fetch(url, {
        method: 'GET',
        credentials: 'omit', // Critical for GAS Web Apps
        redirect: 'follow'
    });

    if (!response.ok) {
        throw new Error(`HTTP Error: ${response.status}`);
    }

    const text = await response.text();

    // Critical: Check if the response is HTML (Login page) instead of JSON
    if (text.trim().startsWith("<") || text.includes("<!DOCTYPE html>")) {
        throw new Error("權限錯誤：無法讀取資料。請檢查 GAS 部署權限是否設為「任何人 (Anyone)」。");
    }

    let json;
    try {
        json = JSON.parse(text);
    } catch (e) {
        throw new Error("資料解析失敗：回傳內容不是有效的 JSON 格式。");
    }
    
    if (json.status === 'empty') return null;
    if (json.status === 'error') throw new Error(json.message || "GAS 未知錯誤");
    
    // --- Data Reconstruction & Migration Logic ---
    
    // Arrays to populate from scattered keys
    let publicGear: GearItem[] = [];
    let personalGear: GearItem[] = [];
    let ingredients: Ingredient[] = [];
    let mealPlans: MealPlan[] = [];
    let bills: Bill[] = [];

    // Scan all keys in the response JSON to find individual items
    Object.keys(json).forEach(key => {
        if (key.startsWith('gear_public_item_')) {
            publicGear.push(json[key]);
        } else if (key.startsWith('gear_personal_item_')) {
            personalGear.push(json[key]);
        } else if (key.startsWith('ingredients_item_')) {
            ingredients.push(json[key]);
        } else if (key.startsWith('mealPlans_item_')) {
            mealPlans.push(json[key]);
        } else if (key.startsWith('bills_item_')) {
            bills.push(json[key]);
        }
    });

    // Fallbacks: If no individual items found, check for legacy array keys (old storage)
    if (publicGear.length === 0 && json.gear_public) {
        publicGear = Array.isArray(json.gear_public) ? json.gear_public : [];
    }
    if (personalGear.length === 0 && json.gear_personal) {
        personalGear = Array.isArray(json.gear_personal) ? json.gear_personal : [];
    }
    if (ingredients.length === 0 && json.ingredients) {
        ingredients = Array.isArray(json.ingredients) ? json.ingredients : [];
    }
    if (mealPlans.length === 0 && json.mealPlans) {
        mealPlans = Array.isArray(json.mealPlans) ? json.mealPlans : [];
    }
    if (bills.length === 0 && json.bills) {
        bills = Array.isArray(json.bills) ? json.bills : [];
    }

    // Merge Gear Lists
    let mergedGearList: GearItem[] = [...publicGear, ...personalGear];
    if (mergedGearList.length === 0 && json.gearList) {
        mergedGearList = (json.gearList || []) as GearItem[];
    }

    // Construct the full AppData object
    const appData: AppData = {
        gearList: mergedGearList,
        ingredients: ingredients,
        mealPlans: mealPlans,
        bills: bills,
        members: json.members || [],
        tripInfo: json.tripInfo || {},
        checkedDeparture: json.checkedDeparture || {},
        checkedReturn: json.checkedReturn || {},
        lastUpdated: json.lastUpdated || Date.now()
    };
    
    return appData;
  } catch (error) {
    console.error("Cloud fetch error:", error);
    throw error;
  }
};

// Archive current trip (Rename DB sheet)
export const archiveTrip = async (archiveName: string): Promise<void> => {
    const url = getGasUrl();
    if (!url) return;
    
    try {
        const response = await fetch(url, {
            method: 'POST',
            body: JSON.stringify({ action: 'archive', archiveName }),
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            credentials: 'omit',
            redirect: 'follow'
        });

        if (!response.ok) throw new Error(`HTTP Error: ${response.status}`);
        
        const text = await response.text();
        const json = JSON.parse(text);
        if (json.status === 'error') throw new Error(json.message);
        
    } catch (error) {
        console.error("Archive error:", error);
        throw error;
    }
}

// Save data to Google Apps Script
export const saveToCloud = async (data: AppData): Promise<void> => {
  const url = getGasUrl();
  if (!url) return;

  try {
    // --- Data Split Strategy ---
    // We send the arrays as distinct keys.
    // The NEW GAS backend will detect these keys ('gear_public', 'ingredients', etc.) 
    // and automatically split them into individual rows for better readability.
    
    const payload = {
        ...data,
        gear_public: data.gearList.filter(item => item.category === 'public'),
        gear_personal: data.gearList.filter(item => item.category === 'personal'),
        gearList: null // Nullify old key to keep DB clean
    };

    // We send as stringified JSON but with text/plain header to skip complex CORS preflight
    const response = await fetch(url, {
      method: 'POST',
      body: JSON.stringify(payload),
      headers: {
        'Content-Type': 'text/plain;charset=utf-8',
      },
      credentials: 'omit', // Critical for GAS Web Apps
      redirect: 'follow'
    });

    if (!response.ok) {
       throw new Error(`HTTP Error: ${response.status}`);
    }

    // Check application level error from GAS
    const text = await response.text();
    try {
        const json = JSON.parse(text);
        if (json.status === 'error') {
            throw new Error(`GAS Error: ${json.message}`);
        }
    } catch(e) {
        if (text.includes('Exception') || text.includes('Error')) {
             throw new Error(`GAS Execution Error: ${text}`);
        }
    }

  } catch (error) {
    console.error("Cloud save error:", error);
    throw error;
  }
};