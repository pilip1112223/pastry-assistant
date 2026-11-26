import fs from "node:fs";
import path from "node:path";
import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { getDb, hasValidDatabaseUrl } from "@/db";
import {
  componentIngredients,
  ingredients,
  procurementPlans,
  recipeComponents,
  recipes,
} from "@/db/schema";
import type {
  Ingredient,
  IngredientUnitType,
  ProcurementPlan,
  ProcurementPlanItem,
  RecipeInput,
  RecipeWithDetails,
} from "@/types/pastry";

function normalizeUnitType(value?: string | null): IngredientUnitType {
  if (value === "volume" || value === "piece") return value;
  return "weight";
}

/**
 * Local JSON fallback store for previewing the app before Neon DATABASE_URL is configured.
 * Strictly isolated per userId and starts EMPTY on first launch.
 */
interface LocalDbData {
  nextIngredientId: number;
  nextRecipeId: number;
  nextComponentId: number;
  nextComponentIngredientId: number;
  nextPlanId: number;
  ingredients: Array<Ingredient & { userId: string }>;
  recipes: Array<{
    id: number;
    userId: string;
    name: string;
    baseDiameter: number;
    baseHeight: number;
    defaultMarkupPercent: number;
    portionsCount: number;
    finishedWeightGrams: number;
    createdAt: string;
    components: Array<{
      id: number;
      recipeId: number;
      name: string;
      sortOrder: number;
      ingredients: Array<{
        id: number;
        componentId: number;
        ingredientId: number;
        baseGrams: number;
      }>;
    }>;
  }>;
  procurementPlans: Array<ProcurementPlan & { userId: string }>;
}

const LOCAL_DATA_DIR = path.join(process.cwd(), ".local-data");
const LOCAL_DB_PATH = path.join(LOCAL_DATA_DIR, "pastry-db.json");

function createEmptyLocalDb(): LocalDbData {
  return {
    nextIngredientId: 1,
    nextRecipeId: 1,
    nextComponentId: 1,
    nextComponentIngredientId: 1,
    nextPlanId: 1,
    ingredients: [],
    recipes: [],
    procurementPlans: [],
  };
}

function readLocalDb(): LocalDbData {
  try {
    if (!fs.existsSync(LOCAL_DB_PATH)) {
      fs.mkdirSync(LOCAL_DATA_DIR, { recursive: true });
      const empty = createEmptyLocalDb();
      fs.writeFileSync(LOCAL_DB_PATH, JSON.stringify(empty, null, 2), "utf8");
      return empty;
    }
    const raw = fs.readFileSync(LOCAL_DB_PATH, "utf8");
    const parsed = JSON.parse(raw) as LocalDbData;
    return {
      ...createEmptyLocalDb(),
      ...parsed,
      ingredients: (parsed.ingredients ?? []).map((i) => ({
        ...i,
        userId: i.userId || "legacy",
        unitType: normalizeUnitType(i.unitType),
        unitWeightGrams: Number(i.unitWeightGrams) || 0,
      })),
      recipes: (parsed.recipes ?? []).map((r) => ({
        ...r,
        userId: r.userId || "legacy",
      })),
      procurementPlans: (parsed.procurementPlans ?? []).map((p) => ({
        ...p,
        userId: p.userId || "legacy",
      })),
    };
  } catch {
    return createEmptyLocalDb();
  }
}

function writeLocalDb(data: LocalDbData): void {
  fs.mkdirSync(LOCAL_DATA_DIR, { recursive: true });
  fs.writeFileSync(LOCAL_DB_PATH, JSON.stringify(data, null, 2), "utf8");
}

