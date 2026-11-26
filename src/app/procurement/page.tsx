"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Check,
  Copy,
  Minus,
  Plus,
  Save,
  Send,
  ShoppingBasket,
  Trash2,
} from "lucide-react";
import type {
  ProcurementPlan,
  ProcurementPlanItem,
  RecipeWithDetails,
} from "@/types/pastry";
import { DIAMETERS } from "@/types/pastry";
import {
  calculateProcurementList,
  formatMoney,
  formatWeightDetailed,
} from "@/lib/calculations";
import {
  hapticImpact,
  hapticNotification,
  openTelegramShare,
} from "@/lib/telegram";
import { useApp } from "@/components/providers/AppProvider";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

const CHECKED_STORAGE_KEY = "pastry_procurement_checked_v1";

export default function ProcurementPage() {
  const { currency, showToast } = useApp();

  const [recipes, setRecipes] = useState<RecipeWithDetails[]>([]);
  const [plans, setPlans] = useState<ProcurementPlan[]>([]);
  const [loading, setLoading] = useState(true);

  const [activePlanId, setActivePlanId] = useState<number | null>(null);
  const [planName, setPlanName] = useState("Список закупівлі");
  const [items, setItems] = useState<ProcurementPlanItem[]>([]);
  const [checkedIds, setCheckedIds] = useState<number[]>([]);
  const [saving, setSaving] = useState(false);

  // Quick-add selector state
  const [selectedRecipeId, setSelectedRecipeId] = useState<string>("");
  const [selectedDiameter, setSelectedDiameter] = useState<number>(16);
  const [selectedQty, setSelectedQty] = useState<number>(1);

  const loadData = useCallback(async () => {
    try {
      const [recRes, planRes] = await Promise.all([
        fetch("/api/recipes", { cache: "no-store" }),
        fetch("/api/procurement", { cache: "no-store" }),
      ]);
      const recData: RecipeWithDetails[] = recRes.ok ? await recRes.json() : [];
      const planData: ProcurementPlan[] = planRes.ok ? await planRes.json() : [];

      setRecipes(recData);
      setPlans(planData);

      if (recData.length > 0) {
        setSelectedRecipeId(String(recData[0].id));
        setSelectedDiameter(recData[0].baseDiameter || 16);
      }

      if (planData.length > 0) {
        const latest = planData[0];
        setActivePlanId(latest.id);
        setPlanName(latest.name);
        setItems(latest.itemsJson ?? []);
      }
    } catch {
      showToast("Не вдалося завантажити дані закупівель", "error");
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Restore checked state per plan from localStorage
  useEffect(() => {
    try {
      const raw = localStorage.getItem(
        `${CHECKED_STORAGE_KEY}_${activePlanId ?? "draft"}`
      );
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) setCheckedIds(parsed);
        else setCheckedIds([]);
      } else {
        setCheckedIds([]);
      }
    } catch {
      setCheckedIds([]);
    }
  }, [activePlanId]);

  const persistChecked = useCallback(
    (next: number[]) => {
      setCheckedIds(next);
      try {
        localStorage.setItem(
          `${CHECKED_STORAGE_KEY}_${activePlanId ?? "draft"}`,
          JSON.stringify(next)
        );
      } catch {
        // ignore
      }
    },
    [activePlanId]
  );

  const recipeMap = useMemo(
    () => new Map(recipes.map((r) => [r.id, r])),
    [recipes]
  );

  const summary = useMemo(
    () => calculateProcurementList(items, recipes),
    [items, recipes]
  );

  function handleAddCakeToPlan() {
    const rid = Number(selectedRecipeId);
    if (!rid || !recipeMap.has(rid)) return;
    hapticImpact("light");

    setItems((prev) => {
      const existingIdx = prev.findIndex(
        (i) => i.recipe_id === rid && i.diameter === selectedDiameter
      );
      if (existingIdx >= 0) {
        const copy = [...prev];
        copy[existingIdx] = {
          ...copy[existingIdx],
          quantity: copy[existingIdx].quantity + selectedQty,
        };
        return copy;
      }
      return [
        ...prev,
        { recipe_id: rid, diameter: selectedDiameter, quantity: selectedQty },
      ];
    });
  }

  function updateItemQuantity(index: number, delta: number) {
    hapticImpact("light");
    setItems((prev) => {
      const copy = [...prev];
      const nextQty = copy[index].quantity + delta;
      if (nextQty <= 0) {
        copy.splice(index, 1);
      } else {
        copy[index] = { ...copy[index], quantity: nextQty };
      }
      return copy;
    });
  }

  function toggleChecked(ingredientId: number) {
    hapticImpact("light");
    const exists = checkedIds.includes(ingredientId);
    const next = exists
      ? checkedIds.filter((id) => id !== ingredientId)
      : [...checkedIds, ingredientId];
    persistChecked(next);
  }

  async function handleSavePlan() {
    setSaving(true);
    try {
      const payload = {
        name: planName.trim() || "Список закупівлі",
        itemsJson: items,
      };
      const url = activePlanId
        ? `/api/procurement/${activePlanId}`
        : "/api/procurement";
      const method = activePlanId ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await res.json()) as ProcurementPlan;
      if (!res.ok) throw new Error();

      hapticNotification("success");
      setActivePlanId(data.id);
      setPlans((prev) => {
        const exists = prev.some((p) => p.id === data.id);
        return exists
          ? prev.map((p) => (p.id === data.id ? data : p))
          : [data, ...prev];
      });
      showToast("План закупівлі збережено", "success");
    } catch {
      hapticNotification("error");
      showToast("Не вдалося зберегти закупівлю", "error");
    } finally {
      setSaving(false);
    }
  }

  function handleNewPlan() {
    hapticImpact("light");
    setActivePlanId(null);
    setPlanName("Нова закупівля");
    setItems([]);
    setCheckedIds([]);
  }

  async function handleDeletePlan() {
    if (!activePlanId) return;
    hapticImpact("medium");
    if (!window.confirm(`Видалити план «${planName}»?`)) return;
    try {
      const res = await fetch(`/api/procurement/${activePlanId}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error();
      const remaining = plans.filter((p) => p.id !== activePlanId);
      setPlans(remaining);
      if (remaining.length > 0) {
        setActivePlanId(remaining[0].id);
        setPlanName(remaining[0].name);
        setItems(remaining[0].itemsJson ?? []);
      } else {
        handleNewPlan();
      }
      showToast("План видалено", "success");
    } catch {
      showToast("Не вдалося видалити план", "error");
    }
  }

  function buildShareText(): string {
    const header = `🛒 ${planName || "Список закупівлі"}`;
    const cakesLines = items
      .map((item) => {
        const r = recipeMap.get(item.recipe_id);
        return r ? `• ${r.name} (Ø ${item.diameter} см) × ${item.quantity} шт` : null;
      })
      .filter(Boolean)
      .join("\n");

    const unchecked = summary.shoppingList.filter(
      (i) => !checkedIds.includes(i.ingredientId)
    );
    const listToExport =
      unchecked.length > 0 ? unchecked : summary.shoppingList;

    const productLines = listToExport
      .map(
        (i) =>
          `☐ ${i.name} — ${formatWeightDetailed(i.totalGrams)} (~${formatMoney(
            i.estimatedCost,
            currency
          )})`
      )
      .join("\n");

    return [
      header,
      cakesLines ? `\nЗамовлення:\n${cakesLines}` : "",
      `\nПотрібно купити:\n${productLines}`,
      `\nОрієнтовний бюджет: ${formatMoney(summary.totalBudget, currency)}`,
    ]
      .filter(Boolean)
      .join("\n");
  }

  async function handleCopy() {
    hapticImpact("light");
    const text = buildShareText();
    try {
      await navigator.clipboard.writeText(text);
      hapticNotification("success");
      showToast("Список скопійовано в буфер", "success");
    } catch {
      showToast("Не вдалося скопіювати текст", "error");
    }
  }

  function handleShareTelegram() {
    hapticImpact("medium");
    openTelegramShare(buildShareText());
  }

  const boughtCount = summary.shoppingList.filter((i) =>
    checkedIds.includes(i.ingredientId)
  ).length;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Закупівля</h1>
          <p className="text-xs text-[var(--app-hint)]">
            Загальний список продуктів під обрані замовлення
          </p>
        </div>
        {recipes.length > 0 && (
          <div className="flex items-center gap-1.5">
            {plans.length > 0 && (
              <Button variant="outline" size="sm" onClick={handleNewPlan}>
                <Plus className="h-3.5 w-3.5" />
                <span>Новий</span>
              </Button>
            )}
            <Button
              size="sm"
              onClick={handleSavePlan}
              disabled={saving || items.length === 0}
            >
              <Save className="h-3.5 w-3.5" />
              <span>{saving ? "..." : "Зберегти"}</span>
            </Button>
          </div>
        )}
      </div>

      {loading ? (
        <div className="space-y-3">
          <div className="h-36 rounded-2xl bg-[var(--app-subtle)] animate-pulse" />
          <div className="h-44 rounded-2xl bg-[var(--app-subtle)] animate-pulse" />
        </div>
      ) : recipes.length === 0 ? (
        <Card className="p-8 text-center">
          <div className="mx-auto mb-3.5 flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--app-accent-soft)] text-[var(--app-accent)]">
            <ShoppingBasket className="h-7 w-7" />
          </div>
          <h2 className="text-base font-bold">Спочатку додайте рецепти</h2>
          <p className="mx-auto mt-1.5 max-w-xs text-xs text-[var(--app-hint)] leading-relaxed">
            Планувальник закупівель збирає продукти з ваших збережених техкарт і
            перераховує їх під обрані діаметри.
          </p>
          <Link href="/recipes/new" className="inline-block mt-5">
            <Button>
              <Plus className="h-4 w-4" />
              <span>Створити перший торт</span>
            </Button>
          </Link>
        </Card>
      ) : (
        <>
          {/* Saved Plans Bar */}
          {plans.length > 0 && (
            <div className="flex gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
              {plans.map((p) => {
                const active = p.id === activePlanId;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => {
                      hapticImpact("light");
                      setActivePlanId(p.id);
                      setPlanName(p.name);
                      setItems(p.itemsJson ?? []);
                    }}
                    className={`shrink-0 rounded-xl px-3 py-1.5 text-xs font-semibold transition-all cursor-pointer ${
                      active
                        ? "bg-[var(--app-accent)] text-[var(--app-accent-text)]"
                        : "bg-[var(--app-card)] border border-[var(--app-border)] text-[var(--app-text)]"
                    }`}
                  >
                    {p.name}
                  </button>
                );
              })}
            </div>
          )}

          {/* Plan Name + Cake Adder Card */}
          <Card className="p-4 space-y-3.5">
            <div className="flex items-center gap-2">
              <Input
                value={planName}
                onChange={(e) => setPlanName(e.target.value)}
                placeholder="Назва закупівлі (напр. На суботу)"
                className="font-semibold"
              />
              {activePlanId && (
                <Button
                  type="button"
                  variant="destructive"
                  size="icon"
                  onClick={handleDeletePlan}
                  aria-label="Видалити план"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5">
              <div className="sm:col-span-6">
                <label className="block text-[11px] font-medium text-[var(--app-hint)] mb-1">
                  Торт із бази
                </label>
                <select
                  value={selectedRecipeId}
                  onChange={(e) => {
                    setSelectedRecipeId(e.target.value);
                    const rec = recipeMap.get(Number(e.target.value));
                    if (rec) setSelectedDiameter(rec.baseDiameter || 16);
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

              <div className="grid grid-cols-2 gap-2.5 sm:col-span-6">
                <div>
                  <label className="block text-[11px] font-medium text-[var(--app-hint)] mb-1">
                    Діаметр
                  </label>
                  <select
                    value={selectedDiameter}
                    onChange={(e) => setSelectedDiameter(Number(e.target.value))}
                    className="app-input h-11 w-full rounded-xl px-3 text-sm tabular-nums"
                  >
                    {DIAMETERS.map((d) => (
                      <option key={d} value={d}>
                        Ø {d} см
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-[var(--app-hint)] mb-1">
                    Кількість (шт)
                  </label>
                  <Input
                    type="number"
                    inputMode="numeric"
                    min="1"
                    max="100"
                    value={selectedQty}
                    onChange={(e) =>
                      setSelectedQty(Math.max(1, Number(e.target.value) || 1))
                    }
                  />
                </div>
              </div>
            </div>

            <Button
              type="button"
              variant="secondary"
              className="w-full"
              onClick={handleAddCakeToPlan}
            >
              <Plus className="h-4 w-4" />
              <span>Додати до списку закупівлі</span>
            </Button>

            {/* Selected Cakes List */}
            {items.length > 0 && (
              <div className="space-y-2 border-t border-[var(--app-border)] pt-3">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--app-hint)]">
                  Обрані торти ({summary.totalCakesCount} шт)
                </div>
                {items.map((item, idx) => {
                  const rec = recipeMap.get(item.recipe_id);
                  if (!rec) return null;
                  return (
                    <div
                      key={`${item.recipe_id}-${item.diameter}`}
                      className="flex items-center justify-between gap-2 rounded-xl bg-[var(--app-subtle)] px-3 py-2"
                    >
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold">
                          {rec.name}
                        </div>
                        <div className="text-xs text-[var(--app-hint)]">
                          Діаметр {item.diameter} см
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => updateItemQuantity(idx, -1)}
                          aria-label="Зменшити"
                          className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--app-card)] border border-[var(--app-border)] cursor-pointer active:scale-95"
                        >
                          <Minus className="h-3.5 w-3.5" />
                        </button>
                        <span className="w-7 text-center text-sm font-bold tabular-nums">
                          {item.quantity}
                        </span>
                        <button
                          type="button"
                          onClick={() => updateItemQuantity(idx, 1)}
                          aria-label="Збільшити"
                          className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--app-card)] border border-[var(--app-border)] cursor-pointer active:scale-95"
                        >
                          <Plus className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>

          {/* Shopping List Output */}
          {summary.shoppingList.length > 0 ? (
            <Card className="overflow-hidden">
              <div className="p-4 border-b border-[var(--app-border)] space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <h2 className="text-base font-bold">Список покупок</h2>
                    <p className="text-xs text-[var(--app-hint)]">
                      Куплено {boughtCount} із {summary.shoppingList.length}
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="text-[11px] text-[var(--app-hint)]">
                      Сума закупівлі
                    </div>
                    <div className="text-lg font-bold tabular-nums text-[var(--app-accent)]">
                      {formatMoney(summary.totalBudget, currency)}
                    </div>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--app-subtle)]">
                  <div
                    className="h-full rounded-full bg-[var(--app-success)] transition-all duration-300"
                    style={{
                      width: `${
                        (boughtCount / summary.shoppingList.length) * 100
                      }%`,
                    }}
                  />
                </div>

                {/* Share & Copy Actions */}
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    type="button"
                    size="sm"
                    onClick={handleShareTelegram}
                    className="h-10"
                  >
                    <Send className="h-3.5 w-3.5" />
                    <span>У Telegram</span>
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleCopy}
                    className="h-10"
                  >
                    <Copy className="h-3.5 w-3.5" />
                    <span>Скопіювати</span>
                  </Button>
                </div>
              </div>

              {/* Large Touch-Friendly Checklist */}
              <div className="divide-y divide-[var(--app-border)]">
                {summary.shoppingList.map((item) => {
                  const checked = checkedIds.includes(item.ingredientId);
                  return (
                    <button
                      key={item.ingredientId}
                      type="button"
                      onClick={() => toggleChecked(item.ingredientId)}
                      className={`flex w-full items-center gap-3.5 px-4 py-3.5 text-left transition-colors cursor-pointer ${
                        checked
                          ? "bg-[var(--app-subtle)]/50 opacity-60"
                          : "hover:bg-[var(--app-subtle)]/40"
                      }`}
                    >
                      <span
                        className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border-2 transition-all ${
                          checked
                            ? "border-[var(--app-success)] bg-[var(--app-success)] text-white"
                            : "border-[var(--app-border)] bg-[var(--app-card)]"
                        }`}
                      >
                        {checked && <Check className="h-4 w-4 stroke-[3]" />}
                      </span>

                      <div className="min-w-0 flex-1">
                        <div
                          className={`text-sm font-semibold ${
                            checked ? "line-through text-[var(--app-hint)]" : ""
                          }`}
                        >
                          {item.name}
                        </div>
                        <div className="text-xs tabular-nums text-[var(--app-hint)]">
                          ~{formatMoney(item.estimatedCost, currency)}
                        </div>
                      </div>

                      <div className="shrink-0 text-right">
                        <span className="rounded-lg bg-[var(--app-subtle)] px-2.5 py-1 text-sm font-bold tabular-nums">
                          {formatWeightDetailed(item.totalGrams)}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </Card>
          ) : (
            <Card className="p-6 text-center text-xs text-[var(--app-hint)]">
              Оберіть один або кілька тортів вище, щоб сформувати загальний
              список покупок.
            </Card>
          )}
        </>
      )}
    </div>
  );
}
