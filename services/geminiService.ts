import { GoogleGenAI, Type } from "@google/genai";
import { ShoppingItem, Recipe } from "../types";

// Helper to get key dynamically
const getApiKey = () => localStorage.getItem('tanuki_gemini_key') || '';

export interface GeneratedDish {
  menuName: string;
  reason: string;
  shoppingList: ShoppingItem[];
  recipe: Recipe;
}

// Response is now an array of dishes
export type GeneratedMealResponse = GeneratedDish[];

export interface AnalyzedMenuResponse {
  menuName: string;
  reason: string;
  ingredients: string[]; 
  steps: string[];
  videoQuery: string;
}

export interface ItineraryItem {
  dayLabel: string;
  mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack';
  menuName: string;
  ingredients: string[];
  reason: string;
  steps: string[];
  videoQuery: string;
}

export interface SingleDishResponse {
  dishName: string;
  description: string;
  ingredients: string[];
  steps: string[];
  videoQuery: string;
}

export interface GearAdviceItem {
    item: string;
    reason: string;
    priority: 'high' | 'medium' | 'low';
}

export interface WeatherResponse {
    temp: string;
    cond: string;
    advice: string;
}

// Initialize client with key from storage
const getAIClient = () => {
  const apiKey = getApiKey();
  if (!apiKey) throw new Error("尚未設定 API Key，請至設定頁面輸入。");
  
  return new GoogleGenAI({ apiKey });
};

// CRITICAL: Use this model to correctly interact with the new SDK and avoid 404s
const MODEL_NAME = 'gemini-3-flash-preview';

export const fetchWeatherForecast = async (location: string, date: string): Promise<WeatherResponse> => {
    const ai = getAIClient();
    
    // Fallback if date is vague
    const queryDate = date.includes('未定') ? 'current' : date;

    // Direct CWA Gongliao URL as a priority source
    const targetUrl = "https://www.cwa.gov.tw/V8/C/W/Town/Town.html?TID=1001013";

    const prompt = `
      任務：查詢並回報「${location}」在「${queryDate}」的真實天氣資訊。
      
      資料來源與規則：
      1. **優先瀏覽此網頁獲取數據** (若地點相符或未指定)：${targetUrl} (新北市貢寮區天氣)
      2. 若查詢地點明顯不是貢寮 (例如台中、高雄)，請使用 Google Search 查詢該地點的中央氣象署資料。
      3. 請回傳該日期的預報數值。若為今天，請回傳即時資訊。
      
      請回傳 JSON 格式：
      1. temp: 氣溫 (例如 "28°C" 或 "18-25°C")。
      2. cond: 天氣狀況簡述 (例如 "晴朗", "午後雷陣雨", "多雲")。
      3. advice: 一句針對露營的簡短穿著建議 (例如 "日夜溫差大，建議帶薄外套")。
    `;

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-3-pro-preview', // Use Pro model for better browsing capabilities
            contents: prompt,
            config: {
                tools: [{ googleSearch: {} }], // Enable Google Search Grounding to allow URL visiting behavior
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        temp: { type: Type.STRING },
                        cond: { type: Type.STRING },
                        advice: { type: Type.STRING }
                    },
                    required: ["temp", "cond", "advice"]
                }
            }
        });

        const text = response.text || "{}";
        return JSON.parse(text);
    } catch (error) {
        console.error("Weather Fetch Error:", error);
        // Fallback mock data if search fails or model issue
        return {
            temp: "N/A",
            cond: "查詢失敗",
            advice: "無法取得天氣資訊，請稍後再試。"
        };
    }
};

export const generateCampMeal = async (
  ingredients: string[],
  mealType: string,
  adults: number,
  children: number,
  title: string
): Promise<GeneratedMealResponse> => {
  
  const ai = getAIClient();
  
  const prompt = `
    角色設定：你是一位專業的露營大廚。
    任務：請為「${mealType}」制定一份詳細的餐點計畫。
    背景：${adults} 大人, ${children} 小孩。
    現有食材：${ingredients.join(', ')}。
    
    重要規則：
    1. 若該餐點包含多道菜色（例如：三菜一湯、主食+配菜），請務必**拆分成多個獨立的物件**回傳。
    2. 每個物件代表一道獨立的料理 (例如: "焢肉飯" 一個物件, "炒青菜" 一個物件)。
    3. 不要將多道菜合併在同一個 menuName 中。
    
    每個料理物件需包含：
    1. 菜單名稱 (menuName)。
    2. 選擇理由 (reason)。
    3. 購物清單 (shoppingList)。需購買量 ('buy') 若足夠填 '0'。
    4. 烹飪步驟 (recipe.steps)。
    5. YouTube 關鍵字 (recipe.videoQuery)。
  `;

  try {
    const response = await ai.models.generateContent({
        model: MODEL_NAME,
        contents: prompt,
        config: {
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.ARRAY, // Changed to ARRAY to support multiple dishes
                items: {
                    type: Type.OBJECT,
                    properties: {
                        menuName: { type: Type.STRING },
                        reason: { type: Type.STRING },
                        shoppingList: {
                            type: Type.ARRAY,
                            items: {
                                type: Type.OBJECT,
                                properties: {
                                    name: { type: Type.STRING },
                                    need: { type: Type.STRING },
                                    have: { type: Type.STRING },
                                    buy: { type: Type.STRING },
                                    checked: { type: Type.BOOLEAN },
                                },
                                required: ["name", "need", "have", "buy", "checked"]
                            },
                        },
                        recipe: {
                            type: Type.OBJECT,
                            properties: {
                                steps: { type: Type.ARRAY, items: { type: Type.STRING } },
                                videoQuery: { type: Type.STRING },
                            },
                            required: ["steps", "videoQuery"]
                        },
                    },
                    required: ["menuName", "reason", "shoppingList", "recipe"],
                }
            },
        }
    });

    const text = response.text || "[]";
    return JSON.parse(text);
  } catch (error) {
    console.error("Gemini API Error:", error);
    throw error;
  }
};