function hydrateLocalRecipe(
  raw: LocalDbData["recipes"][number],
  ingredientMap: Map<number, Ingredient>
): RecipeWithDetails {
  return {
    id: raw.id,
    userId: raw.userId,
    name: raw.name,
    baseDiameter: raw.baseDiameter,
    baseHeight: raw.baseHeight,
    defaultMarkupPercent: raw.defaultMarkupPercent,
    portionsCount: raw.portionsCount,
    finishedWeightGrams: raw.finishedWeightGrams,
    createdAt: raw.createdAt,
    components: raw.components
      .slice()
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((comp) => ({
        id: comp.id,
        recipeId: comp.recipeId,
        name: comp.name,
        sortOrder: comp.sortOrder,
        ingredients: comp.ingredients
          .map((ci) => {
            const ing = ingredientMap.get(ci.ingredientId);
            if (!ing) return null;
            return {
              id: ci.id,
              componentId: ci.componentId,
              ingredientId: ci.ingredientId,
              baseGrams: ci.baseGrams,
              ingredient: ing,
            };
          })
          .filter((x): x is NonNullable<typeof x> => x !== null),
      })),
  };
}

export function getStorageMode(): "neon" | "local" {
  return hasValidDatabaseUrl() ? "neon" : "local";
}

// ==================== INGREDIENTS ====================

export async function listIngredients(userId: string): Promise<Ingredient[]> {
  if (!hasValidDatabaseUrl()) {
    const data = readLocalDb();
    return data.ingredients
      .filter((i) => i.userId === userId)
      .sort((a, b) => a.name.localeCompare(b.name, "uk"));
  }

  const db = getDb();
  const rows = await db
    .select()
    .from(ingredients)
    .where(eq(ingredients.userId, userId))
    .orderBy(asc(ingredients.name));

  return rows.map((r) => ({
    id: r.id,
    userId: r.userId,
    name: r.name,
    unitType: normalizeUnitType(r.unitType),
    pricePerKg: r.pricePerKg,
    unitWeightGrams: r.unitWeightGrams,
    calories100g: r.calories100g,
    protein100g: r.protein100g,
    fat100g: r.fat100g,
    carbs100g: r.carbs100g,
    updatedAt: r.updatedAt.toISOString(),
  }));
}

export async function createIngredient(
  userId: string,
  input: {
    name: string;
    unitType?: IngredientUnitType;
    pricePerKg: number;
    unitWeightGrams?: number;
    calories100g?: number;
    protein100g?: number;
    fat100g?: number;
    carbs100g?: number;
  }
): Promise<Ingredient> {
  const unitType = normalizeUnitType(input.unitType);
  const unitWeightGrams =
    unitType === "piece" ? Math.max(0, Number(input.unitWeightGrams) || 0) : 0;

  if (!hasValidDatabaseUrl()) {
    const data = readLocalDb();
    const item: Ingredient & { userId: string } = {
      id: data.nextIngredientId++,
      userId,
      name: input.name.trim(),
      unitType,
      pricePerKg: Number(input.pricePerKg) || 0,
      unitWeightGrams,
      calories100g: Number(input.calories100g) || 0,
      protein100g: Number(input.protein100g) || 0,
      fat100g: Number(input.fat100g) || 0,
      carbs100g: Number(input.carbs100g) || 0,
      updatedAt: new Date().toISOString(),
    };
    data.ingredients.push(item);
    writeLocalDb(data);
    return item;
  }

  const db = getDb();
  const [created] = await db
    .insert(ingredients)
    .values({
      userId,
      name: input.name.trim(),
      unitType,
      pricePerKg: Number(input.pricePerKg) || 0,
      unitWeightGrams,
      calories100g: Number(input.calories100g) || 0,
      protein100g: Number(input.protein100g) || 0,
      fat100g: Number(input.fat100g) || 0,
      carbs100g: Number(input.carbs100g) || 0,
      updatedAt: new Date(),
    })
    .returning();

  return {
    id: created.id,
    userId: created.userId,
    name: created.name,
    unitType: normalizeUnitType(created.unitType),
    pricePerKg: created.pricePerKg,
    unitWeightGrams: created.unitWeightGrams,
    calories100g: created.calories100g,
    protein100g: created.protein100g,
    fat100g: created.fat100g,
    carbs100g: created.carbs100g,
    updatedAt: created.updatedAt.toISOString(),
  };
}

