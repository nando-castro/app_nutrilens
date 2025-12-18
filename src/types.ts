// src/types.ts

// Telas da aplicação
export type Screen = "login" | "register" | "analyze" | "history";

// Tipo de refeição
export type MealType =
  | "breakfast"
  | "lunch"
  | "snack"
  | "dinner"
  | "supper"
  | "other";

export type User = {
  id: string;
  name: string;
  email: string;
};

// Item como será persistido em SavedMeal
export type SavedMealItem = {
  id: string;
  name: string;
  grams: number;
  kcalPer100g: number;
  calories: number;
  confidence?: number;
  source: "vision" | "manual";
};

// Tipo usado na tela de análise (UI).
// Mantém campos em português para não quebrar seu código,
// mas é bem fácil mapear para SavedMealItem.
export type FoodItemUI = {
  id: string;
  nome: string;
  quantidadeGramas: number;
  kcalPor100g: number;
  confianca?: number;
  origem: "vision" | "manual";
};

export type SavedMeal = {
  id: string;
  userId: string;
  mealType: MealType;
  dateTime: string; // quando a refeição aconteceu
  totalCalories: number;
  photoUrl?: string;
  createdAt: string; // quando foi salva
  photoDataUrl?: string;
  items: SavedMealItem[];
};
