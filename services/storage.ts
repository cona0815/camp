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

// Fetch data from Google Apps Script
export const fetchFromCloud = async (): Promise<AppData | null> => {
  const url = getGasUrl();
  if (!url) return null;

  try {
    const response = await fetch(url);
    const json = await response.json();
    
    if (json.status === 'empty') return null;
    if (json.status === 'error') throw new Error(json.message);
    
    return json as AppData;
  } catch (error) {
    console.error("Cloud fetch error:", error);
    throw error;
  }
};

// Save data to Google Apps Script
export const saveToCloud = async (data: AppData): Promise<void> => {
  const url = getGasUrl();
  if (!url) return;

  try {
    // We send as stringified JSON but with text/plain header to skip complex CORS preflight
    await fetch(url, {
      method: 'POST',
      body: JSON.stringify(data),
      headers: {
        'Content-Type': 'text/plain;charset=utf-8',
      },
    });
  } catch (error) {
    console.error("Cloud save error:", error);
    throw error;
  }
};