export async function updateIngredient(
  userId: string,
  id: number,
  input: {
    name?: string;
    unitType?: IngredientUnitType;
    pricePerKg?: number;
    unitWeightGrams?: number;
    calories100g?: number;
    protein100g?: number;
    fat100g?: number;
    carbs100g?: number;
  }
): Promise<Ingredient | null> {
  if (!hasValidDatabaseUrl()) {
    const data = readLocalDb();
    const existing = data.ingredients.find(
      (i) => i.id === id && i.userId === userId
    );
    if (!existing) return null;
    if (input.name !== undefined) existing.name = input.name.trim();
    if (input.unitType !== undefined) {
      existing.unitType = normalizeUnitType(input.unitType);
      if (existing.unitType !== "piece") {
        existing.unitWeightGrams = 0;
      }
    }
    if (input.pricePerKg !== undefined)
      existing.pricePerKg = Number(input.pricePerKg) || 0;
    if (input.unitWeightGrams !== undefined) {
      existing.unitWeightGrams =
        existing.unitType === "piece"
          ? Math.max(0, Number(input.unitWeightGrams) || 0)
          : 0;
    }
    if (input.calories100g !== undefined)
      existing.calories100g = Number(input.calories100g) || 0;
    if (input.protein100g !== undefined)
      existing.protein100g = Number(input.protein100g) || 0;
    if (input.fat100g !== undefined)
      existing.fat100g = Number(input.fat100g) || 0;
    if (input.carbs100g !== undefined)
      existing.carbs100g = Number(input.carbs100g) || 0;
    existing.updatedAt = new Date().toISOString();
    writeLocalDb(data);
    return existing;
  }

  const db = getDb();
  const nextUnitType =
    input.unitType !== undefined
      ? normalizeUnitType(input.unitType)
      : undefined;

  const [updated] = await db
    .update(ingredients)
    .set({
      ...(input.name !== undefined ? { name: input.name.trim() } : {}),
      ...(nextUnitType !== undefined ? { unitType: nextUnitType } : {}),
      ...(input.pricePerKg !== undefined
        ? { pricePerKg: Number(input.pricePerKg) || 0 }
        : {}),
      ...(input.unitWeightGrams !== undefined
        ? {
            unitWeightGrams:
              nextUnitType && nextUnitType !== "piece"
                ? 0
                : Math.max(0, Number(input.unitWeightGrams) || 0),
          }
        : nextUnitType && nextUnitType !== "piece"
        ? { unitWeightGrams: 0 }
        : {}),
      ...(input.calories100g !== undefined
        ? { calories100g: Number(input.calories100g) || 0 }
        : {}),
      ...(input.protein100g !== undefined
        ? { protein100g: Number(input.protein100g) || 0 }
        : {}),
      ...(input.fat100g !== undefined
        ? { fat100g: Number(input.fat100g) || 0 }
        : {}),
      ...(input.carbs100g !== undefined
        ? { carbs100g: Number(input.carbs100g) || 0 }
        : {}),
      updatedAt: new Date(),
    })
    .where(and(eq(ingredients.id, id), eq(ingredients.userId, userId)))
    .returning();

  if (!updated) return null;
  return {
    id: updated.id,
    userId: updated.userId,
    name: updated.name,
    unitType: normalizeUnitType(updated.unitType),
    pricePerKg: updated.pricePerKg,
    unitWeightGrams: updated.unitWeightGrams,
    calories100g: updated.calories100g,
    protein100g: updated.protein100g,
    fat100g: updated.fat100g,
    carbs100g: updated.carbs100g,
    updatedAt: updated.updatedAt.toISOString(),
  };
}

