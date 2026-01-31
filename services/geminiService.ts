// FIXED: Updated import to use 'Client' and 'SchemaType' from the new SDK
import { Client, SchemaType } from "@google/genai";
import { ShoppingItem, Recipe } from "../types";

// Helper to get key dynamically
const getApiKey = () => localStorage.getItem('tanuki_gemini_key') || '';

export interface GeneratedMealResponse {
  menuName: string;
  reason: string;
  shoppingList: ShoppingItem[];
  recipe: Recipe;
}

export interface AnalyzedMenuResponse {
  menuName: string;
  reason: string;
  ingredients: string[]; 
  steps: string[];
  videoQuery: string;
}

export interface ItineraryItem {
  dayLabel: string;
  mealType: 'breakfast' | 'lunch' | 'dinner';
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

const getAIClient = () => {
  const apiKey = getApiKey();
  if (!apiKey) throw new Error("尚未設定 API Key，請至設定頁面輸入。");
  // FIXED: Using 'Client' instead of 'GoogleGenAI'
  return new Client({ apiKey });
};

export const generateCampMeal = async (
  ingredients: string[],
  mealType: string,
  adults: number,
  children: number,
  title: string
): Promise<GeneratedMealResponse> => {
  const ai = getAIClient();
  const modelId = "gemini-2.0-flash"; // Updated to latest stable model name if applicable, or keep as desired

  const prompt = `
    角色設定：你是一位專業的露營大廚。
    任務：請為「${mealType}」制定一份詳細的餐點計畫。
    背景：${adults} 大人, ${children} 小孩。
    現有食材：${ingredients.join(', ')}。
    
    目標：
    1. 菜單名稱。
    2. 選擇理由。
    3. 購物清單 (Shopping List)。需購買量 ('buy') 若足夠填 '0'。
    4. 烹飪步驟。
    5. YouTube 關鍵字。

    請回傳 JSON。
  `;

  try {
    const response = await ai.models.generateContent({
      model: modelId,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: SchemaType.OBJECT,
          properties: {
            menuName: { type: SchemaType.STRING },
            reason: { type: SchemaType.STRING },
            shoppingList: {
              type: SchemaType.ARRAY,
              items: {
                type: SchemaType.OBJECT,
                properties: {
                  name: { type: SchemaType.STRING },
                  need: { type: SchemaType.STRING },
                  have: { type: SchemaType.STRING },
                  buy: { type: SchemaType.STRING },
                  checked: { type: SchemaType.BOOLEAN },
                },
                required: ["name", "need", "have", "buy", "checked"]
              },
            },
            recipe: {
              type: SchemaType.OBJECT,
              properties: {
                steps: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
                videoQuery: { type: SchemaType.STRING },
              },
              required: ["steps", "videoQuery"]
            },
          },
          required: ["menuName", "reason", "shoppingList", "recipe"],
        },
      },
    });

    const text = response.text;
    if (!text) throw new Error("AI 沒有回應");
    return JSON.parse(text);
  } catch (error) {
    console.error("Gemini API Error:", error);
    throw error;
  }
};

// New: Leftover Rescue
export const generateLeftoverRecipe = async (
  ingredients: string[]
): Promise<GeneratedMealResponse> => {
  const ai = getAIClient();
  const modelId = "gemini-2.0-flash";
  
  const prompt = `
    角色：露營剩食救星。
    任務：利用剩餘食材做出一道「清冰箱料理」。
    剩餘食材：${ingredients.join(', ')}。
    
    規則：
    1. 盡量只用現有食材，非必要不採買。
    2. 適合撤收前快速烹煮。
    3. 回傳 JSON。
  `;

  try {
    const response = await ai.models.generateContent({
      model: modelId,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: SchemaType.OBJECT,
          properties: {
            menuName: { type: SchemaType.STRING },
            reason: { type: SchemaType.STRING },
            shoppingList: {
              type: SchemaType.ARRAY,
              items: {
                type: SchemaType.OBJECT,
                properties: {
                  name: { type: SchemaType.STRING },
                  need: { type: SchemaType.STRING },
                  have: { type: SchemaType.STRING },
                  buy: { type: SchemaType.STRING }, // Should be 0 mostly
                  checked: { type: SchemaType.BOOLEAN },
                },
                required: ["name", "need", "have", "buy", "checked"]
              },
            },
            recipe: {
              type: SchemaType.OBJECT,
              properties: {
                steps: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
                videoQuery: { type: SchemaType.STRING },
              },
              required: ["steps", "videoQuery"]
            },
          },
          required: ["menuName", "reason", "shoppingList", "recipe"],
        },
      },
    });

    const text = response.text;
    if (!text) throw new Error("AI 沒有回應");
    return JSON.parse(text);
  } catch (error) {
    console.error("Leftover API Error:", error);
    throw error;
  }
};

