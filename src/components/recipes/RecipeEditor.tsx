"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  Calculator,
  ChevronDown,
  ChevronUp,
  Layers,
  Plus,
  Save,
  Search,
  Trash2,
} from "lucide-react";
import type { Ingredient, RecipeWithDetails } from "@/types/pastry";
import { DIAMETERS } from "@/types/pastry";
import {
  calculateRecipe,
  formatMoney,
  formatWeight,
  getDiameterCoefficient,
  roundGrams,
} from "@/lib/calculations";
import {
  hapticImpact,
  hapticNotification,
  useTelegramBackButton,
} from "@/lib/telegram";
import { useApp } from "@/components/providers/AppProvider";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { IngredientFormModal } from "@/components/ingredients/IngredientFormModal";

interface DraftIngredientLine {
  clientKey: string;
  ingredientId: number;
  baseGrams: string;
}

interface DraftComponent {
  clientKey: string;
  name: string;
  ingredients: DraftIngredientLine[];
}

const COMPONENT_PRESETS = [
  "Бисквит",
  "Крем",
  "Начинка / Конфи",
  "Пропитка",
  "Хрустящий слой",
  "Покрытие",
];

function makeKey() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

interface RecipeEditorProps {
  recipeId?: number;
}

export function RecipeEditor({ recipeId }: RecipeEditorProps) {
  const router = useRouter();
  const { currency, showToast } = useApp();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [allIngredients, setAllIngredients] = useState<Ingredient[]>([]);

  // Form state
  const [name, setName] = useState("");
  const [baseDiameter, setBaseDiameter] = useState(16);
  const [baseHeight, setBaseHeight] = useState(10);
  const [markupPercent, setMarkupPercent] = useState(100);
  const [portionsCount, setPortionsCount] = useState(8);
  const [finishedWeightGrams, setFinishedWeightGrams] = useState(0);
  const [components, setComponents] = useState<DraftComponent[]>([
    { clientKey: "init-1", name: "Бисквит", ingredients: [] },
    { clientKey: "init-2", name: "Крем", ingredients: [] },
  ]);

  // Active preview diameter in top switcher
  const [selectedDiameter, setSelectedDiameter] = useState(16);
  const [showMetaSettings, setShowMetaSettings] = useState(!recipeId);

  // Ingredient picker modal
  const [pickerCompKey, setPickerCompKey] = useState<string | null>(null);
  const [pickerSearch, setPickerSearch] = useState("");
  const [quickCreateOpen, setQuickCreateOpen] = useState(false);

  const handleBack = useCallback(() => {
    hapticImpact("light");
    router.push("/");
  }, [router]);

  useTelegramBackButton(handleBack);

  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        const [ingRes, recRes] = await Promise.all([
          fetch("/api/ingredients", { cache: "no-store" }),
          recipeId
            ? fetch(`/api/recipes/${recipeId}`, { cache: "no-store" })
            : Promise.resolve(null),
        ]);

        if (ingRes.ok) {
          const ings = (await ingRes.json()) as Ingredient[];
          if (mounted) setAllIngredients(ings);
        }

        if (recRes) {
          if (!recRes.ok) {
            showToast("Рецепт не найден", "error");
            router.push("/");
            return;
          }
          const rec = (await recRes.json()) as RecipeWithDetails;
          if (mounted) {
            setName(rec.name);
            setBaseDiameter(rec.baseDiameter || 16);
            setSelectedDiameter(rec.baseDiameter || 16);
            setBaseHeight(rec.baseHeight || 10);
            setMarkupPercent(rec.defaultMarkupPercent ?? 100);
            setPortionsCount(rec.portionsCount || 8);
            setFinishedWeightGrams(rec.finishedWeightGrams || 0);
            setComponents(
              rec.components.length > 0
                ? rec.components.map((c) => ({
                    clientKey: `comp-${c.id}`,
                    name: c.name,
                    ingredients: c.ingredients.map((ci) => ({
                      clientKey: `ci-${ci.id}`,
                      ingredientId: ci.ingredientId,
                      baseGrams: String(ci.baseGrams),
                    })),
                  }))
                : [{ clientKey: makeKey(), name: "Бисквит", ingredients: [] }]
            );
          }
        }
      } catch {
        showToast("Ошибка загрузки данных", "error");
      } finally {
        if (mounted) setLoading(false);
      }
    }
    load();
    return () => {
      mounted = false;
    };
  }, [recipeId, router, showToast]);

  const ingredientMap = useMemo(
    () => new Map(allIngredients.map((i) => [i.id, i])),
    [allIngredients]
  );

  // Build synthetic RecipeWithDetails for live calculation
  const liveRecipe = useMemo<RecipeWithDetails>(() => {
    return {
      id: recipeId ?? 0,
      name: name || "Новый торт",
      baseDiameter: baseDiameter || 16,
      baseHeight: baseHeight || 10,
      defaultMarkupPercent: markupPercent,
      portionsCount: portionsCount || 8,
      finishedWeightGrams: finishedWeightGrams || 0,
      createdAt: "",
      components: components.map((comp, cIdx) => ({
        id: cIdx + 1,
        recipeId: recipeId ?? 0,
        name: comp.name,
        sortOrder: cIdx,
        ingredients: comp.ingredients
          .map((line, lIdx) => {
            const ing = ingredientMap.get(line.ingredientId);
            if (!ing) return null;
            const g = parseFloat(line.baseGrams.replace(",", ".")) || 0;
            return {
              id: lIdx + 1,
              componentId: cIdx + 1,
              ingredientId: line.ingredientId,
              baseGrams: g,
              ingredient: ing,
            };
          })
          .filter((x): x is NonNullable<typeof x> => x !== null),
      })),
    };
  }, [
    recipeId,
    name,
    baseDiameter,
    baseHeight,
    markupPercent,
    portionsCount,
    finishedWeightGrams,
    components,
    ingredientMap,
  ]);

  const calc = useMemo(
    () => calculateRecipe(liveRecipe, selectedDiameter, markupPercent),
    [liveRecipe, selectedDiameter, markupPercent]
  );

  const coeff = getDiameterCoefficient(selectedDiameter, baseDiameter || 16);

  function addComponent(presetName?: string) {
    hapticImpact("light");
    setComponents((prev) => [
      ...prev,
      {
        clientKey: makeKey(),
        name: presetName || `Слой ${prev.length + 1}`,
        ingredients: [],
      },
    ]);
  }

  function updateComponentName(compKey: string, newName: string) {
    setComponents((prev) =>
      prev.map((c) => (c.clientKey === compKey ? { ...c, name: newName } : c))
    );
  }

  function moveComponent(index: number, direction: -1 | 1) {
    hapticImpact("light");
    setComponents((prev) => {
      const target = index + direction;
      if (target < 0 || target >= prev.length) return prev;
      const copy = [...prev];
      [copy[index], copy[target]] = [copy[target], copy[index]];
      return copy;
    });
  }

  function removeComponent(compKey: string) {
    hapticImpact("light");
    setComponents((prev) => prev.filter((c) => c.clientKey !== compKey));
  }

  function addIngredientToComponent(compKey: string, ingredient: Ingredient) {
    hapticImpact("light");
    setComponents((prev) =>
      prev.map((c) => {
        if (c.clientKey !== compKey) return c;
        return {
          ...c,
          ingredients: [
            ...c.ingredients,
            {
              clientKey: makeKey(),
              ingredientId: ingredient.id,
              baseGrams: "",
            },
          ],
        };
      })
    );
    setPickerCompKey(null);
    setPickerSearch("");
  }

  function updateLineGrams(compKey: string, lineKey: string, value: string) {
    setComponents((prev) =>
      prev.map((c) => {
        if (c.clientKey !== compKey) return c;
        return {
          ...c,
          ingredients: c.ingredients.map((l) =>
            l.clientKey === lineKey ? { ...l, baseGrams: value } : l
          ),
        };
      })
    );
  }

  function removeLine(compKey: string, lineKey: string) {
    hapticImpact("light");
    setComponents((prev) =>
      prev.map((c) => {
        if (c.clientKey !== compKey) return c;
        return {
          ...c,
          ingredients: c.ingredients.filter((l) => l.clientKey !== lineKey),
        };
      })
    );
  }

  async function handleSave() {
    if (!name.trim()) {
      showToast("Введите название торта", "error");
      setShowMetaSettings(true);
      return;
    }

    setSaving(true);
    try {
      const payload = {
        name: name.trim(),
        baseDiameter: baseDiameter || 16,
        baseHeight: baseHeight || 10,
        defaultMarkupPercent: Number.isFinite(markupPercent) ? markupPercent : 100,
        portionsCount: portionsCount || 8,
        finishedWeightGrams: finishedWeightGrams || 0,
        components: components.map((c, idx) => ({
          name: c.name.trim() || `Слой ${idx + 1}`,
          sortOrder: idx,
          ingredients: c.ingredients.map((l) => ({
            ingredientId: l.ingredientId,
            baseGrams: parseFloat(l.baseGrams.replace(",", ".")) || 0,
          })),
        })),
      };

      const url = recipeId ? `/api/recipes/${recipeId}` : "/api/recipes";
      const method = recipeId ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Ошибка сохранения");
      }

      hapticNotification("success");
      showToast("Техкарта сохранена", "success");
      if (!recipeId && data.id) {
        router.replace(`/recipes/${data.id}`);
      }
    } catch (err) {
      hapticNotification("error");
      showToast(
        err instanceof Error ? err.message : "Не удалось сохранить",
        "error"
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!recipeId) return;
    hapticImpact("medium");
    if (!window.confirm(`Удалить техкарту «${name}»?`)) return;

    setDeleting(true);
    try {
      const res = await fetch(`/api/recipes/${recipeId}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      hapticNotification("success");
      showToast("Техкарта удалена", "success");
      router.push("/");
    } catch {
      hapticNotification("error");
      showToast("Не удалось удалить техкарту", "error");
      setDeleting(false);
    }
  }

  const pickerFiltered = useMemo(() => {
    const q = pickerSearch.trim().toLowerCase();
    if (!q) return allIngredients;
    return allIngredients.filter((i) => i.name.toLowerCase().includes(q));
  }, [allIngredients, pickerSearch]);

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-12 rounded-2xl bg-[var(--app-subtle)] animate-pulse" />
        <div className="h-36 rounded-2xl bg-[var(--app-subtle)] animate-pulse" />
        <div className="h-52 rounded-2xl bg-[var(--app-subtle)] animate-pulse" />
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-6">
      {/* Top Action Bar */}
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={handleBack}
          className="inline-flex items-center gap-1.5 rounded-xl px-2.5 py-2 text-sm font-semibold text-[var(--app-hint)] hover:bg-[var(--app-subtle)] hover:text-[var(--app-text)] cursor-pointer"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Торты</span>
        </button>

        <div className="flex items-center gap-2">
          {recipeId && (
            <Button
              type="button"
              variant="destructive"
              size="icon"
              disabled={deleting}
              onClick={handleDelete}
              aria-label="Удалить рецепт"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
          <Button
            type="button"
            onClick={handleSave}
            disabled={saving}
            size="sm"
            className="h-10 px-4"
          >
            <Save className="h-4 w-4" />
            <span>{saving ? "Сохранение..." : "Сохранить"}</span>
          </Button>
        </div>
      </div>

      {/* Cake Name + Base Settings Card */}
      <Card className="p-4 space-y-3">
        <div>
          <label className="block text-[11px] font-semibold uppercase tracking-wider text-[var(--app-hint)] mb-1">
            Название торта / десерта
          </label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Например: Медовик классический"
            className="text-base font-semibold"
          />
        </div>

        <button
          type="button"
          onClick={() => {
            hapticImpact("light");
            setShowMetaSettings((v) => !v);
          }}
          className="flex w-full items-center justify-between rounded-xl bg-[var(--app-subtle)] px-3 py-2 text-xs font-semibold text-[var(--app-hint)] cursor-pointer"
        >
          <span>
            Параметры: база Ø {baseDiameter} см · высота {baseHeight} см ·{" "}
            {portionsCount} порц. · наценка {markupPercent}%
          </span>
          {showMetaSettings ? (
            <ChevronUp className="h-4 w-4 shrink-0" />
          ) : (
            <ChevronDown className="h-4 w-4 shrink-0" />
          )}
        </button>

        {showMetaSettings && (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 pt-1">
            <div>
              <label className="block text-[11px] font-medium text-[var(--app-hint)] mb-1">
                Базовый диаметр (см)
              </label>
              <Input
                type="number"
                inputMode="numeric"
                min="6"
                max="50"
                value={baseDiameter}
                onChange={(e) => {
                  const val = Math.max(4, Number(e.target.value) || 16);
                  setBaseDiameter(val);
                  if (!recipeId) setSelectedDiameter(val);
                }}
                className="h-9 text-sm"
              />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-[var(--app-hint)] mb-1">
                Высота (см)
              </label>
              <Input
                type="number"
                inputMode="numeric"
                min="1"
                max="40"
                value={baseHeight}
                onChange={(e) => setBaseHeight(Number(e.target.value) || 10)}
                className="h-9 text-sm"
              />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-[var(--app-hint)] mb-1">
                Наценка (%)
              </label>
              <Input
                type="number"
                inputMode="decimal"
                min="0"
                value={markupPercent}
                onChange={(e) =>
                  setMarkupPercent(Math.max(0, Number(e.target.value) || 0))
                }
                className="h-9 text-sm"
              />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-[var(--app-hint)] mb-1">
                Порций (на базовый Ø)
              </label>
              <Input
                type="number"
                inputMode="numeric"
                min="1"
                value={portionsCount}
                onChange={(e) =>
                  setPortionsCount(Math.max(1, Number(e.target.value) || 8))
                }
                className="h-9 text-sm"
              />
            </div>
            <div className="col-span-2">
              <label className="block text-[11px] font-medium text-[var(--app-hint)] mb-1">
                Вес готового торта, г (0 = автосумма ингредиентов)
              </label>
              <Input
                type="number"
                inputMode="numeric"
                min="0"
                value={finishedWeightGrams}
                onChange={(e) =>
                  setFinishedWeightGrams(
                    Math.max(0, Number(e.target.value) || 0)
                  )
                }
                placeholder="0 (авто)"
                className="h-9 text-sm"
              />
            </div>
          </div>
        )}
      </Card>

      {/* Sticky Quick Diameter Switcher */}
      <div className="sticky top-[52px] md:top-0 z-20 -mx-3.5 px-3.5 py-2.5 bg-[var(--app-bg)]/95 backdrop-blur-md border-y border-[var(--app-border)] md:mx-0 md:rounded-2xl md:border">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-bold">
            Пересчёт под диаметр (см)
          </span>
          <span className="rounded-lg bg-[var(--app-accent-soft)] px-2 py-0.5 text-xs font-bold tabular-nums text-[var(--app-accent)]">
            Ø {selectedDiameter} см · ×{coeff.toFixed(2)}
          </span>
        </div>
        <div className="flex gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
          {DIAMETERS.map((d) => {
            const active = selectedDiameter === d;
            const isBase = d === baseDiameter;
            return (
              <button
                key={d}
                type="button"
                onClick={() => {
                  hapticImpact("light");
                  setSelectedDiameter(d);
                }}
                className={`relative shrink-0 min-w-[44px] h-10 rounded-xl px-2.5 text-sm font-bold tabular-nums transition-all cursor-pointer ${
                  active
                    ? "bg-[var(--app-accent)] text-[var(--app-accent-text)] shadow-xs"
                    : "bg-[var(--app-card)] text-[var(--app-text)] border border-[var(--app-border)] hover:border-[var(--app-accent)]/50"
                }`}
              >
                {d}
                {isBase && (
                  <span
                    className={`absolute -top-1 -right-1 h-2 w-2 rounded-full ${
                      active ? "bg-[var(--app-card)]" : "bg-[var(--app-accent)]"
                    }`}
                    title="Базовый диаметр"
                  />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Live Cost & Profit KPI Card */}
      <Card className="p-4">
        <div className="grid grid-cols-3 gap-2.5">
          <div className="rounded-xl bg-[var(--app-subtle)] p-3">
            <div className="text-[11px] font-medium text-[var(--app-hint)]">
              Себестоимость
            </div>
            <div className="mt-1 text-base sm:text-lg font-bold tabular-nums">
              {formatMoney(calc.totalCost, currency)}
            </div>
          </div>

          <div className="rounded-xl bg-[var(--app-accent-soft)] p-3">
            <div className="text-[11px] font-medium text-[var(--app-accent)]">
              Продажа (+{markupPercent}%)
            </div>
            <div className="mt-1 text-base sm:text-lg font-bold tabular-nums text-[var(--app-accent)]">
              {formatMoney(calc.sellingPrice, currency)}
            </div>
          </div>

          <div className="rounded-xl bg-[var(--app-success-soft)] p-3">
            <div className="text-[11px] font-medium text-[var(--app-success)]">
              Прибыль
            </div>
            <div className="mt-1 text-base sm:text-lg font-bold tabular-nums text-[var(--app-success)]">
              {formatMoney(calc.netProfit, currency)}
            </div>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-[var(--app-border)] pt-3 text-xs">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <span>
              <span className="text-[var(--app-hint)]">Вес: </span>
              <strong className="tabular-nums">
                {formatWeight(calc.estimatedFinishedWeightGrams)}
              </strong>
            </span>
            <span>
              <span className="text-[var(--app-hint)]">За 1 кг: </span>
              <strong className="tabular-nums">
                {formatMoney(calc.pricePerKg, currency)}
              </strong>
            </span>
            <span>
              <span className="text-[var(--app-hint)]">
                За 1 порц. ({calc.scaledPortionsCount}):{" "}
              </span>
              <strong className="tabular-nums">
                {formatMoney(calc.pricePerPortion, currency)}
              </strong>
            </span>
          </div>

          {recipeId && (
            <Link
              href={`/calculators?tab=kbju&recipeId=${recipeId}&diameter=${selectedDiameter}`}
              onClick={() => hapticImpact("light")}
              className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--app-accent)] hover:underline"
            >
              <Calculator className="h-3.5 w-3.5" />
              <span>КБЖУ</span>
            </Link>
          )}
        </div>
      </Card>

      {/* Dynamic Components (Layers) */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-[var(--app-hint)]">
            <Layers className="h-4 w-4" />
            <span>Компоненты торта</span>
          </h2>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => addComponent()}
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Добавить слой</span>
          </Button>
        </div>

        {components.map((comp, compIndex) => {
          const calculatedComp = calc.components[compIndex];
          return (
            <Card key={comp.clientKey} className="overflow-hidden">
              {/* Component Header */}
              <div className="flex items-center gap-2 border-b border-[var(--app-border)] bg-[var(--app-subtle)]/70 px-3.5 py-2.5">
                <Input
                  value={comp.name}
                  onChange={(e) =>
                    updateComponentName(comp.clientKey, e.target.value)
                  }
                  placeholder="Название компонента (напр. Бисквит)"
                  className="h-9 flex-1 font-bold text-sm bg-[var(--app-card)]"
                />
                <div className="flex items-center gap-0.5 shrink-0">
                  <button
                    type="button"
                    disabled={compIndex === 0}
                    onClick={() => moveComponent(compIndex, -1)}
                    aria-label="Выше"
                    className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--app-hint)] hover:bg-[var(--app-card)] disabled:opacity-30 cursor-pointer"
                  >
                    <ArrowUp className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    disabled={compIndex === components.length - 1}
                    onClick={() => moveComponent(compIndex, 1)}
                    aria-label="Ниже"
                    className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--app-hint)] hover:bg-[var(--app-card)] disabled:opacity-30 cursor-pointer"
                  >
                    <ArrowDown className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => removeComponent(comp.clientKey)}
                    aria-label="Удалить слой"
                    className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--app-danger)] hover:bg-[var(--app-danger-soft)] cursor-pointer"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Ingredient Lines */}
              <div className="divide-y divide-[var(--app-border)]">
                {comp.ingredients.length === 0 ? (
                  <div className="px-4 py-4 text-center text-xs text-[var(--app-hint)]">
                    В этом слое пока нет ингредиентов
                  </div>
                ) : (
                  comp.ingredients.map((line) => {
                    const ing = ingredientMap.get(line.ingredientId);
                    if (!ing) return null;
                    const baseG =
                      parseFloat(line.baseGrams.replace(",", ".")) || 0;
                    const scaledG = baseG * coeff;
                    const lineCost = (scaledG / 1000) * ing.pricePerKg;

                    return (
                      <div
                        key={line.clientKey}
                        className="flex items-center gap-2.5 px-3.5 py-2.5"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-medium">
                            {ing.name}
                          </div>
                          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[11px] tabular-nums text-[var(--app-hint)]">
                            <span>
                              {formatMoney(ing.pricePerKg, currency)}/кг
                            </span>
                            {selectedDiameter !== baseDiameter && (
                              <span className="font-semibold text-[var(--app-accent)]">
                                → {roundGrams(scaledG)} г на Ø{selectedDiameter}
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <div className="relative w-21">
                            <Input
                              type="number"
                              inputMode="decimal"
                              min="0"
                              step="any"
                              value={line.baseGrams}
                              onChange={(e) =>
                                updateLineGrams(
                                  comp.clientKey,
                                  line.clientKey,
                                  e.target.value
                                )
                              }
                              placeholder="0"
                              className="h-9 pr-6 text-right text-sm font-semibold tabular-nums"
                            />
                            <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[11px] text-[var(--app-hint)]">
                              г
                            </span>
                          </div>

                          <div className="w-18 text-right text-xs font-bold tabular-nums">
                            {formatMoney(lineCost, currency)}
                          </div>

                          <button
                            type="button"
                            onClick={() =>
                              removeLine(comp.clientKey, line.clientKey)
                            }
                            aria-label="Убрать ингредиент"
                            className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--app-hint)] hover:text-[var(--app-danger)] cursor-pointer"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Component Footer */}
              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[var(--app-border)] bg-[var(--app-subtle)]/40 px-3.5 py-2.5">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-[var(--app-accent)] hover:bg-[var(--app-accent-soft)] px-2.5"
                  onClick={() => {
                    hapticImpact("light");
                    setPickerSearch("");
                    setPickerCompKey(comp.clientKey);
                  }}
                >
                  <Plus className="h-4 w-4" />
                  <span>Ингредиент</span>
                </Button>

                <div className="text-xs tabular-nums text-[var(--app-hint)]">
                  Итого слой:{" "}
                  <strong className="text-[var(--app-text)]">
                    {formatWeight(calculatedComp?.totalGrams ?? 0)}
                  </strong>{" "}
                  ·{" "}
                  <strong className="text-[var(--app-accent)]">
                    {formatMoney(calculatedComp?.totalCost ?? 0, currency)}
                  </strong>
                </div>
              </div>
            </Card>
          );
        })}

        {/* Quick Preset Chips for Adding Layers */}
        <div className="flex flex-wrap gap-1.5">
          {COMPONENT_PRESETS.map((preset) => (
            <button
              key={preset}
              type="button"
              onClick={() => addComponent(preset)}
              className="rounded-xl border border-dashed border-[var(--app-border)] px-3 py-1.5 text-xs font-medium text-[var(--app-hint)] hover:border-[var(--app-accent)] hover:text-[var(--app-accent)] cursor-pointer"
            >
              + {preset}
            </button>
          ))}
        </div>
      </div>

      {/* Consolidated Summary Table (Сводка по торту) */}
      {calc.aggregated.length > 0 && (
        <Card className="overflow-hidden">
          <div className="flex items-center justify-between border-b border-[var(--app-border)] px-4 py-3">
            <div>
              <h3 className="text-sm font-bold">Сводка по торту</h3>
              <p className="text-[11px] text-[var(--app-hint)]">
                Общий расход каждого продукта на Ø {selectedDiameter} см
              </p>
            </div>
            <span className="rounded-lg bg-[var(--app-subtle)] px-2.5 py-1 text-xs font-bold tabular-nums">
              {formatWeight(calc.totalRawWeightGrams)}
            </span>
          </div>

          <div className="divide-y divide-[var(--app-border)]">
            {calc.aggregated.map((item) => (
              <div
                key={item.ingredientId}
                className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm"
              >
                <span className="truncate font-medium">{item.name}</span>
                <div className="flex items-center gap-3 shrink-0 tabular-nums">
                  <span className="font-semibold">
                    {formatWeight(item.totalGrams)}
                  </span>
                  <span className="w-20 text-right text-xs font-bold text-[var(--app-accent)]">
                    {formatMoney(item.totalCost, currency)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Ingredient Picker Modal */}
      <Modal
        open={pickerCompKey !== null}
        onClose={() => setPickerCompKey(null)}
        title="Выбрать ингредиент"
        subtitle="Из вашего склада или создайте новый продукт сразу"
      >
        <div className="space-y-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--app-hint)]" />
            <Input
              value={pickerSearch}
              onChange={(e) => setPickerSearch(e.target.value)}
              placeholder="Найти продукт..."
              className="pl-10"
              autoFocus
            />
          </div>

          <Button
            type="button"
            variant="secondary"
            className="w-full justify-center border border-dashed border-[var(--app-accent)]/50 text-[var(--app-accent)]"
            onClick={() => {
              hapticImpact("light");
              setQuickCreateOpen(true);
            }}
          >
            <Plus className="h-4 w-4" />
            <span>
              {pickerSearch.trim()
                ? `Создать «${pickerSearch.trim()}» на складе`
                : "Создать новый продукт на складе"}
            </span>
          </Button>

          {allIngredients.length === 0 ? (
            <p className="py-4 text-center text-xs text-[var(--app-hint)]">
              На складе пока нет продуктов. Нажмите кнопку выше, чтобы добавить
              первый продукт прямо сейчас.
            </p>
          ) : pickerFiltered.length === 0 ? (
            <p className="py-4 text-center text-xs text-[var(--app-hint)]">
              Продукт не найден — вы можете создать его кнопкой выше.
            </p>
          ) : (
            <div className="max-h-72 overflow-y-auto divide-y divide-[var(--app-border)] rounded-xl border border-[var(--app-border)]">
              {pickerFiltered.map((ing) => (
                <button
                  key={ing.id}
                  type="button"
                  onClick={() => {
                    if (pickerCompKey) {
                      addIngredientToComponent(pickerCompKey, ing);
                    }
                  }}
                  className="flex w-full items-center justify-between px-3.5 py-3 text-left hover:bg-[var(--app-subtle)] cursor-pointer"
                >
                  <span className="text-sm font-medium truncate pr-2">
                    {ing.name}
                  </span>
                  <span className="shrink-0 text-xs font-bold tabular-nums text-[var(--app-accent)]">
                    {formatMoney(ing.pricePerKg, currency)}/кг
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </Modal>

      {/* Quick Create Ingredient right inside Tech Card */}
      <IngredientFormModal
        open={quickCreateOpen}
        onClose={() => setQuickCreateOpen(false)}
        initialName={pickerSearch.trim()}
        onSaved={(created) => {
          setAllIngredients((prev) =>
            [...prev, created].sort((a, b) => a.name.localeCompare(b.name, "ru"))
          );
          if (pickerCompKey) {
            addIngredientToComponent(pickerCompKey, created);
          }
        }}
      />
    </div>
  );
}