export async function deleteIngredient(
  userId: string,
  id: number
): Promise<boolean> {
  if (!hasValidDatabaseUrl()) {
    const data = readLocalDb();
    const before = data.ingredients.length;
    data.ingredients = data.ingredients.filter(
      (i) => !(i.id === id && i.userId === userId)
    );
    if (data.ingredients.length === before) return false;
    for (const r of data.recipes) {
      if (r.userId !== userId) continue;
      for (const c of r.components) {
        c.ingredients = c.ingredients.filter((ci) => ci.ingredientId !== id);
      }
    }
    writeLocalDb(data);
    return true;
  }

  const db = getDb();
  const deleted = await db
    .delete(ingredients)
    .where(and(eq(ingredients.id, id), eq(ingredients.userId, userId)))
    .returning();
  return deleted.length > 0;
}

// ==================== RECIPES ====================

export async function listRecipes(
  userId: string
): Promise<RecipeWithDetails[]> {
  if (!hasValidDatabaseUrl()) {
    const data = readLocalDb();
    const ingMap = new Map(
      data.ingredients
        .filter((i) => i.userId === userId)
        .map((i) => [i.id, i])
    );
    return data.recipes
      .filter((r) => r.userId === userId)
      .sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      )
      .map((r) => hydrateLocalRecipe(r, ingMap));
  }

  const db = getDb();
  const [recipeRows, ingRows] = await Promise.all([
    db
      .select()
      .from(recipes)
      .where(eq(recipes.userId, userId))
      .orderBy(desc(recipes.createdAt)),
    db.select().from(ingredients).where(eq(ingredients.userId, userId)),
  ]);

  if (recipeRows.length === 0) {
    return [];
  }

  const recipeIds = recipeRows.map((r) => r.id);
  const componentRows = await db
    .select()
    .from(recipeComponents)
    .where(inArray(recipeComponents.recipeId, recipeIds))
    .orderBy(asc(recipeComponents.sortOrder));

  const componentIds = componentRows.map((c) => c.id);
  const ciRows =
    componentIds.length > 0
      ? await db
          .select()
          .from(componentIngredients)
          .where(inArray(componentIngredients.componentId, componentIds))
      : [];

  const ingMap = new Map<number, Ingredient>(
    ingRows.map((i) => [
      i.id,
      {
        id: i.id,
        userId: i.userId,
        name: i.name,
        unitType: normalizeUnitType(i.unitType),
        pricePerKg: i.pricePerKg,
        unitWeightGrams: i.unitWeightGrams,
        calories100g: i.calories100g,
        protein100g: i.protein100g,
        fat100g: i.fat100g,
        carbs100g: i.carbs100g,
        updatedAt: i.updatedAt.toISOString(),
      },
    ])
  );

  const ciByComp = new Map<number, typeof ciRows>();
  for (const ci of ciRows) {
    const arr = ciByComp.get(ci.componentId) ?? [];
    arr.push(ci);
    ciByComp.set(ci.componentId, arr);
  }

  const compsByRecipe = new Map<number, typeof componentRows>();
  for (const c of componentRows) {
    const arr = compsByRecipe.get(c.recipeId) ?? [];
    arr.push(c);
    compsByRecipe.set(c.recipeId, arr);
  }

  return recipeRows.map((r) => ({
    id: r.id,
    userId: r.userId,
    name: r.name,
    baseDiameter: r.baseDiameter,
    baseHeight: r.baseHeight,
    defaultMarkupPercent: r.defaultMarkupPercent,
    portionsCount: r.portionsCount,
    finishedWeightGrams: r.finishedWeightGrams,
    createdAt: r.createdAt.toISOString(),
    components: (compsByRecipe.get(r.id) ?? []).map((comp) => ({
      id: comp.id,
      recipeId: comp.recipeId,
      name: comp.name,
      sortOrder: comp.sortOrder,
      ingredients: (ciByComp.get(comp.id) ?? [])
        .map((ci) => {
          const ing = ingMap.get(ci.ingredientId);
          if (!ing) return null;
          return {
            id: ci.id,
            componentId: ci.componentId,
            ingredientId: ci.ingredientId,
            baseGrams: ci.baseGrams,
            ingredient: ing,
          };
        })
        .filter((x): x is NonNullable<typeof x> => x !== null),
    })),
  }));
}