export const generateDishRecipe = async (dishName: string): Promise<SingleDishResponse> => {
  const ai = getAIClient();
  const modelId = "gemini-2.0-flash";

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
      model: modelId,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: SchemaType.OBJECT,
          properties: {
            dishName: { type: SchemaType.STRING },
            description: { type: SchemaType.STRING },
            ingredients: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
            steps: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
            videoQuery: { type: SchemaType.STRING },
          },
          required: ["dishName", "description", "ingredients", "steps", "videoQuery"],
        },
      }
    });

    const text = response.text;
    if (!text) throw new Error("AI 無法生成");
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
    const modelId = "gemini-2.0-flash";

    const prompt = `
      角色：資深露營教練。
      地點：${location}。
      天氣：${weather}。
      目前裝備清單：${currentGear.join(', ')}。

      任務：
      1. 分析天氣與地點，找出目前清單中「缺少」的重要裝備。
      2. 建議 3-5 項新增裝備。
      3. 每項建議需說明理由 (reason) 並標示優先度 (priority: high/medium/low)。
      
      請回傳 JSON 陣列。
    `;

    try {
        const response = await ai.models.generateContent({
            model: modelId,
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: SchemaType.ARRAY,
                    items: {
                        type: SchemaType.OBJECT,
                        properties: {
                            item: { type: SchemaType.STRING },
                            reason: { type: SchemaType.STRING },
                            priority: { type: SchemaType.STRING, enum: ['high', 'medium', 'low'] }
                        },
                        required: ["item", "reason", "priority"]
                    }
                }
            }
        });
        
        const text = response.text;
        if (!text) return [];
        return JSON.parse(text);
    } catch (error) {
        console.error("Gear Advisor Error:", error);
        throw error;
    }
}

export const identifyIngredientsFromImage = async (base64Image: string): Promise<string[]> => {
  const ai = getAIClient();
  const modelId = "gemini-2.0-flash";

  try {
    const response = await ai.models.generateContent({
      model: modelId,
      contents: {
        parts: [
          { inlineData: { mimeType: "image/jpeg", data: base64Image } },
          { text: "辨識圖片中的食材與飲料。回傳 JSON Array 字串陣列 (繁體中文)。" }
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: SchemaType.ARRAY,
          items: { type: SchemaType.STRING }
        }
      }
    });

    const text = response.text;
    if (!text) return [];
    return JSON.parse(text);
  } catch (error) {
    console.error("Gemini Vision Error:", error);
    throw error;
  }
};

export const analyzeMenuFromImage = async (base64Image: string): Promise<AnalyzedMenuResponse> => {
  const ai = getAIClient();
  const modelId = "gemini-2.0-flash";

  const prompt = `
    分析圖片中的料理/菜單。
    回傳：menuName, reason, ingredients (Array), steps (Array), videoQuery。
  `;

  try {
    const response = await ai.models.generateContent({
      model: modelId,
      contents: {
        parts: [
          { inlineData: { mimeType: "image/jpeg", data: base64Image } },
          { text: prompt }
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: SchemaType.OBJECT,
          properties: {
            menuName: { type: SchemaType.STRING },
            reason: { type: SchemaType.STRING },
            ingredients: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
            steps: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
            videoQuery: { type: SchemaType.STRING },
          },
          required: ["menuName", "reason", "ingredients", "steps", "videoQuery"],
        },
      }
    });

    const text = response.text;
    if (!text) throw new Error("AI 無法分析");
    return JSON.parse(text);
  } catch (error) {
    console.error("Gemini Menu Analysis Error:", error);
    throw error;
  }
};

export const parseMenuItinerary = async (input: string, type: 'text' | 'image'): Promise<ItineraryItem[]> => {
  const ai = getAIClient();
  const modelId = "gemini-2.0-flash";

  const promptText = `
    分析露營菜單行程表。
    拆解成多個餐點計畫 (plans)。
    包含: dayLabel, mealType, menuName, ingredients, reason, steps, videoQuery。
    若同一餐有多道菜，請拆開。
  `;

  const contents = type === 'text' 
    ? { parts: [{ text: promptText }, { text: `內容:\n${input}` }] }
    : { parts: [{ inlineData: { mimeType: "image/jpeg", data: input } }, { text: promptText }] };

  try {
    const response = await ai.models.generateContent({
      model: modelId,
      contents: contents,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: SchemaType.OBJECT,
          properties: {
            plans: {
              type: SchemaType.ARRAY,
              items: {
                type: SchemaType.OBJECT,
                properties: {
                  dayLabel: { type: SchemaType.STRING },
                  mealType: { type: SchemaType.STRING, enum: ['breakfast', 'lunch', 'dinner'] },
                  menuName: { type: SchemaType.STRING },
                  ingredients: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
                  reason: { type: SchemaType.STRING },
                  steps: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
                  videoQuery: { type: SchemaType.STRING },
                },
                required: ["dayLabel", "mealType", "menuName", "ingredients", "steps", "videoQuery", "reason"]
              }
            }
          }
        },
      }
    });

    const text = response.text;
    if (!text) throw new Error("AI 無法分析");
    const result = JSON.parse(text);
    return result.plans || [];
  } catch (error) {
    console.error("Gemini Itinerary Analysis Error:", error);
    throw error;
  }
};
