"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { CakeSlice, ChevronRight, Plus, Search } from "lucide-react";
import type { RecipeWithDetails } from "@/types/pastry";
import { calculateRecipe, formatMoney, formatWeight } from "@/lib/calculations";
import { hapticImpact } from "@/lib/telegram";
import { useApp } from "@/components/providers/AppProvider";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

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
      showToast("Не удалось загрузить рецепты", "error");
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
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Мои торты</h1>
          <p className="text-xs text-[var(--app-hint)]">
            {recipes.length > 0
              ? `Сохранено техкарт: ${recipes.length}`
              : "Техкарты и расчёт себестоимости"}
          </p>
        </div>
        <Link href="/recipes/new" onClick={() => hapticImpact("light")}>
          <Button size="sm" className="h-10 px-3.5">
            <Plus className="h-4 w-4" />
            <span>Новый торт</span>
          </Button>
        </Link>
      </div>

      {/* Search */}
      {recipes.length > 0 && (
        <div className="relative">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--app-hint)]" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Поиск по названию торта..."
            className="pl-10"
          />
        </div>
      )}

      {/* Content */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((n) => (
            <div
              key={n}
              className="h-28 rounded-2xl bg-[var(--app-subtle)] animate-pulse"
            />
          ))}
        </div>
      ) : recipes.length === 0 ? (
        <Card className="p-8 text-center">
          <div className="mx-auto mb-3.5 flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--app-accent-soft)] text-[var(--app-accent)]">
            <CakeSlice className="h-7 w-7" />
          </div>
          <h2 className="text-base font-bold">
            Пока нет рецептов — создайте первый торт
          </h2>
          <p className="mx-auto mt-1.5 max-w-xs text-xs text-[var(--app-hint)] leading-relaxed">
            Соберите техкарту по слоям (бисквит, крем, начинка), а приложение
            мгновенно пересчитает себестоимость и граммовки под любой диаметр.
          </p>
          <div className="mt-5 flex flex-col sm:flex-row items-center justify-center gap-2.5">
            <Link href="/recipes/new" onClick={() => hapticImpact("light")}>
              <Button>
                <Plus className="h-4 w-4" />
                <span>Новый торт</span>
              </Button>
            </Link>
            <Link href="/ingredients" onClick={() => hapticImpact("light")}>
              <Button variant="outline">Перейти на склад</Button>
            </Link>
          </div>
        </Card>
      ) : filtered.length === 0 ? (
        <Card className="p-6 text-center text-sm text-[var(--app-hint)]">
          По запросу «{search}» рецепты не найдены
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {filtered.map((recipe) => {
            const calc = calculateRecipe(recipe, recipe.baseDiameter);
            return (
              <Link
                key={recipe.id}
                href={`/recipes/${recipe.id}`}
                onClick={() => hapticImpact("light")}
                className="block group"
              >
                <Card className="p-4 h-full transition-all hover:border-[var(--app-accent)]/50 active:scale-[0.99]">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h2 className="truncate text-base font-bold group-hover:text-[var(--app-accent)] transition-colors">
                        {recipe.name}
                      </h2>
                      <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] font-medium text-[var(--app-hint)]">
                        <span className="rounded-md bg-[var(--app-subtle)] px-2 py-0.5">
                          Ø {recipe.baseDiameter} см
                        </span>
                        <span className="rounded-md bg-[var(--app-subtle)] px-2 py-0.5">
                          {formatWeight(calc.estimatedFinishedWeightGrams)}
                        </span>
                        <span className="rounded-md bg-[var(--app-subtle)] px-2 py-0.5">
                          {recipe.components.length}{" "}
                          {recipe.components.length === 1
                            ? "слой"
                            : recipe.components.length >= 2 &&
                              recipe.components.length <= 4
                            ? "слоя"
                            : "слоёв"}
                        </span>
                      </div>
                    </div>
                    <ChevronRight className="h-4 w-4 shrink-0 text-[var(--app-hint)] mt-1" />
                  </div>

                  <div className="mt-3.5 grid grid-cols-3 gap-2 border-t border-[var(--app-border)] pt-3">
                    <div>
                      <div className="text-[10px] uppercase tracking-wider text-[var(--app-hint)]">
                        Себест.
                      </div>
                      <div className="mt-0.5 text-sm font-bold tabular-nums">
                        {formatMoney(calc.totalCost, currency)}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] uppercase tracking-wider text-[var(--app-hint)]">
                        Продажа
                      </div>
                      <div className="mt-0.5 text-sm font-bold tabular-nums text-[var(--app-accent)]">
                        {formatMoney(calc.sellingPrice, currency)}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] uppercase tracking-wider text-[var(--app-hint)]">
                        Прибыль
                      </div>
                      <div className="mt-0.5 text-sm font-bold tabular-nums text-[var(--app-success)]">
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