export async function getRecipeById(
  userId: string,
  id: number
): Promise<RecipeWithDetails | null> {
  const all = await listRecipes(userId);
  return all.find((r) => r.id === id) ?? null;
}

export async function createRecipe(
  userId: string,
  input: RecipeInput
): Promise<RecipeWithDetails> {
  if (!hasValidDatabaseUrl()) {
    const data = readLocalDb();
    const ownedIngIds = new Set(
      data.ingredients.filter((i) => i.userId === userId).map((i) => i.id)
    );
    const recipeId = data.nextRecipeId++;
    const createdRaw: LocalDbData["recipes"][number] = {
      id: recipeId,
      userId,
      name: input.name.trim(),
      baseDiameter: input.baseDiameter || 16,
      baseHeight: input.baseHeight || 10,
      defaultMarkupPercent: input.defaultMarkupPercent ?? 100,
      portionsCount: input.portionsCount || 8,
      finishedWeightGrams: input.finishedWeightGrams || 0,
      createdAt: new Date().toISOString(),
      components: (input.components ?? []).map((comp, idx) => {
        const compId = data.nextComponentId++;
        return {
          id: compId,
          recipeId,
          name: comp.name.trim() || `Шар ${idx + 1}`,
          sortOrder: comp.sortOrder ?? idx,
          ingredients: (comp.ingredients ?? [])
            .filter((ci) => ownedIngIds.has(ci.ingredientId))
            .map((ci) => ({
              id: data.nextComponentIngredientId++,
              componentId: compId,
              ingredientId: ci.ingredientId,
              baseGrams: Number(ci.baseGrams) || 0,
            })),
        };
      }),
    };
    data.recipes.push(createdRaw);
    writeLocalDb(data);
    const ingMap = new Map(
      data.ingredients
        .filter((i) => i.userId === userId)
        .map((i) => [i.id, i])
    );
    return hydrateLocalRecipe(createdRaw, ingMap);
  }

  const db = getDb();
  const ownedIngRows = await db
    .select({ id: ingredients.id })
    .from(ingredients)
    .where(eq(ingredients.userId, userId));
  const ownedIngIds = new Set(ownedIngRows.map((r) => r.id));

  const [createdRecipe] = await db
    .insert(recipes)
    .values({
      userId,
      name: input.name.trim(),
      baseDiameter: input.baseDiameter || 16,
      baseHeight: input.baseHeight || 10,
      defaultMarkupPercent: input.defaultMarkupPercent ?? 100,
      portionsCount: input.portionsCount || 8,
      finishedWeightGrams: input.finishedWeightGrams || 0,
    })
    .returning();

  for (let idx = 0; idx < (input.components ?? []).length; idx++) {
    const comp = input.components[idx];
    const [createdComp] = await db
      .insert(recipeComponents)
      .values({
        recipeId: createdRecipe.id,
        name: comp.name.trim() || `Шар ${idx + 1}`,
        sortOrder: comp.sortOrder ?? idx,
      })
      .returning();

    const safeLines = (comp.ingredients ?? []).filter((ci) =>
      ownedIngIds.has(ci.ingredientId)
    );
    if (safeLines.length > 0) {
      await db.insert(componentIngredients).values(
        safeLines.map((ci) => ({
          componentId: createdComp.id,
          ingredientId: ci.ingredientId,
          baseGrams: Number(ci.baseGrams) || 0,
        }))
      );
    }
  }

  const hydrated = await getRecipeById(userId, createdRecipe.id);
  if (!hydrated) throw new Error("Failed to load created recipe");
  return hydrated;
}

