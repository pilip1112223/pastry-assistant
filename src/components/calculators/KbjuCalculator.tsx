"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AlertCircle, Copy, Plus, Trash2 } from "lucide-react";
import type {
  Ingredient,
  IngredientUnitType,
  RecipeWithDetails,
} from "@/types/pastry";
import { DIAMETERS } from "@/types/pastry";
import {
  calculateIngredientWeightGrams,
  calculateKbju,
  calculateRecipe,
  getRecipeUnitLabel,
  roundGrams,
} from "@/lib/calculations";
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
  unitType: IngredientUnitType;
  unitWeightGrams: number;
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
    unitType: "weight",
    unitWeightGrams: 0,
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
        grams: a.totalWeightGrams,
        calories100g: a.ingredient.calories100g,
        protein100g: a.ingredient.protein100g,
        fat100g: a.ingredient.fat100g,
        carbs100g: a.ingredient.carbs100g,
      }));
    }
    return manualRows.map((r) => {
      const rawQty = parseFloat(r.grams.replace(",", ".")) || 0;
      const grams = calculateIngredientWeightGrams(rawQty, {
        unitType: r.unitType,
        unitWeightGrams: r.unitWeightGrams,
      });
      return {
        name: r.name,
        grams,
        calories100g: parseFloat(r.kcal.replace(",", ".")) || 0,
        protein100g: parseFloat(r.protein.replace(",", ".")) || 0,
        fat100g: parseFloat(r.fat.replace(",", ".")) || 0,
        carbs100g: parseFloat(r.carbs.replace(",", ".")) || 0,
      };
    });
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
        if (!ing) {
          return {
            ...r,
            ingredientId: "",
            unitType: "weight",
            unitWeightGrams: 0,
          };
        }
        return {
          ...r,
          ingredientId: ingIdStr,
          unitType: ing.unitType ?? "weight",
          unitWeightGrams: ing.unitWeightGrams || 0,
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
        ? `КБЖВ — ${selectedRecipe.name} (Ø ${selectedDiameter} см)`
        : "Харчова цінність (КБЖВ)";
    const text = [
      title,
      `На 100 г: ${kbju.per100g.calories} ккал · Білки ${kbju.per100g.protein} г · Жири ${kbju.per100g.fat} г · Вуглеводи ${kbju.per100g.carbs} г`,
      `На порцію (${kbju.portionWeightGrams} г): ${kbju.perPortion.calories} ккал · Б ${kbju.perPortion.protein} г · Ж ${kbju.perPortion.fat} г · В ${kbju.perPortion.carbs} г`,
    ].join("\n");

    try {
      await navigator.clipboard.writeText(text);
      hapticNotification("success");
      showToast("КБЖВ скопійовано", "success");
    } catch {
      showToast("Не вдалося скопіювати", "error");
    }
  }

  return (
    <div className="space-y-4">
      {/* Results Summary */}
      <Card className="p-4.5 space-y-4">
        <div className="flex items-center justify-between gap-2">
          <div>
            <div className="text-[11px] font-extrabold uppercase tracking-[0.06em] text-[var(--app-hint)]">
              Харчова цінність
            </div>
            <div className="mt-0.5 text-xs font-semibold text-[var(--app-hint)] tabular-nums">
              Готова вага: {roundGrams(kbju.finishedWeightGrams)} г · Порція:{" "}
              {roundGrams(kbju.portionWeightGrams)} г
            </div>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleCopyKbju}
          >
            <Copy className="h-4 w-4" strokeWidth={2} />
            <span>Копія</span>
          </Button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Per 100g */}
          <div className="rounded-[18px] bg-[var(--app-accent-soft)] border border-[var(--app-accent)]/15 p-3.5">
            <div className="flex items-baseline justify-between mb-2.5">
              <span className="text-xs font-extrabold text-[var(--app-accent)]">
                На 100 г
              </span>
              <span className="text-lg font-extrabold tabular-nums text-[var(--app-accent)]">
                {kbju.per100g.calories} ккал
              </span>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="rounded-[12px] bg-[var(--app-card)] py-2 border border-[var(--app-border)]/70">
                <div className="text-[10px] font-bold uppercase text-[var(--app-hint)]">
                  Білки
                </div>
                <div className="mt-0.5 text-sm font-extrabold tabular-nums">
                  {kbju.per100g.protein} г
                </div>
              </div>
              <div className="rounded-[12px] bg-[var(--app-card)] py-2 border border-[var(--app-border)]/70">
                <div className="text-[10px] font-bold uppercase text-[var(--app-hint)]">
                  Жири
                </div>
                <div className="mt-0.5 text-sm font-extrabold tabular-nums">
                  {kbju.per100g.fat} г
                </div>
              </div>
              <div className="rounded-[12px] bg-[var(--app-card)] py-2 border border-[var(--app-border)]/70">
                <div className="text-[10px] font-bold uppercase text-[var(--app-hint)]">
                  Вугл.
                </div>
                <div className="mt-0.5 text-sm font-extrabold tabular-nums">
                  {kbju.per100g.carbs} г
                </div>
              </div>
            </div>
          </div>

          {/* Per Portion */}
          <div className="rounded-[18px] bg-[var(--app-bg)] border border-[var(--app-border)] p-3.5">
            <div className="flex items-baseline justify-between mb-2.5">
              <span className="text-xs font-extrabold tabular-nums">
                На 1 порцію ({roundGrams(kbju.portionWeightGrams)} г)
              </span>
              <span className="text-lg font-extrabold tabular-nums">
                {kbju.perPortion.calories} ккал
              </span>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="rounded-[12px] bg-[var(--app-card)] py-2 border border-[var(--app-border)]/70">
                <div className="text-[10px] font-bold uppercase text-[var(--app-hint)]">
                  Білки
                </div>
                <div className="mt-0.5 text-sm font-extrabold tabular-nums">
                  {kbju.perPortion.protein} г
                </div>
              </div>
              <div className="rounded-[12px] bg-[var(--app-card)] py-2 border border-[var(--app-border)]/70">
                <div className="text-[10px] font-bold uppercase text-[var(--app-hint)]">
                  Жири
                </div>
                <div className="mt-0.5 text-sm font-extrabold tabular-nums">
                  {kbju.perPortion.fat} г
                </div>
              </div>
              <div className="rounded-[12px] bg-[var(--app-card)] py-2 border border-[var(--app-border)]/70">
                <div className="text-[10px] font-bold uppercase text-[var(--app-hint)]">
                  Вугл.
                </div>
                <div className="mt-0.5 text-sm font-extrabold tabular-nums">
                  {kbju.perPortion.carbs} г
                </div>
              </div>
            </div>
          </div>
        </div>

        {missingKbjuNames.length > 0 && (
          <div className="flex items-start gap-2.5 rounded-[14px] bg-[var(--app-warning-soft)] border border-[var(--app-warning)]/20 px-3.5 py-3 text-xs text-[var(--app-warning)]">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" strokeWidth={2} />
            <div className="leading-relaxed">
              У {missingKbjuNames.length} продуктів не заповнено КБЖВ (
              {missingKbjuNames.slice(0, 3).join(", ")}
              {missingKbjuNames.length > 3 ? "…" : ""}).{" "}
              <Link
                href="/ingredients"
                className="underline font-extrabold hover:opacity-80"
              >
                Заповнити на складі
              </Link>
            </div>
          </div>
        )}
      </Card>

      {/* Weight Parameters */}
      <Card className="p-4.5">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-bold text-[var(--app-hint)] mb-1.5">
              Вага готового виробу
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
              suffix="г"
              className="tabular-nums font-semibold"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-[var(--app-hint)] mb-1.5">
              Вага 1 порції
            </label>
            <Input
              type="number"
              inputMode="numeric"
              min="1"
              value={portionWeight}
              onChange={(e) => setPortionWeight(e.target.value)}
              placeholder="150"
              suffix="г"
              className="tabular-nums font-semibold"
            />
          </div>
        </div>
      </Card>

      {/* Source Selection */}
      <Card className="p-4.5 space-y-4">
        <div className="grid grid-cols-2 gap-1 rounded-[15px] bg-[var(--app-subtle)] p-1 border border-[var(--app-border)]">
          <button
            type="button"
            disabled={recipes.length === 0}
            onClick={() => {
              hapticImpact("light");
              setSource("recipe");
            }}
            className={`min-h-[40px] rounded-[11px] py-2 text-xs font-bold cursor-pointer transition-all disabled:opacity-40 ${
              source === "recipe"
                ? "bg-[var(--app-card)] text-[var(--app-text)] shadow-[0_1px_4px_rgba(42,30,23,0.08)]"
                : "text-[var(--app-hint)]"
            }`}
          >
            Торт із бази
          </button>
          <button
            type="button"
            onClick={() => {
              hapticImpact("light");
              setSource("manual");
            }}
            className={`min-h-[40px] rounded-[11px] py-2 text-xs font-bold cursor-pointer transition-all ${
              source === "manual"
                ? "bg-[var(--app-card)] text-[var(--app-text)] shadow-[0_1px_4px_rgba(42,30,23,0.08)]"
                : "text-[var(--app-hint)]"
            }`}
          >
            Зібрати вручну
          </button>
        </div>

        {source === "recipe" ? (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <label className="block text-[11px] font-bold text-[var(--app-hint)] mb-1.5">
                Оберіть торт
              </label>
              <select
                value={selectedRecipeId}
                onChange={(e) => {
                  setSelectedRecipeId(e.target.value);
                  const r = recipes.find(
                    (x) => String(x.id) === e.target.value
                  );
                  if (r) setSelectedDiameter(r.baseDiameter || 16);
                  setFinishedWeight("");
                }}
                className="app-input h-11 min-h-[44px] w-full rounded-[14px] px-3.5 text-sm font-semibold"
              >
                {recipes.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-bold text-[var(--app-hint)] mb-1.5">
                Діаметр
              </label>
              <select
                value={selectedDiameter}
                onChange={(e) => {
                  setSelectedDiameter(Number(e.target.value));
                  setFinishedWeight("");
                }}
                className="app-input h-11 min-h-[44px] w-full rounded-[14px] px-3.5 text-sm font-semibold tabular-nums"
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
                className="rounded-[16px] border border-[var(--app-border)] bg-[var(--app-bg)]/50 p-3.5 space-y-3"
              >
                <div className="flex items-center gap-2">
                  {ingredients.length > 0 ? (
                    <select
                      value={row.ingredientId}
                      onChange={(e) =>
                        selectWarehouseIngredient(row.id, e.target.value)
                      }
                      className="app-input h-11 min-h-[44px] flex-1 rounded-[14px] px-3 text-xs font-semibold"
                    >
                      <option value="">— Ввести вручну або обрати —</option>
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
                      placeholder="Назва продукту"
                      wrapperClassName="flex-1"
                    />
                  )}
                  <Input
                    type="number"
                    inputMode="decimal"
                    min="0"
                    value={row.grams}
                    onChange={(e) =>
                      updateManualRow(row.id, "grams", e.target.value)
                    }
                    placeholder="0"
                    suffix={getRecipeUnitLabel(row.unitType)}
                    wrapperClassName="w-24 shrink-0"
                    className="text-right font-bold tabular-nums"
                  />
                  <button
                    type="button"
                    disabled={manualRows.length === 1}
                    onClick={() => {
                      hapticImpact("light");
                      setManualRows((prev) =>
                        prev.filter((r) => r.id !== row.id)
                      );
                    }}
                    aria-label="Видалити продукт"
                    className="flex h-11 w-10 min-h-[44px] shrink-0 items-center justify-center rounded-xl text-[var(--app-hint)] hover:bg-[var(--app-danger-soft)] hover:text-[var(--app-danger)] disabled:opacity-30 active:scale-95 transition-all cursor-pointer"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    { key: "kcal", label: "Ккал / 100г", suffix: "ккал" },
                    { key: "protein", label: "Білки", suffix: "г" },
                    { key: "fat", label: "Жири", suffix: "г" },
                    { key: "carbs", label: "Вуглеводи", suffix: "г" },
                  ].map((f) => (
                    <div key={f.key}>
                      <label className="block text-[10.5px] font-bold text-[var(--app-hint)] mb-1">
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
                        suffix={f.suffix}
                        className="text-xs tabular-nums font-semibold"
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
              <Plus className="h-4 w-4" strokeWidth={2.3} />
              <span>Додати продукт</span>
            </Button>
          </div>
        )}
      </Card>
    </div>
  );
}