// New: Leftover Rescue
// Note: Leftover rescue usually produces a SINGLE mixed dish, so we keep it as single object return, 
// but wrapped in logic at call site if needed, or we just stick to single dish for leftovers.
// Actually, let's keep it single for simplicity in "Rescue" context (mix everything).
export const generateLeftoverRecipe = async (
  ingredients: string[]
): Promise<GeneratedDish> => {
  
  const ai = getAIClient();
  
  const prompt = `
    角色：露營剩食救星。
    任務：利用剩餘食材做出一道「清冰箱料理」。
    剩餘食材：${ingredients.join(', ')}。
    
    規則：
    1. 盡量只用現有食材，非必要不採買。
    2. 適合撤收前快速烹煮。
  `;

  try {
    const response = await ai.models.generateContent({
        model: MODEL_NAME,
        contents: prompt,
        config: {
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    menuName: { type: Type.STRING },
                    reason: { type: Type.STRING },
                    shoppingList: {
                        type: Type.ARRAY,
                        items: {
                            type: Type.OBJECT,
                            properties: {
                                name: { type: Type.STRING },
                                need: { type: Type.STRING },
                                have: { type: Type.STRING },
                                buy: { type: Type.STRING }, 
                                checked: { type: Type.BOOLEAN },
                            },
                            required: ["name", "need", "have", "buy", "checked"]
                        },
                    },
                    recipe: {
                        type: Type.OBJECT,
                        properties: {
                            steps: { type: Type.ARRAY, items: { type: Type.STRING } },
                            videoQuery: { type: Type.STRING },
                        },
                        required: ["steps", "videoQuery"]
                    },
                },
                required: ["menuName", "reason", "shoppingList", "recipe"],
            }
        }
    });

    const text = response.text || "{}";
    return JSON.parse(text);
  } catch (error) {
    console.error("Leftover API Error:", error);
    throw error;
  }
};

export const generateDishRecipe = async (dishName: string): Promise<SingleDishResponse> => {
  
  const ai = getAIClient();

  const prompt = `
    料理：「${dishName}」。
    請提供：
    1. 優化名稱 (dishName)
    2. 短描述 (description)
    3. 關鍵食材列表 (ingredients, 僅名詞)
    4. 露營烹飪步驟 (steps)
    5. YouTube 關鍵字 (videoQuery)
  `;

  try {
    const response = await ai.models.generateContent({
        model: MODEL_NAME,
        contents: prompt,
        config: {
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    dishName: { type: Type.STRING },
                    description: { type: Type.STRING },
                    ingredients: { type: Type.ARRAY, items: { type: Type.STRING } },
                    steps: { type: Type.ARRAY, items: { type: Type.STRING } },
                    videoQuery: { type: Type.STRING },
                },
                required: ["dishName", "description", "ingredients", "steps", "videoQuery"],
            }
        }
    });

    const text = response.text || "{}";
    return JSON.parse(text);
  } catch (error) {
    console.error("Gemini Dish Recipe Error:", error);
    throw error;
  }
};

// New: Smart Gear Advisor
export const analyzeGearNeeds = async (
    location: string,
    weather: string,
    currentGear: string[]
): Promise<GearAdviceItem[]> => {
    
    const ai = getAIClient();

    const prompt = `
      角色：資深露營教練。
      地點：${location}。
      天氣：${weather}。
      目前裝備清單：${currentGear.join(', ')}。

      任務：
      1. 分析天氣與地點，找出目前清單中「缺少」的重要裝備。
      2. 建議 3-5 項新增裝備。
      3. 每項建議需說明理由 (reason) 並標示優先度 (priority: high/medium/low)。
    `;

    try {
        const response = await ai.models.generateContent({
            model: MODEL_NAME,
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            item: { type: Type.STRING },
                            reason: { type: Type.STRING },
                            priority: { type: Type.STRING, enum: ['high', 'medium', 'low'] }
                        },
                        required: ["item", "reason", "priority"]
                    }
                }
            }
        });

        const text = response.text || "[]";
        return JSON.parse(text);
    } catch (error) {
        console.error("Gear Advisor Error:", error);
        throw error;
    }
}