export async function updateRecipe(
  userId: string,
  id: number,
  input: RecipeInput
): Promise<RecipeWithDetails | null> {
  if (!hasValidDatabaseUrl()) {
    const data = readLocalDb();
    const idx = data.recipes.findIndex(
      (r) => r.id === id && r.userId === userId
    );
    if (idx === -1) return null;

    const ownedIngIds = new Set(
      data.ingredients.filter((i) => i.userId === userId).map((i) => i.id)
    );
    const existing = data.recipes[idx];
    data.recipes[idx] = {
      ...existing,
      name: input.name.trim(),
      baseDiameter: input.baseDiameter || 16,
      baseHeight: input.baseHeight || 10,
      defaultMarkupPercent: input.defaultMarkupPercent ?? 100,
      portionsCount: input.portionsCount || 8,
      finishedWeightGrams: input.finishedWeightGrams || 0,
      components: (input.components ?? []).map((comp, cIdx) => {
        const compId = data.nextComponentId++;
        return {
          id: compId,
          recipeId: id,
          name: comp.name.trim() || `Шар ${cIdx + 1}`,
          sortOrder: comp.sortOrder ?? cIdx,
          ingredients: (comp.ingredients ?? [])
            .filter((ci) => ownedIngIds.has(ci.ingredientId))
            .map((ci) => ({
              id: data.nextComponentIngredientId++,
              componentId: compId,
              ingredientId: ci.ingredientId,
              baseGrams: Number(ci.baseGrams) || 0,
            })),
        };
      }),
    };
    writeLocalDb(data);
    const ingMap = new Map(
      data.ingredients
        .filter((i) => i.userId === userId)
        .map((i) => [i.id, i])
    );
    return hydrateLocalRecipe(data.recipes[idx], ingMap);
  }

  const db = getDb();
  const [updated] = await db
    .update(recipes)
    .set({
      name: input.name.trim(),
      baseDiameter: input.baseDiameter || 16,
      baseHeight: input.baseHeight || 10,
      defaultMarkupPercent: input.defaultMarkupPercent ?? 100,
      portionsCount: input.portionsCount || 8,
      finishedWeightGrams: input.finishedWeightGrams || 0,
    })
    .where(and(eq(recipes.id, id), eq(recipes.userId, userId)))
    .returning();

  if (!updated) return null;

  const ownedIngRows = await db
    .select({ id: ingredients.id })
    .from(ingredients)
    .where(eq(ingredients.userId, userId));
  const ownedIngIds = new Set(ownedIngRows.map((r) => r.id));

  // Replace components cleanly
  await db.delete(recipeComponents).where(eq(recipeComponents.recipeId, id));

  for (let idx = 0; idx < (input.components ?? []).length; idx++) {
    const comp = input.components[idx];
    const [createdComp] = await db
      .insert(recipeComponents)
      .values({
        recipeId: id,
        name: comp.name.trim() || `Шар ${idx + 1}`,
        sortOrder: comp.sortOrder ?? idx,
      })
      .returning();

    const safeLines = (comp.ingredients ?? []).filter((ci) =>
      ownedIngIds.has(ci.ingredientId)
    );
    if (safeLines.length > 0) {
      await db.insert(componentIngredients).values(
        safeLines.map((ci) => ({
          componentId: createdComp.id,
          ingredientId: ci.ingredientId,
          baseGrams: Number(ci.baseGrams) || 0,
        }))
      );
    }
  }

  return getRecipeById(userId, id);
}

export async function deleteRecipe(
  userId: string,
  id: number
): Promise<boolean> {
  if (!hasValidDatabaseUrl()) {
    const data = readLocalDb();
    const before = data.recipes.length;
    data.recipes = data.recipes.filter(
      (r) => !(r.id === id && r.userId === userId)
    );
    if (data.recipes.length === before) return false;
    for (const plan of data.procurementPlans) {
      if (plan.userId !== userId) continue;
      plan.itemsJson = plan.itemsJson.filter((item) => item.recipe_id !== id);
    }
    writeLocalDb(data);
    return true;
  }

  const db = getDb();
  const deleted = await db
    .delete(recipes)
    .where(and(eq(recipes.id, id), eq(recipes.userId, userId)))
    .returning();
  return deleted.length > 0;
}

