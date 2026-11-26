"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AlertCircle, Copy, Plus, Trash2 } from "lucide-react";
import type { Ingredient, RecipeWithDetails } from "@/types/pastry";
import { DIAMETERS } from "@/types/pastry";
import { calculateKbju, calculateRecipe, roundGrams } from "@/lib/calculations";
import { hapticImpact, hapticNotification } from "@/lib/telegram";
import { useApp } from "@/components/providers/AppProvider";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

interface KbjuCalculatorProps {
  recipes: RecipeWithDetails[];
  ingredients: Ingredient[];
  initialRecipeId?: string | null;
  initialDiameter?: number | null;
}

interface ManualKbjuRow {
  id: string;
  ingredientId: string; // "" = custom
  name: string;
  grams: string;
  kcal: string;
  protein: string;
  fat: string;
  carbs: string;
}

function makeManualRow(): ManualKbjuRow {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    ingredientId: "",
    name: "",
    grams: "",
    kcal: "0",
    protein: "0",
    fat: "0",
    carbs: "0",
  };
}

export function KbjuCalculator({
  recipes,
  ingredients,
  initialRecipeId,
  initialDiameter,
}: KbjuCalculatorProps) {
  const { showToast } = useApp();

  const [source, setSource] = useState<"recipe" | "manual">(
    initialRecipeId || recipes.length > 0 ? "recipe" : "manual"
  );
  const [selectedRecipeId, setSelectedRecipeId] = useState<string>(
    initialRecipeId || (recipes[0] ? String(recipes[0].id) : "")
  );
  const [selectedDiameter, setSelectedDiameter] = useState<number>(
    initialDiameter || recipes[0]?.baseDiameter || 16
  );

  const [manualRows, setManualRows] = useState<ManualKbjuRow[]>([
    makeManualRow(),
  ]);

  const [finishedWeight, setFinishedWeight] = useState<string>("");
  const [portionWeight, setPortionWeight] = useState<string>("150");

  useEffect(() => {
    if (initialRecipeId) {
      setSource("recipe");
      setSelectedRecipeId(initialRecipeId);
    }
    if (initialDiameter) {
      setSelectedDiameter(initialDiameter);
    }
  }, [initialRecipeId, initialDiameter]);

  const selectedRecipe = useMemo(
    () => recipes.find((r) => String(r.id) === selectedRecipeId) ?? null,
    [recipes, selectedRecipeId]
  );

  const recipeCalc = useMemo(
    () =>
      selectedRecipe ? calculateRecipe(selectedRecipe, selectedDiameter) : null,
    [selectedRecipe, selectedDiameter]
  );

  const itemsForKbju = useMemo(() => {
    if (source === "recipe" && recipeCalc) {
      return recipeCalc.aggregated.map((a) => ({
        name: a.name,
        grams: a.totalGrams,
        calories100g: a.ingredient.calories100g,
        protein100g: a.ingredient.protein100g,
        fat100g: a.ingredient.fat100g,
        carbs100g: a.ingredient.carbs100g,
      }));
    }
    return manualRows.map((r) => ({
      name: r.name,
      grams: parseFloat(r.grams.replace(",", ".")) || 0,
      calories100g: parseFloat(r.kcal.replace(",", ".")) || 0,
      protein100g: parseFloat(r.protein.replace(",", ".")) || 0,
      fat100g: parseFloat(r.fat.replace(",", ".")) || 0,
      carbs100g: parseFloat(r.carbs.replace(",", ".")) || 0,
    }));
  }, [source, recipeCalc, manualRows]);

  const missingKbjuNames = useMemo(
    () =>
      itemsForKbju
        .filter(
          (i) =>
            i.grams > 0 &&
            i.calories100g === 0 &&
            i.protein100g === 0 &&
            i.fat100g === 0 &&
            i.carbs100g === 0
        )
        .map((i) => i.name)
        .filter(Boolean),
    [itemsForKbju]
  );

  const defaultFinishedWeight =
    source === "recipe" && recipeCalc
      ? Math.round(recipeCalc.estimatedFinishedWeightGrams)
      : Math.round(itemsForKbju.reduce((s, i) => s + i.grams, 0));

  const effectiveFinishedWeight =
    parseFloat(finishedWeight.replace(",", ".")) || defaultFinishedWeight;
  const effectivePortionWeight =
    parseFloat(portionWeight.replace(",", ".")) || 150;

  const kbju = useMemo(
    () =>
      calculateKbju(
        itemsForKbju,
        effectiveFinishedWeight,
        effectivePortionWeight
      ),
    [itemsForKbju, effectiveFinishedWeight, effectivePortionWeight]
  );

  function selectWarehouseIngredient(rowId: string, ingIdStr: string) {
    const ing = ingredients.find((i) => String(i.id) === ingIdStr);
    setManualRows((prev) =>
      prev.map((r) => {
        if (r.id !== rowId) return r;
        if (!ing) return { ...r, ingredientId: "" };
        return {
          ...r,
          ingredientId: ingIdStr,
          name: ing.name,
          kcal: String(ing.calories100g || 0),
          protein: String(ing.protein100g || 0),
          fat: String(ing.fat100g || 0),
          carbs: String(ing.carbs100g || 0),
        };
      })
    );
  }

  function updateManualRow(
    rowId: string,
    field: keyof ManualKbjuRow,
    value: string
  ) {
    setManualRows((prev) =>
      prev.map((r) => (r.id === rowId ? { ...r, [field]: value } : r))
    );
  }

  async function handleCopyKbju() {
    hapticImpact("light");
    const title =
      source === "recipe" && selectedRecipe
        ? `КБЖУ — ${selectedRecipe.name} (Ø ${selectedDiameter} см)`
        : "Пищевая ценность (КБЖУ)";
    const text = [
      title,
      `На 100 г: ${kbju.per100g.calories} ккал · Белки ${kbju.per100g.protein} г · Жиры ${kbju.per100g.fat} г · Углеводы ${kbju.per100g.carbs} г`,
      `На порцию (${kbju.portionWeightGrams} г): ${kbju.perPortion.calories} ккал · Б ${kbju.perPortion.protein} г · Ж ${kbju.perPortion.fat} г · У ${kbju.perPortion.carbs} г`,
    ].join("\n");

    try {
      await navigator.clipboard.writeText(text);
      hapticNotification("success");
      showToast("КБЖУ скопировано", "success");
    } catch {
      showToast("Не удалось скопировать", "error");
    }
  }

  return (
    <div className="space-y-4">
      {/* Results Summary */}
      <Card className="p-4 space-y-3.5">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-[var(--app-hint)]">
              Пищевая ценность
            </div>
            <div className="text-[11px] text-[var(--app-hint)]">
              Готовый вес: {roundGrams(kbju.finishedWeightGrams)} г · Порция:{" "}
              {roundGrams(kbju.portionWeightGrams)} г
            </div>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleCopyKbju}
          >
            <Copy className="h-3.5 w-3.5" />
            <span>Копия</span>
          </Button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Per 100g */}
          <div className="rounded-xl bg-[var(--app-accent-soft)] p-3.5">
            <div className="flex items-baseline justify-between mb-2">
              <span className="text-xs font-bold text-[var(--app-accent)]">
                На 100 г
              </span>
              <span className="text-lg font-bold tabular-nums text-[var(--app-accent)]">
                {kbju.per100g.calories} ккал
              </span>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="rounded-lg bg-[var(--app-card)] py-1.5">
                <div className="text-[10px] text-[var(--app-hint)]">Белки</div>
                <div className="text-sm font-bold tabular-nums">
                  {kbju.per100g.protein} г
                </div>
              </div>
              <div className="rounded-lg bg-[var(--app-card)] py-1.5">
                <div className="text-[10px] text-[var(--app-hint)]">Жиры</div>
                <div className="text-sm font-bold tabular-nums">
                  {kbju.per100g.fat} г
                </div>
              </div>
              <div className="rounded-lg bg-[var(--app-card)] py-1.5">
                <div className="text-[10px] text-[var(--app-hint)]">Углев.</div>
                <div className="text-sm font-bold tabular-nums">
                  {kbju.per100g.carbs} г
                </div>
              </div>
            </div>
          </div>

          {/* Per Portion */}
          <div className="rounded-xl bg-[var(--app-subtle)] p-3.5">
            <div className="flex items-baseline justify-between mb-2">
              <span className="text-xs font-bold">
                На 1 порцию ({roundGrams(kbju.portionWeightGrams)} г)
              </span>
              <span className="text-lg font-bold tabular-nums">
                {kbju.perPortion.calories} ккал
              </span>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="rounded-lg bg-[var(--app-card)] py-1.5">
                <div className="text-[10px] text-[var(--app-hint)]">Белки</div>
                <div className="text-sm font-bold tabular-nums">
                  {kbju.perPortion.protein} г
                </div>
              </div>
              <div className="rounded-lg bg-[var(--app-card)] py-1.5">
                <div className="text-[10px] text-[var(--app-hint)]">Жиры</div>
                <div className="text-sm font-bold tabular-nums">
                  {kbju.perPortion.fat} г
                </div>
              </div>
              <div className="rounded-lg bg-[var(--app-card)] py-1.5">
                <div className="text-[10px] text-[var(--app-hint)]">Углев.</div>
                <div className="text-sm font-bold tabular-nums">
                  {kbju.perPortion.carbs} г
                </div>
              </div>
            </div>
          </div>
        </div>

        {missingKbjuNames.length > 0 && (
          <div className="flex items-start gap-2 rounded-xl bg-amber-500/10 px-3 py-2.5 text-xs text-amber-800 dark:text-amber-200">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <div>
              У {missingKbjuNames.length} продуктов не заполнено КБЖУ (
              {missingKbjuNames.slice(0, 3).join(", ")}
              {missingKbjuNames.length > 3 ? "…" : ""}).{" "}
              <Link href="/ingredients" className="underline font-semibold">
                Заполнить на складе
              </Link>
            </div>
          </div>
        )}
      </Card>

      {/* Weight Parameters */}
      <Card className="p-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-[var(--app-hint)] mb-1">
              Вес готового изделия (г)
            </label>
            <Input
              type="number"
              inputMode="numeric"
              min="1"
              value={finishedWeight}
              onChange={(e) => setFinishedWeight(e.target.value)}
              placeholder={
                defaultFinishedWeight > 0
                  ? `${defaultFinishedWeight} (авто)`
                  : "1500"
              }
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[var(--app-hint)] mb-1">
              Вес 1 порции (г)
            </label>
            <Input
              type="number"
              inputMode="numeric"
              min="1"
              value={portionWeight}
              onChange={(e) => setPortionWeight(e.target.value)}
              placeholder="150"
            />
          </div>
        </div>
      </Card>

      {/* Source Selection */}
      <Card className="p-4 space-y-3.5">
        <div className="grid grid-cols-2 gap-1 rounded-xl bg-[var(--app-subtle)] p-1">
          <button
            type="button"
            disabled={recipes.length === 0}
            onClick={() => {
              hapticImpact("light");
              setSource("recipe");
            }}
            className={`rounded-lg py-2 text-xs font-semibold cursor-pointer disabled:opacity-40 ${
              source === "recipe"
                ? "bg-[var(--app-card)] text-[var(--app-text)] shadow-xs"
                : "text-[var(--app-hint)]"
            }`}
          >
            Торт из базы
          </button>
          <button
            type="button"
            onClick={() => {
              hapticImpact("light");
              setSource("manual");
            }}
            className={`rounded-lg py-2 text-xs font-semibold cursor-pointer ${
              source === "manual"
                ? "bg-[var(--app-card)] text-[var(--app-text)] shadow-xs"
                : "text-[var(--app-hint)]"
            }`}
          >
            Собрать вручную
          </button>
        </div>

        {source === "recipe" ? (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            <div className="sm:col-span-2">
              <label className="block text-[11px] font-medium text-[var(--app-hint)] mb-1">
                Выберите торт
              </label>
              <select
                value={selectedRecipeId}
                onChange={(e) => {
                  setSelectedRecipeId(e.target.value);
                  const r = recipes.find((x) => String(x.id) === e.target.value);
                  if (r) setSelectedDiameter(r.baseDiameter || 16);
                  setFinishedWeight("");
                }}
                className="app-input h-11 w-full rounded-xl px-3 text-sm"
              >
                {recipes.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-medium text-[var(--app-hint)] mb-1">
                Диаметр
              </label>
              <select
                value={selectedDiameter}
                onChange={(e) => {
                  setSelectedDiameter(Number(e.target.value));
                  setFinishedWeight("");
                }}
                className="app-input h-11 w-full rounded-xl px-3 text-sm tabular-nums"
              >
                {DIAMETERS.map((d) => (
                  <option key={d} value={d}>
                    Ø {d} см
                  </option>
                ))}
              </select>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {manualRows.map((row) => (
              <div
                key={row.id}
                className="rounded-xl border border-[var(--app-border)] p-3 space-y-2.5"
              >
                <div className="flex items-center gap-2">
                  {ingredients.length > 0 ? (
                    <select
                      value={row.ingredientId}
                      onChange={(e) =>
                        selectWarehouseIngredient(row.id, e.target.value)
                      }
                      className="app-input h-9 flex-1 rounded-lg px-2.5 text-xs"
                    >
                      <option value="">— Ввести вручную или выбрать —</option>
                      {ingredients.map((i) => (
                        <option key={i.id} value={i.id}>
                          {i.name} ({Math.round(i.calories100g)} ккал)
                        </option>
                      ))}
                    </select>
                  ) : (
                    <Input
                      value={row.name}
                      onChange={(e) =>
                        updateManualRow(row.id, "name", e.target.value)
                      }
                      placeholder="Название продукта"
                      className="h-9 flex-1 text-xs"
                    />
                  )}
                  <div className="relative w-22">
                    <Input
                      type="number"
                      inputMode="decimal"
                      min="0"
                      value={row.grams}
                      onChange={(e) =>
                        updateManualRow(row.id, "grams", e.target.value)
                      }
                      placeholder="г"
                      className="h-9 pr-6 text-right text-xs font-bold tabular-nums"
                    />
                    <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-[var(--app-hint)]">
                      г
                    </span>
                  </div>
                  <button
                    type="button"
                    disabled={manualRows.length === 1}
                    onClick={() => {
                      hapticImpact("light");
                      setManualRows((prev) =>
                        prev.filter((r) => r.id !== row.id)
                      );
                    }}
                    className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--app-hint)] hover:text-[var(--app-danger)] disabled:opacity-30 cursor-pointer"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>

                <div className="grid grid-cols-4 gap-1.5">
                  {[
                    { key: "kcal", label: "Ккал/100г" },
                    { key: "protein", label: "Белки" },
                    { key: "fat", label: "Жиры" },
                    { key: "carbs", label: "Углев." },
                  ].map((f) => (
                    <div key={f.key}>
                      <label className="block text-[10px] text-[var(--app-hint)] mb-0.5">
                        {f.label}
                      </label>
                      <Input
                        type="number"
                        inputMode="decimal"
                        min="0"
                        step="any"
                        value={row[f.key as keyof ManualKbjuRow]}
                        onChange={(e) =>
                          updateManualRow(
                            row.id,
                            f.key as keyof ManualKbjuRow,
                            e.target.value
                          )
                        }
                        className="h-8 px-2 text-xs tabular-nums"
                      />
                    </div>
                  ))}
                </div>
              </div>
            ))}

            <Button
              type="button"
              variant="secondary"
              className="w-full"
              onClick={() => {
                hapticImpact("light");
                setManualRows((prev) => [...prev, makeManualRow()]);
              }}
            >
              <Plus className="h-4 w-4" />
              <span>Добавить продукт</span>
            </Button>
          </div>
        )}
      </Card>
    </div>
  );
}
