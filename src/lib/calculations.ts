import type {
  CurrencyCode,
  Ingredient,
  ProcurementPlanItem,
  RecipeWithDetails,
} from "@/types/pastry";
import { CURRENCIES } from "@/types/pastry";

/**
 * Diameter scaling coefficient: (targetDiameter / baseDiameter)^2
 * For baseDiameter = 16:
 * 10->0.39, 12->0.56, 14->0.77, 16->1.00, 18->1.27, 20->1.56, 22->1.89, 24->2.25, 26->2.64
 */
export function getDiameterCoefficient(
  targetDiameter: number,
  baseDiameter: number = 16
): number {
  if (baseDiameter <= 0 || targetDiameter <= 0) return 1;
  return Math.pow(targetDiameter / baseDiameter, 2);
}

export function roundGrams(grams: number): number {
  if (grams < 10) return Math.round(grams * 10) / 10;
  return Math.round(grams);
}

export function roundMoney(amount: number): number {
  return Math.round(amount * 100) / 100;
}

export function formatMoney(
  amount: number,
  currency: CurrencyCode = "UAH"
): string {
  const cfg = CURRENCIES[currency] ?? CURRENCIES.UAH;
  const safe = Number.isFinite(amount) ? amount : 0;
  const formatted = new Intl.NumberFormat("uk-UA", {
    minimumFractionDigits: safe % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(roundMoney(safe));
  return cfg.position === "before"
    ? `${cfg.symbol}${formatted}`
    : `${formatted} ${cfg.symbol}`;
}

export function formatWeight(grams: number): string {
  const safe = Number.isFinite(grams) ? grams : 0;
  if (safe >= 1000) {
    const kg = Math.round((safe / 1000) * 100) / 100;
    return `${kg} кг`;
  }
  return `${roundGrams(safe)} г`;
}

export function formatWeightDetailed(grams: number): string {
  const safe = Number.isFinite(grams) ? grams : 0;
  if (safe >= 1000) {
    const kg = Math.round((safe / 1000) * 100) / 100;
    return `${kg} кг (${Math.round(safe)} г)`;
  }
  return `${roundGrams(safe)} г`;
}

export interface CalculatedIngredientLine {
  id: number;
  ingredientId: number;
  name: string;
  pricePerKg: number;
  baseGrams: number;
  scaledGrams: number;
  cost: number;
}

export interface CalculatedComponent {
  id: number;
  name: string;
  sortOrder: number;
  lines: CalculatedIngredientLine[];
  totalGrams: number;
  totalCost: number;
}

export interface AggregatedIngredient {
  ingredientId: number;
  name: string;
  pricePerKg: number;
  totalGrams: number;
  totalCost: number;
  ingredient: Ingredient;
}

export interface RecipeCalculationResult {
  diameter: number;
  coefficient: number;
  components: CalculatedComponent[];
  aggregated: AggregatedIngredient[];
  totalRawWeightGrams: number;
  estimatedFinishedWeightGrams: number;
  scaledPortionsCount: number;
  totalCost: number;
  markupPercent: number;
  sellingPrice: number;
  netProfit: number;
  costPerKg: number;
  pricePerKg: number;
  costPerPortion: number;
  pricePerPortion: number;
}

export function calculateRecipe(
  recipe: RecipeWithDetails,
  targetDiameter?: number,
  overrideMarkupPercent?: number
): RecipeCalculationResult {
  const diameter = targetDiameter ?? recipe.baseDiameter ?? 16;
  const baseDiameter = recipe.baseDiameter || 16;
  const coefficient = getDiameterCoefficient(diameter, baseDiameter);
  const markupPercent =
    overrideMarkupPercent !== undefined
      ? overrideMarkupPercent
      : recipe.defaultMarkupPercent;

  const aggregatedMap = new Map<number, AggregatedIngredient>();

  const components: CalculatedComponent[] = [...recipe.components]
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((comp) => {
      let compGrams = 0;
      let compCost = 0;

      const lines: CalculatedIngredientLine[] = comp.ingredients.map((item) => {
        const scaledGrams = item.baseGrams * coefficient;
        const cost = (scaledGrams / 1000) * item.ingredient.pricePerKg;
        compGrams += scaledGrams;
        compCost += cost;

        const existing = aggregatedMap.get(item.ingredientId);
        if (existing) {
          existing.totalGrams += scaledGrams;
          existing.totalCost += cost;
        } else {
          aggregatedMap.set(item.ingredientId, {
            ingredientId: item.ingredientId,
            name: item.ingredient.name,
            pricePerKg: item.ingredient.pricePerKg,
            totalGrams: scaledGrams,
            totalCost: cost,
            ingredient: item.ingredient,
          });
        }

        return {
          id: item.id,
          ingredientId: item.ingredientId,
          name: item.ingredient.name,
          pricePerKg: item.ingredient.pricePerKg,
          baseGrams: item.baseGrams,
          scaledGrams,
          cost,
        };
      });

      return {
        id: comp.id,
        name: comp.name,
        sortOrder: comp.sortOrder,
        lines,
        totalGrams: compGrams,
        totalCost: compCost,
      };
    });

  const aggregated = Array.from(aggregatedMap.values()).sort(
    (a, b) => b.totalCost - a.totalCost
  );

  const totalRawWeightGrams = components.reduce(
    (sum, c) => sum + c.totalGrams,
    0
  );
  const totalCost = components.reduce((sum, c) => sum + c.totalCost, 0);

  const estimatedFinishedWeightGrams =
    recipe.finishedWeightGrams > 0
      ? recipe.finishedWeightGrams * coefficient
      : totalRawWeightGrams;

  const scaledPortionsCount = Math.max(
    1,
    Math.round((recipe.portionsCount || 8) * coefficient)
  );

  const sellingPrice = totalCost * (1 + markupPercent / 100);
  const netProfit = sellingPrice - totalCost;

  const weightKg = estimatedFinishedWeightGrams / 1000;
  const costPerKg = weightKg > 0 ? totalCost / weightKg : 0;
  const pricePerKg = weightKg > 0 ? sellingPrice / weightKg : 0;

  const costPerPortion =
    scaledPortionsCount > 0 ? totalCost / scaledPortionsCount : 0;
  const pricePerPortion =
    scaledPortionsCount > 0 ? sellingPrice / scaledPortionsCount : 0;

  return {
    diameter,
    coefficient,
    components,
    aggregated,
    totalRawWeightGrams,
    estimatedFinishedWeightGrams,
    scaledPortionsCount,
    totalCost,
    markupPercent,
    sellingPrice,
    netProfit,
    costPerKg,
    pricePerKg,
    costPerPortion,
    pricePerPortion,
  };
}

export interface ShoppingListItem {
  ingredientId: number;
  name: string;
  pricePerKg: number;
  totalGrams: number;
  estimatedCost: number;
}

export function calculateProcurementList(
  items: ProcurementPlanItem[],
  recipes: RecipeWithDetails[]
): {
  shoppingList: ShoppingListItem[];
  totalBudget: number;
  totalWeightGrams: number;
  totalCakesCount: number;
} {
  const recipeMap = new Map(recipes.map((r) => [r.id, r]));
  const map = new Map<number, ShoppingListItem>();
  let totalCakesCount = 0;

  for (const planItem of items) {
    if (planItem.quantity <= 0) continue;
    const recipe = recipeMap.get(planItem.recipe_id);
    if (!recipe) continue;

    totalCakesCount += planItem.quantity;
    const calc = calculateRecipe(recipe, planItem.diameter);

    for (const agg of calc.aggregated) {
      const grams = agg.totalGrams * planItem.quantity;
      const cost = agg.totalCost * planItem.quantity;
      const existing = map.get(agg.ingredientId);
      if (existing) {
        existing.totalGrams += grams;
        existing.estimatedCost += cost;
      } else {
        map.set(agg.ingredientId, {
          ingredientId: agg.ingredientId,
          name: agg.name,
          pricePerKg: agg.pricePerKg,
          totalGrams: grams,
          estimatedCost: cost,
        });
      }
    }
  }

  const shoppingList = Array.from(map.values()).sort((a, b) =>
    a.name.localeCompare(b.name, "uk")
  );
  const totalBudget = shoppingList.reduce((s, i) => s + i.estimatedCost, 0);
  const totalWeightGrams = shoppingList.reduce((s, i) => s + i.totalGrams, 0);

  return {
    shoppingList,
    totalBudget,
    totalWeightGrams,
    totalCakesCount,
  };
}

export interface KbjuItem {
  grams: number;
  calories100g: number;
  protein100g: number;
  fat100g: number;
  carbs100g: number;
}

export interface KbjuSummary {
  totalRawGrams: number;
  finishedWeightGrams: number;
  portionWeightGrams: number;
  total: { calories: number; protein: number; fat: number; carbs: number };
  per100g: { calories: number; protein: number; fat: number; carbs: number };
  perPortion: { calories: number; protein: number; fat: number; carbs: number };
}

export function calculateKbju(
  items: KbjuItem[],
  finishedWeightGrams: number,
  portionWeightGrams: number
): KbjuSummary {
  const totalRawGrams = items.reduce((s, i) => s + Math.max(0, i.grams), 0);
  const effectiveWeight =
    finishedWeightGrams > 0 ? finishedWeightGrams : totalRawGrams;
  const effectivePortion = portionWeightGrams > 0 ? portionWeightGrams : 100;

  const total = items.reduce(
    (acc, item) => {
      const factor = Math.max(0, item.grams) / 100;
      acc.calories += factor * (item.calories100g || 0);
      acc.protein += factor * (item.protein100g || 0);
      acc.fat += factor * (item.fat100g || 0);
      acc.carbs += factor * (item.carbs100g || 0);
      return acc;
    },
    { calories: 0, protein: 0, fat: 0, carbs: 0 }
  );

  const ratio100 = effectiveWeight > 0 ? 100 / effectiveWeight : 0;
  const ratioPortion = effectiveWeight > 0 ? effectivePortion / effectiveWeight : 0;

  const r1 = (v: number) => Math.round(v * 10) / 10;

  return {
    totalRawGrams,
    finishedWeightGrams: effectiveWeight,
    portionWeightGrams: effectivePortion,
    total: {
      calories: Math.round(total.calories),
      protein: r1(total.protein),
      fat: r1(total.fat),
      carbs: r1(total.carbs),
    },
    per100g: {
      calories: Math.round(total.calories * ratio100),
      protein: r1(total.protein * ratio100),
      fat: r1(total.fat * ratio100),
      carbs: r1(total.carbs * ratio100),
    },
    perPortion: {
      calories: Math.round(total.calories * ratioPortion),
      protein: r1(total.protein * ratioPortion),
      fat: r1(total.fat * ratioPortion),
      carbs: r1(total.carbs * ratioPortion),
    },
  };
}

export type PanShape = "circle" | "square" | "rectangle";

export interface PanSpec {
  shape: PanShape;
  diameter: number;
  width: number;
  length: number;
  height: number;
}

export function getPanVolume(pan: PanSpec): number {
  const h = pan.height > 0 ? pan.height : 1;
  if (pan.shape === "circle") {
    const r = Math.max(0, pan.diameter) / 2;
    return Math.PI * r * r * h;
  }
  if (pan.shape === "square") {
    const a = Math.max(0, pan.width);
    return a * a * h;
  }
  return Math.max(0, pan.width) * Math.max(0, pan.length) * h;
}

export function getPanRatio(source: PanSpec, target: PanSpec): number {
  const v1 = getPanVolume(source);
  const v2 = getPanVolume(target);
  if (v1 <= 0 || v2 <= 0) return 1;
  return v2 / v1;
}

/**
 * Recalculates quantities inside free-form recipe text while ignoring
 * percentages (33%, 82.5%) and temperatures (180°C).
 */
export function scaleRecipeText(text: string, factor: number): string {
  if (!text.trim() || !Number.isFinite(factor) || factor <= 0) return text;

  const lines = text.split("\n");
  return lines
    .map((line) => {
      // Match numbers optionally followed by units, excluding percentages and temperatures
      return line.replace(
        /(\d+(?:[.,]\d+)?)\s*(%|°[CcСс]?|кг|г|гр|мл|л|шт|ст\.?\s*л\.?|ч\.?\s*л\.?)?/gi,
        (match, numStr: string, unit?: string) => {
          const trimmedUnit = (unit ?? "").trim();
          if (trimmedUnit === "%" || trimmedUnit.startsWith("°")) {
            return match;
          }
          // Skip numbers that look like fat percentages attached to words if no unit and followed by %
          const val = parseFloat(numStr.replace(",", "."));
          if (!Number.isFinite(val)) return match;
          const scaled = val * factor;
          const formatted =
            scaled < 10
              ? String(Math.round(scaled * 10) / 10)
              : String(Math.round(scaled));
          return unit ? `${formatted} ${trimmedUnit}` : formatted;
        }
      );
    })
    .join("\n");
}