// ==================== PROCUREMENT PLANS ====================

export async function listProcurementPlans(
  userId: string
): Promise<ProcurementPlan[]> {
  if (!hasValidDatabaseUrl()) {
    const data = readLocalDb();
    return data.procurementPlans
      .filter((p) => p.userId === userId)
      .sort(
        (a, b) =>
          new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      );
  }

  const db = getDb();
  const rows = await db
    .select()
    .from(procurementPlans)
    .where(eq(procurementPlans.userId, userId))
    .orderBy(desc(procurementPlans.updatedAt));

  return rows.map((r) => ({
    id: r.id,
    userId: r.userId,
    name: r.name,
    itemsJson: Array.isArray(r.itemsJson) ? r.itemsJson : [],
    updatedAt: r.updatedAt.toISOString(),
  }));
}

export async function createProcurementPlan(
  userId: string,
  input: {
    name: string;
    itemsJson: ProcurementPlanItem[];
  }
): Promise<ProcurementPlan> {
  if (!hasValidDatabaseUrl()) {
    const data = readLocalDb();
    const plan: ProcurementPlan & { userId: string } = {
      id: data.nextPlanId++,
      userId,
      name: input.name.trim() || "Закупівля",
      itemsJson: input.itemsJson ?? [],
      updatedAt: new Date().toISOString(),
    };
    data.procurementPlans.push(plan);
    writeLocalDb(data);
    return plan;
  }

  const db = getDb();
  const [created] = await db
    .insert(procurementPlans)
    .values({
      userId,
      name: input.name.trim() || "Закупівля",
      itemsJson: input.itemsJson ?? [],
      updatedAt: new Date(),
    })
    .returning();

  return {
    id: created.id,
    userId: created.userId,
    name: created.name,
    itemsJson: Array.isArray(created.itemsJson) ? created.itemsJson : [],
    updatedAt: created.updatedAt.toISOString(),
  };
}

export async function updateProcurementPlan(
  userId: string,
  id: number,
  input: {
    name?: string;
    itemsJson?: ProcurementPlanItem[];
  }
): Promise<ProcurementPlan | null> {
  if (!hasValidDatabaseUrl()) {
    const data = readLocalDb();
    const plan = data.procurementPlans.find(
      (p) => p.id === id && p.userId === userId
    );
    if (!plan) return null;
    if (input.name !== undefined) plan.name = input.name.trim() || "Закупівля";
    if (input.itemsJson !== undefined) plan.itemsJson = input.itemsJson;
    plan.updatedAt = new Date().toISOString();
    writeLocalDb(data);
    return plan;
  }

  const db = getDb();
  const [updated] = await db
    .update(procurementPlans)
    .set({
      ...(input.name !== undefined
        ? { name: input.name.trim() || "Закупівля" }
        : {}),
      ...(input.itemsJson !== undefined ? { itemsJson: input.itemsJson } : {}),
      updatedAt: new Date(),
    })
    .where(
      and(eq(procurementPlans.id, id), eq(procurementPlans.userId, userId))
    )
    .returning();

  if (!updated) return null;
  return {
    id: updated.id,
    userId: updated.userId,
    name: updated.name,
    itemsJson: Array.isArray(updated.itemsJson) ? updated.itemsJson : [],
    updatedAt: updated.updatedAt.toISOString(),
  };
}

export async function deleteProcurementPlan(
  userId: string,
  id: number
): Promise<boolean> {
  if (!hasValidDatabaseUrl()) {
    const data = readLocalDb();
    const before = data.procurementPlans.length;
    data.procurementPlans = data.procurementPlans.filter(
      (p) => !(p.id === id && p.userId === userId)
    );
    if (data.procurementPlans.length === before) return false;
    writeLocalDb(data);
    return true;
  }

  const db = getDb();
  const deleted = await db
    .delete(procurementPlans)
    .where(
      and(eq(procurementPlans.id, id), eq(procurementPlans.userId, userId))
    )
    .returning();
  return deleted.length > 0;
}