export const identifyIngredientsFromImage = async (base64Image: string): Promise<string[]> => {
  
  const ai = getAIClient();

  try {
    const base64Data = base64Image.includes(',') ? base64Image.split(',')[1] : base64Image;

    const response = await ai.models.generateContent({
        model: MODEL_NAME,
        contents: {
            parts: [
                {
                    inlineData: {
                        mimeType: "image/jpeg",
                        data: base64Data
                    }
                },
                { text: "辨識圖片中的食材與飲料。回傳名詞陣列 (繁體中文)。" }
            ]
        },
        config: {
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.ARRAY,
                items: { type: Type.STRING }
            }
        }
    });

    const text = response.text || "[]";
    return JSON.parse(text);
  } catch (error) {
    console.error("Gemini Vision Error:", error);
    throw error;
  }
};

export const analyzeMenuFromImage = async (base64Image: string): Promise<AnalyzedMenuResponse> => {
  const ai = getAIClient();

  const prompt = `
    分析圖片中的料理/菜單。
    回傳：menuName, reason, ingredients (Array), steps (Array), videoQuery。
    若圖片內容是飲料或零食包裝，請將名稱列在 ingredients，並將 menuName 設為品項統稱（如：零食、飲料）。
    對於現成飲料點心，ingredients 請直接列出該品項名稱，切勿拆解成製作原料。
  `;

  try {
    const base64Data = base64Image.includes(',') ? base64Image.split(',')[1] : base64Image;

    const response = await ai.models.generateContent({
        model: MODEL_NAME,
        contents: {
            parts: [
                {
                    inlineData: {
                        mimeType: "image/jpeg",
                        data: base64Data
                    }
                },
                { text: prompt }
            ]
        },
        config: {
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    menuName: { type: Type.STRING },
                    reason: { type: Type.STRING },
                    ingredients: { type: Type.ARRAY, items: { type: Type.STRING } },
                    steps: { type: Type.ARRAY, items: { type: Type.STRING } },
                    videoQuery: { type: Type.STRING },
                },
                required: ["menuName", "reason", "ingredients", "steps", "videoQuery"],
            }
        }
    });

    const text = response.text || "{}";
    return JSON.parse(text);
  } catch (error) {
    console.error("Gemini Menu Analysis Error:", error);
    throw error;
  }
};

export const parseMenuItinerary = async (input: string, type: 'text' | 'image'): Promise<ItineraryItem[]> => {
  const ai = getAIClient();

  const promptText = `
    分析露營菜單行程表。
    拆解成多個餐點計畫 (plans)。
    包含: dayLabel, mealType (breakfast/lunch/dinner/snack), menuName, ingredients, reason, steps, videoQuery。
    若內容是飲料、點心、宵夜，請將 mealType 設為 'snack'。
    對於 'snack' 類別，ingredients 請直接列出該品項名稱(例如：'可樂', '洋芋片')，切勿拆解成製作原料(如：'糖', '水', '玉米')。
    若同一餐有多道菜，請務必拆開成多個 plan。
  `;

  try {
    const parts: any[] = [];
    
    if (type === 'image') {
        const base64Data = input.includes(',') ? input.split(',')[1] : input;
        parts.push({
            inlineData: {
                mimeType: "image/jpeg",
                data: base64Data
            }
        });
        parts.push({ text: promptText });
    } else {
        parts.push({ text: `${promptText}\n內容:\n${input}` });
    }

    const response = await ai.models.generateContent({
        model: MODEL_NAME,
        contents: { parts },
        config: {
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    plans: {
                        type: Type.ARRAY,
                        items: {
                            type: Type.OBJECT,
                            properties: {
                                dayLabel: { type: Type.STRING },
                                mealType: { type: Type.STRING, enum: ['breakfast', 'lunch', 'dinner', 'snack'] },
                                menuName: { type: Type.STRING },
                                ingredients: { type: Type.ARRAY, items: { type: Type.STRING } },
                                reason: { type: Type.STRING },
                                steps: { type: Type.ARRAY, items: { type: Type.STRING } },
                                videoQuery: { type: Type.STRING },
                            },
                            required: ["dayLabel", "mealType", "menuName", "ingredients", "steps", "videoQuery", "reason"]
                        }
                    }
                }
            }
        }
    });

    const text = response.text || "{}";
    const json = JSON.parse(text);
    return json.plans || [];
  } catch (error) {
    console.error("Gemini Itinerary Analysis Error:", error);
    throw error;
  }
};