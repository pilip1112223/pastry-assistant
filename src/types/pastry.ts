export interface Ingredient {
  id: number;
  name: string;
  pricePerKg: number;
  calories100g: number;
  protein100g: number;
  fat100g: number;
  carbs100g: number;
  updatedAt: string;
}

export interface ComponentIngredientInput {
  id?: number;
  ingredientId: number;
  baseGrams: number;
}

export interface ComponentIngredientWithDetails {
  id: number;
  componentId: number;
  ingredientId: number;
  baseGrams: number;
  ingredient: Ingredient;
}

export interface RecipeComponentInput {
  id?: number;
  name: string;
  sortOrder: number;
  ingredients: ComponentIngredientInput[];
}

export interface RecipeComponentWithDetails {
  id: number;
  recipeId: number;
  name: string;
  sortOrder: number;
  ingredients: ComponentIngredientWithDetails[];
}

export interface RecipeWithDetails {
  id: number;
  name: string;
  baseDiameter: number;
  baseHeight: number;
  defaultMarkupPercent: number;
  portionsCount: number;
  finishedWeightGrams: number;
  createdAt: string;
  components: RecipeComponentWithDetails[];
}

export interface RecipeInput {
  name: string;
  baseDiameter: number;
  baseHeight: number;
  defaultMarkupPercent: number;
  portionsCount: number;
  finishedWeightGrams: number;
  components: RecipeComponentInput[];
}

export interface ProcurementPlanItem {
  recipe_id: number;
  diameter: number;
  quantity: number;
}

export interface ProcurementPlan {
  id: number;
  name: string;
  itemsJson: ProcurementPlanItem[];
  updatedAt: string;
}

export type CurrencyCode = "UAH" | "USD" | "EUR" | "PLN";

export interface CurrencyConfig {
  code: CurrencyCode;
  symbol: string;
  label: string;
  position: "after" | "before";
}

export const CURRENCIES: Record<CurrencyCode, CurrencyConfig> = {
  UAH: { code: "UAH", symbol: "грн", label: "Украинская гривна (грн)", position: "after" },
  USD: { code: "USD", symbol: "$", label: "Доллар США ($)", position: "before" },
  EUR: { code: "EUR", symbol: "€", label: "Евро (€)", position: "before" },
  PLN: { code: "PLN", symbol: "zł", label: "Польский злотый (zł)", position: "after" },
};

export const DIAMETERS = [10, 12, 14, 16, 18, 20, 22, 24, 26] as const;
