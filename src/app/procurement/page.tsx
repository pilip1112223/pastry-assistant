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
  formatProcurementQuantity,
  formatProcurementQuantityText,
} from "@/lib/calculations";
import { apiFetch } from "@/lib/api-client";
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
  const { currency, userId, showToast } = useApp();

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
        apiFetch("/api/recipes", { cache: "no-store" }),
        apiFetch("/api/procurement", { cache: "no-store" }),
      ]);
      const recData: RecipeWithDetails[] = recRes.ok ? await recRes.json() : [];
      const planData: ProcurementPlan[] = planRes.ok
        ? await planRes.json()
        : [];

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

  // Restore checked state per user & plan from localStorage
  useEffect(() => {
    try {
      const raw = localStorage.getItem(
        `${CHECKED_STORAGE_KEY}_${userId || "anon"}_${activePlanId ?? "draft"}`
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
  }, [activePlanId, userId]);

  const persistChecked = useCallback(
    (next: number[]) => {
      setCheckedIds(next);
      try {
        localStorage.setItem(
          `${CHECKED_STORAGE_KEY}_${userId || "anon"}_${activePlanId ?? "draft"}`,
          JSON.stringify(next)
        );
      } catch {
        // ignore
      }
    },
    [activePlanId, userId]
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

      const res = await apiFetch(url, {
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
      const res = await apiFetch(`/api/procurement/${activePlanId}`, {
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
        return r
          ? `• ${r.name} (Ø ${item.diameter} см) × ${item.quantity} шт`
          : null;
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
          `☐ ${i.name} — ${formatProcurementQuantityText(
            i.totalGrams,
            i.unitType
          )} (~${formatMoney(i.estimatedCost, currency)})`
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
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-[22px] sm:text-2xl font-extrabold tracking-[-0.025em]">
            Закупівля
          </h1>
          <p className="mt-0.5 text-xs font-medium text-[var(--app-hint)]">
            Загальний список продуктів під обрані замовлення
          </p>
        </div>
        {recipes.length > 0 && (
          <div className="flex items-center gap-2">
            {plans.length > 0 && (
              <Button variant="outline" size="sm" onClick={handleNewPlan}>
                <Plus className="h-4 w-4" strokeWidth={2.2} />
                <span className="hidden sm:inline">Новий</span>
              </Button>
            )}
            <Button
              size="sm"
              onClick={handleSavePlan}
              disabled={saving || items.length === 0}
              className="px-4"
            >
              <Save className="h-4 w-4" strokeWidth={2.1} />
              <span>{saving ? "..." : "Зберегти"}</span>
            </Button>
          </div>
        )}
      </div>

      {loading ? (
        <div className="space-y-4">
          <Card className="p-4.5 space-y-3">
            <div className="h-11 w-full rounded-[14px] skeleton-shimmer" />
            <div className="grid grid-cols-2 gap-3">
              <div className="h-11 rounded-[14px] skeleton-shimmer" />
              <div className="h-11 rounded-[14px] skeleton-shimmer" />
            </div>
            <div className="h-11 w-full rounded-[14px] skeleton-shimmer" />
          </Card>
          <Card className="p-4.5 space-y-3">
            <div className="h-6 w-40 rounded-lg skeleton-shimmer" />
            <div className="h-14 w-full rounded-xl skeleton-shimmer" />
            <div className="h-14 w-full rounded-xl skeleton-shimmer" />
          </Card>
        </div>
      ) : recipes.length === 0 ? (
        <Card className="p-8 sm:p-10 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-[22px] bg-[var(--app-accent-soft)] text-[var(--app-accent)] shadow-[inset_0_0_0_1px_rgba(200,90,50,0.14)]">
            <ShoppingBasket className="h-8 w-8" strokeWidth={1.7} />
          </div>
          <h2 className="text-[17px] font-extrabold tracking-[-0.015em]">
            Спочатку додайте рецепти
          </h2>
          <p className="mx-auto mt-2 max-w-sm text-[13px] text-[var(--app-hint)] leading-relaxed">
            Планувальник закупівель збирає продукти з ваших збережених техкарт і
            автоматично підсумовує їх під потрібні діаметри.
          </p>
          <Link href="/recipes/new" className="inline-block mt-6">
            <Button className="px-6">
              <Plus className="h-4 w-4" strokeWidth={2.3} />
              <span>Додати перший торт</span>
            </Button>
          </Link>
        </Card>
      ) : (
        <>
          {/* Saved Plans Bar */}
          {plans.length > 0 && (
            <div className="flex gap-2 overflow-x-auto no-scrollbar pb-0.5">
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
                    className={`shrink-0 min-h-[40px] rounded-full px-4 py-2 text-xs font-bold transition-all active:scale-[0.97] cursor-pointer ${
                      active
                        ? "bg-[var(--app-accent)] text-white shadow-[0_3px_10px_rgba(200,90,50,0.24)]"
                        : "bg-[var(--app-card)] border border-[var(--app-border)] text-[var(--app-text)] hover:border-[var(--app-border-strong)]"
                    }`}
                  >
                    {p.name}
                  </button>
                );
              })}
            </div>
          )}

          {/* Plan Name + Cake Adder Card */}
          <Card className="p-4.5 space-y-4">
            <div className="flex items-center gap-2">
              <Input
                value={planName}
                onChange={(e) => setPlanName(e.target.value)}
                placeholder="Назва закупівлі (напр. На суботу)"
                className="font-bold text-[15px]"
              />
              {activePlanId && (
                <Button
                  type="button"
                  variant="destructive"
                  size="icon"
                  onClick={handleDeletePlan}
                  aria-label="Видалити план"
                >
                  <Trash2 className="h-4 w-4" strokeWidth={2} />
                </Button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
              <div className="sm:col-span-6">
                <label className="block text-[11px] font-bold text-[var(--app-hint)] mb-1.5">
                  Торт із бази
                </label>
                <select
                  value={selectedRecipeId}
                  onChange={(e) => {
                    setSelectedRecipeId(e.target.value);
                    const rec = recipeMap.get(Number(e.target.value));
                    if (rec) setSelectedDiameter(rec.baseDiameter || 16);
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

              <div className="grid grid-cols-2 gap-3 sm:col-span-6">
                <div>
                  <label className="block text-[11px] font-bold text-[var(--app-hint)] mb-1.5">
                    Діаметр
                  </label>
                  <select
                    value={selectedDiameter}
                    onChange={(e) =>
                      setSelectedDiameter(Number(e.target.value))
                    }
                    className="app-input h-11 min-h-[44px] w-full rounded-[14px] px-3.5 text-sm font-semibold tabular-nums"
                  >
                    {DIAMETERS.map((d) => (
                      <option key={d} value={d}>
                        Ø {d} см
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-[var(--app-hint)] mb-1.5">
                    Кількість
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
                    suffix="шт"
                    className="tabular-nums font-bold"
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
              <Plus className="h-4 w-4" strokeWidth={2.3} />
              <span>Додати до списку закупівлі</span>
            </Button>

            {/* Selected Cakes List */}
            {items.length > 0 && (
              <div className="space-y-2 border-t border-[var(--app-border)] pt-3.5">
                <div className="text-[11px] font-bold uppercase tracking-[0.06em] text-[var(--app-hint)]">
                  Обрані торти ({summary.totalCakesCount} шт)
                </div>
                {items.map((item, idx) => {
                  const rec = recipeMap.get(item.recipe_id);
                  if (!rec) return null;
                  return (
                    <div
                      key={`${item.recipe_id}-${item.diameter}`}
                      className="flex items-center justify-between gap-2 rounded-[15px] bg-[var(--app-bg)] border border-[var(--app-border)] px-3.5 py-2.5"
                    >
                      <div className="min-w-0">
                        <div className="truncate text-[14px] font-bold">
                          {rec.name}
                        </div>
                        <div className="text-xs font-medium text-[var(--app-hint)] tabular-nums">
                          Діаметр {item.diameter} см
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => updateItemQuantity(idx, -1)}
                          aria-label="Зменшити"
                          className="flex h-11 w-11 min-h-[44px] min-w-[44px] items-center justify-center rounded-[12px] bg-[var(--app-card)] border border-[var(--app-border)] hover:border-[var(--app-border-strong)] cursor-pointer active:scale-95 transition-all"
                        >
                          <Minus className="h-4 w-4" />
                        </button>
                        <span className="w-8 text-center text-[15px] font-extrabold tabular-nums">
                          {item.quantity}
                        </span>
                        <button
                          type="button"
                          onClick={() => updateItemQuantity(idx, 1)}
                          aria-label="Збільшити"
                          className="flex h-11 w-11 min-h-[44px] min-w-[44px] items-center justify-center rounded-[12px] bg-[var(--app-card)] border border-[var(--app-border)] hover:border-[var(--app-border-strong)] cursor-pointer active:scale-95 transition-all"
                        >
                          <Plus className="h-4 w-4" />
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
              <div className="p-4.5 border-b border-[var(--app-border)] space-y-3.5 bg-[var(--app-bg)]/40">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <h2 className="text-[17px] font-extrabold tracking-[-0.015em]">
                      Список покупок
                    </h2>
                    <p className="text-xs font-medium text-[var(--app-hint)] tabular-nums">
                      Куплено {boughtCount} із {summary.shoppingList.length}
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="text-[10.5px] font-bold uppercase tracking-[0.04em] text-[var(--app-hint)]">
                      Орієнтовна сума
                    </div>
                    <div className="text-[19px] font-extrabold tabular-nums text-[var(--app-accent)]">
                      {formatMoney(summary.totalBudget, currency)}
                    </div>
                  </div>
                </div>

                {/* Smooth Progress bar */}
                <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--app-subtle)]">
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
                <div className="grid grid-cols-2 gap-2.5">
                  <Button
                    type="button"
                    size="sm"
                    onClick={handleShareTelegram}
                  >
                    <Send className="h-4 w-4" strokeWidth={2} />
                    <span>У Telegram</span>
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleCopy}
                  >
                    <Copy className="h-4 w-4" strokeWidth={2} />
                    <span>Скопіювати</span>
                  </Button>
                </div>
              </div>

              {/* Large Touch-Friendly Checklist */}
              <div className="divide-y divide-[var(--app-border)]">
                {summary.shoppingList.map((item) => {
                  const checked = checkedIds.includes(item.ingredientId);
                  const qtyDisplay = formatProcurementQuantity(
                    item.totalGrams,
                    item.unitType
                  );
                  return (
                    <button
                      key={item.ingredientId}
                      type="button"
                      onClick={() => toggleChecked(item.ingredientId)}
                      className={`flex w-full min-h-[60px] items-center gap-3.5 px-4.5 py-3.5 text-left transition-all active:bg-[var(--app-subtle)] cursor-pointer ${
                        checked
                          ? "bg-[var(--app-bg)]/60 opacity-65"
                          : "hover:bg-[var(--app-bg)]/50"
                      }`}
                    >
                      <span
                        className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border-2 transition-all ${
                          checked
                            ? "border-[var(--app-success)] bg-[var(--app-success)] text-white scale-105"
                            : "border-[var(--app-border-strong)] bg-[var(--app-card)]"
                        }`}
                      >
                        {checked && <Check className="h-4 w-4 stroke-[3]" />}
                      </span>

                      <div className="min-w-0 flex-1">
                        <div
                          className={`text-[14.5px] font-bold ${
                            checked
                              ? "line-through text-[var(--app-hint)]"
                              : ""
                          }`}
                        >
                          {item.name}
                        </div>
                        <div className="text-xs font-medium tabular-nums text-[var(--app-hint)]">
                          ~{formatMoney(item.estimatedCost, currency)}
                        </div>
                      </div>

                      <div className="shrink-0 text-right">
                        <span className="inline-block rounded-full bg-[var(--app-subtle)] px-3 py-1 text-[13px] font-extrabold tabular-nums text-[var(--app-text)]">
                          {qtyDisplay.primary}
                        </span>
                        {qtyDisplay.exactNote && (
                          <div className="mt-0.5 text-[10.5px] font-semibold tabular-nums text-[var(--app-hint)]">
                            {qtyDisplay.exactNote}
                          </div>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </Card>
          ) : (
            <Card className="p-7 text-center">
              <p className="text-sm font-semibold text-[var(--app-text)]">
                Список покупок поки порожній
              </p>
              <p className="mt-1 text-xs text-[var(--app-hint)]">
                Оберіть один або кілька тортів вище, щоб сформувати загальний
                перелік інгредієнтів.
              </p>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
