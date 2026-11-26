export type IngredientUnitType = "weight" | "volume" | "piece";

export interface Ingredient {
  id: number;
  userId?: string;
  name: string;
  unitType: IngredientUnitType;
  /**
   * Price per base billing unit:
   * - "weight": price per 1 kg (1000 g)
   * - "volume": price per 1 l (1000 ml)
   * - "piece": price per 1 piece (1 шт)
   */
  pricePerKg: number;
  /**
   * Optional weight of 1 piece in grams (used when unitType === "piece"
   * for accurate total cake weight and KBJU calculation).
   */
  unitWeightGrams: number;
  calories100g: number;
  protein100g: number;
  fat100g: number;
  carbs100g: number;
  updatedAt: string;
}

export interface ComponentIngredientInput {
  id?: number;
  ingredientId: number;
  /**
   * Quantity in base recipe unit:
   * - "weight": grams (г)
   * - "volume": milliliters (мл)
   * - "piece": pieces (шт)
   */
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
  userId?: string;
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
  userId?: string;
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
  UAH: { code: "UAH", symbol: "грн", label: "Українська гривня (грн)", position: "after" },
  USD: { code: "USD", symbol: "$", label: "Долар США ($)", position: "before" },
  EUR: { code: "EUR", symbol: "€", label: "Євро (€)", position: "before" },
  PLN: { code: "PLN", symbol: "zł", label: "Польський злотий (zł)", position: "after" },
};

export const DIAMETERS = [10, 12, 14, 16, 18, 20, 22, 24, 26] as const;
