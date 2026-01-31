import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";
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

// 建立一個 Helper 函式來初始化模型，避免重複代碼
const getAIModel = (responseSchema?: any) => {
  const apiKey = getApiKey();
  if (!apiKey) throw new Error("尚未設定 API Key，請至設定頁面輸入。");
  
  const genAI = new GoogleGenerativeAI(apiKey);
  const modelId = "gemini-1.5-flash"; // 使用穩定且快速的模型

  return genAI.getGenerativeModel({
    model: modelId,
    generationConfig: {
      responseMimeType: responseSchema ? "application/json" : "text/plain",
      responseSchema: responseSchema,
    },
  });
};

export const generateCampMeal = async (
  ingredients: string[],
  mealType: string,
  adults: number,
  children: number,
  title: string
): Promise<GeneratedMealResponse> => {
  
  const schema = {
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
  };

  const model = getAIModel(schema);
  
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
    const result = await model.generateContent(prompt);
    const text = result.response.text();
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
  
  const schema = {
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
  };

  const model = getAIModel(schema);
  
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
    const result = await model.generateContent(prompt);
    const text = result.response.text();
    return JSON.parse(text);
  } catch (error) {
    console.error("Leftover API Error:", error);
    throw error;
  }
};

export const generateDishRecipe = async (dishName: string): Promise<SingleDishResponse> => {
  
  const schema = {
    type: SchemaType.OBJECT,
    properties: {
      dishName: { type: SchemaType.STRING },
      description: { type: SchemaType.STRING },
      ingredients: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
      steps: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
      videoQuery: { type: SchemaType.STRING },
    },
    required: ["dishName", "description", "ingredients", "steps", "videoQuery"],
  };

  const model = getAIModel(schema);

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
    const result = await model.generateContent(prompt);
    const text = result.response.text();
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
    
    const schema = {
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
    };

    const model = getAIModel(schema);

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
        const result = await model.generateContent(prompt);
        const text = result.response.text();
        // 有時候模型會回傳 Markdown code block，做個簡單過濾
        const cleanText = text.replace(/```json|```/g, "").trim();
        return JSON.parse(cleanText);
    } catch (error) {
        console.error("Gear Advisor Error:", error);
        throw error;
    }
}

export const identifyIngredientsFromImage = async (base64Image: string): Promise<string[]> => {
  const schema = {
    type: SchemaType.ARRAY,
    items: { type: SchemaType.STRING }
  };

  const model = getAIModel(schema);

  try {
    // 移除 base64 的前綴 (data:image/jpeg;base64,) 如果有的話，只保留數據部分
    const base64Data = base64Image.includes(',') ? base64Image.split(',')[1] : base64Image;

    const result = await model.generateContent([
        { 
            inlineData: { 
                mimeType: "image/jpeg", 
                data: base64Data 
            } 
        },
        { text: "辨識圖片中的食材與飲料。回傳 JSON Array 字串陣列 (繁體中文)。" }
    ]);

    const text = result.response.text();
    return JSON.parse(text);
  } catch (error) {
    console.error("Gemini Vision Error:", error);
    throw error;
  }
};

export const analyzeMenuFromImage = async (base64Image: string): Promise<AnalyzedMenuResponse> => {
  const schema = {
    type: SchemaType.OBJECT,
    properties: {
      menuName: { type: SchemaType.STRING },
      reason: { type: SchemaType.STRING },
      ingredients: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
      steps: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
      videoQuery: { type: SchemaType.STRING },
    },
    required: ["menuName", "reason", "ingredients", "steps", "videoQuery"],
  };

  const model = getAIModel(schema);

  const prompt = `
    分析圖片中的料理/菜單。
    回傳：menuName, reason, ingredients (Array), steps (Array), videoQuery。
  `;

  try {
    const base64Data = base64Image.includes(',') ? base64Image.split(',')[1] : base64Image;

    const result = await model.generateContent([
        { 
            inlineData: { 
                mimeType: "image/jpeg", 
                data: base64Data 
            } 
        },
        { text: prompt }
    ]);

    const text = result.response.text();
    return JSON.parse(text);
  } catch (error) {
    console.error("Gemini Menu Analysis Error:", error);
    throw error;
  }
};

export const parseMenuItinerary = async (input: string, type: 'text' | 'image'): Promise<ItineraryItem[]> => {
  const schema = {
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
  };

  const model = getAIModel(schema);

  const promptText = `
    分析露營菜單行程表。
    拆解成多個餐點計畫 (plans)。
    包含: dayLabel, mealType, menuName, ingredients, reason, steps, videoQuery。
    若同一餐有多道菜，請拆開。
  `;

  try {
    let parts: any[] = [{ text: promptText }];

    if (type === 'text') {
        parts.push({ text: `內容:\n${input}` });
    } else {
        const base64Data = input.includes(',') ? input.split(',')[1] : input;
        parts.unshift({ 
            inlineData: { 
                mimeType: "image/jpeg", 
                data: base64Data 
            } 
        });
    }

    const result = await model.generateContent(parts);
    const text = result.response.text();
    const json = JSON.parse(text);
    return json.plans || [];
  } catch (error) {
    console.error("Gemini Itinerary Analysis Error:", error);
    throw error;
  }
};
