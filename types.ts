import { LucideIcon } from 'lucide-react';

export interface User {
  id: string;
  name: string;
  avatar: string;
  isAdmin?: boolean;
  headcount?: number; // New: Number of people this user represents (default 1)
}

export interface TripInfo {
  title: string;
  date: string;
  location: string;
  weather: {
    temp: string; // Can be a single val "25" or range "18-25"
    cond: string;
    advice?: string; // New: Weather advice
  };
  weatherUrl?: string; // New: Custom URL for weather forecast
  albumUrl?: string; 
}

export interface GearItem {
  id: number;
  name: string;
  category: 'public' | 'personal';
  owner: { id: string; name: string } | null;
  required: boolean;
  status?: 'pending' | 'packed';
  isCustom?: boolean;
}

export interface Ingredient {
  id: number;
  name: string;
  selected: boolean;
  usedInPlanId: number | null;
  owner: { id: string; name: string; avatar: string };
}

export interface ShoppingItem {
  name: string;
  need: string;
  have: string;
  buy: string;
  checked: boolean;
}

export interface Recipe {
  steps: string[];
  videoQuery: string;
}

export interface CheckItem {
  id: string;
  name: string;
  checked: boolean;
  owner: { name: string; avatar: string } | null; // null means "Buy/Custom"
  sourceIngredientId: number | null; // Links back to inventory
}

export interface MealPlan {
  id: number;
  dayLabel: string; // e.g. "第一天", "Day 1"
  mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack'; // Added 'snack'
  title: string;
  menuName: string;
  reason: string;
  checklist: CheckItem[];
  notes: string;
  recipe: Recipe;
}

export interface Bill {
  id: number;
  payerId: string;
  item: string;
  amount: number;
  date: string;
}

export type TabType = 'gear' | 'kitchen' | 'menu' | 'check' | 'album' | 'bill';