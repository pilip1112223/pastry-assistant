"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  CakeSlice,
  ChevronRight,
  Flame,
  Layers,
  Plus,
  Scale,
  Search,
  X,
} from "lucide-react";
import type { RecipeWithDetails } from "@/types/pastry";
import {
  calculateKbju,
  calculateRecipe,
  formatMoney,
  formatWeight,
} from "@/lib/calculations";
import { hapticImpact } from "@/lib/telegram";
import { useApp } from "@/components/providers/AppProvider";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

function formatLayersLabel(count: number): string {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return `${count} шар`;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) {
    return `${count} шари`;
  }
  return `${count} шарів`;
}

export default function RecipesListPage() {
  const { currency, showToast } = useApp();
  const [recipes, setRecipes] = useState<RecipeWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const loadRecipes = useCallback(async () => {
    try {
      const res = await fetch("/api/recipes", { cache: "no-store" });
      if (!res.ok) throw new Error();
      const data = (await res.json()) as RecipeWithDetails[];
      setRecipes(data);
    } catch {
      showToast("Не вдалося завантажити рецепти", "error");
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    loadRecipes();
  }, [loadRecipes]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return recipes;
    return recipes.filter((r) => r.name.toLowerCase().includes(q));
  }, [recipes, search]);

  return (
    <div className="space-y-5">
      {/* Page Header */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-[22px] sm:text-2xl font-extrabold tracking-[-0.025em]">
            Мої торти
          </h1>
          <p className="mt-0.5 text-xs font-medium text-[var(--app-hint)]">
            {recipes.length > 0
              ? `Збережено техкарт: ${recipes.length}`
              : "Техкарти, собівартість і перерахунок форм"}
          </p>
        </div>
        <Link href="/recipes/new" onClick={() => hapticImpact("light")}>
          <Button size="sm" className="px-4">
            <Plus className="h-4 w-4" strokeWidth={2.3} />
            <span>Новий торт</span>
          </Button>
        </Link>
      </div>

      {/* Search Bar */}
      {recipes.length > 0 && (
        <div className="relative">
          <Search
            className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--app-hint)]"
            strokeWidth={1.9}
          />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Пошук за назвою торта..."
            className="pl-10 pr-11"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
              aria-label="Очистити пошук"
              className="absolute right-1.5 top-1/2 -translate-y-1/2 flex h-9 w-9 items-center justify-center rounded-xl text-[var(--app-hint)] hover:bg-[var(--app-subtle)] hover:text-[var(--app-text)] cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      )}

      {/* Content */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          {[1, 2, 3, 4].map((n) => (
            <Card key={n} className="p-4.5 space-y-4">
              <div className="space-y-2.5">
                <div className="h-5 w-2/3 rounded-lg skeleton-shimmer" />
                <div className="flex gap-1.5">
                  <div className="h-6 w-16 rounded-full skeleton-shimmer" />
                  <div className="h-6 w-18 rounded-full skeleton-shimmer" />
                  <div className="h-6 w-20 rounded-full skeleton-shimmer" />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2 border-t border-[var(--app-border)] pt-3.5">
                <div className="h-10 rounded-xl skeleton-shimmer" />
                <div className="h-10 rounded-xl skeleton-shimmer" />
                <div className="h-10 rounded-xl skeleton-shimmer" />
              </div>
            </Card>
          ))}
        </div>
      ) : recipes.length === 0 ? (
        <Card className="p-8 sm:p-10 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-[22px] bg-[var(--app-accent-soft)] text-[var(--app-accent)] shadow-[inset_0_0_0_1px_rgba(200,90,50,0.14)]">
            <CakeSlice className="h-8 w-8" strokeWidth={1.7} />
          </div>
          <h2 className="text-[17px] font-extrabold tracking-[-0.015em]">
            Поки немає жодного торта
          </h2>
          <p className="mx-auto mt-2 max-w-sm text-[13px] text-[var(--app-hint)] leading-relaxed">
            Створіть першу техкарту по шарах (бісквіт, крем, начинка), а
            застосунок автоматично порахує собівартість, КБЖВ та вагу під
            будь-який діаметр.
          </p>
          <div className="mt-6 flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-2.5">
            <Link
              href="/recipes/new"
              onClick={() => hapticImpact("light")}
              className="sm:w-auto"
            >
              <Button className="w-full sm:w-auto px-6">
                <Plus className="h-4 w-4" strokeWidth={2.3} />
                <span>Додати перший торт</span>
              </Button>
            </Link>
            <Link
              href="/ingredients"
              onClick={() => hapticImpact("light")}
              className="sm:w-auto"
            >
              <Button variant="outline" className="w-full sm:w-auto">
                Перейти на склад
              </Button>
            </Link>
          </div>
        </Card>
      ) : filtered.length === 0 ? (
        <Card className="p-8 text-center">
          <p className="text-sm font-semibold">
            За запитом «{search}» рецептів не знайдено
          </p>
          <p className="mt-1 text-xs text-[var(--app-hint)]">
            Спробуйте змінити назву або створіть нову техкарту
          </p>
          <Button
            variant="outline"
            size="sm"
            className="mt-4"
            onClick={() => setSearch("")}
          >
            Скинути пошук
          </Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          {filtered.map((recipe) => {
            const calc = calculateRecipe(recipe, recipe.baseDiameter);
            const kbjuItems = calc.aggregated.map((a) => ({
              grams: a.totalGrams,
              calories100g: a.ingredient.calories100g,
              protein100g: a.ingredient.protein100g,
              fat100g: a.ingredient.fat100g,
              carbs100g: a.ingredient.carbs100g,
            }));
            const hasKbju = kbjuItems.some((i) => i.calories100g > 0);
            const kbju = hasKbju
              ? calculateKbju(
                  kbjuItems,
                  calc.estimatedFinishedWeightGrams,
                  150
                )
              : null;

            return (
              <Link
                key={recipe.id}
                href={`/recipes/${recipe.id}`}
                onClick={() => hapticImpact("light")}
                className="block group"
              >
                <Card className="app-card-interactive p-4.5 h-full flex flex-col justify-between gap-4">
                  {/* Top: Title + Structured Badges */}
                  <div>
                    <div className="flex items-start justify-between gap-3">
                      <h2 className="text-[17px] font-extrabold tracking-[-0.015em] leading-snug line-clamp-2 group-hover:text-[var(--app-accent)] transition-colors">
                        {recipe.name}
                      </h2>
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--app-subtle)] text-[var(--app-hint)] group-hover:bg-[var(--app-accent-soft)] group-hover:text-[var(--app-accent)] transition-colors">
                        <ChevronRight className="h-4 w-4" strokeWidth={2.1} />
                      </span>
                    </div>

                    <div className="mt-3 flex flex-wrap items-center gap-1.5">
                      <span className="inline-flex items-center gap-1 rounded-full bg-[var(--app-subtle)] px-2.5 py-1 text-[11.5px] font-bold tabular-nums text-[var(--app-text)]">
                        Ø {recipe.baseDiameter} см
                      </span>
                      <span className="inline-flex items-center gap-1 rounded-full bg-[var(--app-warning-soft)] px-2.5 py-1 text-[11.5px] font-bold tabular-nums text-[var(--app-warning)]">
                        <Scale className="h-3 w-3" strokeWidth={2.1} />
                        {formatWeight(calc.estimatedFinishedWeightGrams)}
                      </span>
                      <span className="inline-flex items-center gap-1 rounded-full bg-[var(--app-subtle)] px-2.5 py-1 text-[11.5px] font-semibold text-[var(--app-hint)]">
                        <Layers className="h-3 w-3" strokeWidth={2} />
                        {formatLayersLabel(recipe.components.length)}
                      </span>
                      {kbju && kbju.per100g.calories > 0 && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-[var(--app-kbju-soft)] px-2.5 py-1 text-[11.5px] font-bold tabular-nums text-[var(--app-kbju)]">
                          <Flame className="h-3 w-3" strokeWidth={2.1} />
                          {kbju.per100g.calories} ккал
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Bottom: Structured Financial Strip */}
                  <div className="grid grid-cols-3 gap-2 rounded-[15px] bg-[var(--app-bg)] p-2.5 border border-[var(--app-border)]/80">
                    <div className="px-1">
                      <div className="text-[10px] font-bold uppercase tracking-[0.04em] text-[var(--app-hint)]">
                        Собіварт.
                      </div>
                      <div className="mt-0.5 text-[13.5px] font-extrabold tabular-nums text-[var(--app-text)]">
                        {formatMoney(calc.totalCost, currency)}
                      </div>
                    </div>
                    <div className="border-x border-[var(--app-border)] px-2">
                      <div className="text-[10px] font-bold uppercase tracking-[0.04em] text-[var(--app-accent)]">
                        Продаж
                      </div>
                      <div className="mt-0.5 text-[13.5px] font-extrabold tabular-nums text-[var(--app-accent)]">
                        {formatMoney(calc.sellingPrice, currency)}
                      </div>
                    </div>
                    <div className="px-1">
                      <div className="text-[10px] font-bold uppercase tracking-[0.04em] text-[var(--app-success)]">
                        Прибуток
                      </div>
                      <div className="mt-0.5 text-[13.5px] font-extrabold tabular-nums text-[var(--app-success)]">
                        {formatMoney(calc.netProfit, currency)}
                      </div>
                    </div>
                  </div>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
