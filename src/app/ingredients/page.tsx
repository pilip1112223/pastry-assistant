"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Flame, Package, Pencil, Plus, Search, Trash2, X } from "lucide-react";
import type { Ingredient } from "@/types/pastry";
import { formatMoney } from "@/lib/calculations";
import { hapticImpact, hapticNotification } from "@/lib/telegram";
import { useApp } from "@/components/providers/AppProvider";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { IngredientFormModal } from "@/components/ingredients/IngredientFormModal";

export default function IngredientsPage() {
  const { currency, showToast } = useApp();
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Ingredient | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const loadIngredients = useCallback(async () => {
    try {
      const res = await fetch("/api/ingredients", { cache: "no-store" });
      if (!res.ok) throw new Error();
      const data = (await res.json()) as Ingredient[];
      setIngredients(data);
    } catch {
      showToast("Не вдалося завантажити склад", "error");
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    loadIngredients();
  }, [loadIngredients]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return ingredients;
    return ingredients.filter((i) => i.name.toLowerCase().includes(q));
  }, [ingredients, search]);

  function openCreate() {
    hapticImpact("light");
    setEditing(null);
    setModalOpen(true);
  }

  function openEdit(item: Ingredient) {
    hapticImpact("light");
    setEditing(item);
    setModalOpen(true);
  }

  async function handleDelete(item: Ingredient) {
    hapticImpact("medium");
    if (
      !window.confirm(
        `Видалити «${item.name}» зі складу? Якщо продукт використовується в техкартах, його буде прибрано з них.`
      )
    ) {
      return;
    }

    setDeletingId(item.id);
    try {
      const res = await fetch(`/api/ingredients/${item.id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error();
      hapticNotification("success");
      setIngredients((prev) => prev.filter((i) => i.id !== item.id));
      showToast("Продукт видалено", "success");
    } catch {
      hapticNotification("error");
      showToast("Не вдалося видалити продукт", "error");
    } finally {
      setDeletingId(null);
    }
  }

  function handleSaved(saved: Ingredient) {
    setIngredients((prev) => {
      const exists = prev.some((i) => i.id === saved.id);
      const next = exists
        ? prev.map((i) => (i.id === saved.id ? saved : i))
        : [...prev, saved];
      return next.sort((a, b) => a.name.localeCompare(b.name, "uk"));
    });
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-[22px] sm:text-2xl font-extrabold tracking-[-0.025em]">
            Склад і ціни
          </h1>
          <p className="mt-0.5 text-xs font-medium text-[var(--app-hint)]">
            {ingredients.length > 0
              ? `Продуктів у базі: ${ingredients.length}`
              : "База продуктів для розрахунку собівартості"}
          </p>
        </div>
        <Button onClick={openCreate} size="sm" className="shrink-0 px-4">
          <Plus className="h-4 w-4" strokeWidth={2.3} />
          <span>Продукт</span>
        </Button>
      </div>

      {/* Search */}
      {ingredients.length > 0 && (
        <div className="relative">
          <Search
            className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--app-hint)]"
            strokeWidth={1.9}
          />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Пошук продукту..."
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
        <div className="space-y-2.5">
          {[1, 2, 3, 4, 5].map((n) => (
            <Card key={n} className="flex items-center justify-between p-4">
              <div className="space-y-2 flex-1">
                <div className="h-4 w-44 rounded-lg skeleton-shimmer" />
                <div className="flex gap-2">
                  <div className="h-5 w-24 rounded-full skeleton-shimmer" />
                  <div className="h-5 w-32 rounded-full skeleton-shimmer" />
                </div>
              </div>
              <div className="flex gap-1.5">
                <div className="h-10 w-10 rounded-xl skeleton-shimmer" />
                <div className="h-10 w-10 rounded-xl skeleton-shimmer" />
              </div>
            </Card>
          ))}
        </div>
      ) : ingredients.length === 0 ? (
        <Card className="p-8 sm:p-10 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-[22px] bg-[var(--app-accent-soft)] text-[var(--app-accent)] shadow-[inset_0_0_0_1px_rgba(200,90,50,0.14)]">
            <Package className="h-8 w-8" strokeWidth={1.7} />
          </div>
          <h2 className="text-[17px] font-extrabold tracking-[-0.015em]">
            Склад поки порожній
          </h2>
          <p className="mx-auto mt-2 max-w-sm text-[13px] text-[var(--app-hint)] leading-relaxed">
            Додайте інгредієнти, з якими працюєте. Ціну можна вказати за
            упаковку або одразу за 1 кг — система перерахує автоматично.
          </p>
          <Button onClick={openCreate} className="mt-6 px-6">
            <Plus className="h-4 w-4" strokeWidth={2.3} />
            <span>Додати перший продукт</span>
          </Button>
        </Card>
      ) : filtered.length === 0 ? (
        <Card className="p-7 text-center">
          <p className="text-sm font-semibold">
            За запитом «{search}» нічого не знайдено
          </p>
          <p className="mt-1 text-xs text-[var(--app-hint)]">
            Ви можете миттєво додати цей продукт на склад
          </p>
          <Button
            variant="secondary"
            size="sm"
            className="mt-4"
            onClick={() => {
              setEditing(null);
              setModalOpen(true);
            }}
          >
            <Plus className="h-4 w-4" />
            <span>Додати «{search}»</span>
          </Button>
        </Card>
      ) : (
        <div className="space-y-2.5">
          {filtered.map((item) => {
            const hasKbju =
              item.calories100g > 0 ||
              item.protein100g > 0 ||
              item.fat100g > 0 ||
              item.carbs100g > 0;

            return (
              <Card
                key={item.id}
                className="flex items-center justify-between gap-3 px-4 py-3.5 transition-all hover:border-[var(--app-border-strong)]"
              >
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[15px] font-bold tracking-[-0.01em]">
                    {item.name}
                  </div>
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                    <span className="inline-flex items-center rounded-full bg-[var(--app-accent-soft)] px-2.5 py-0.5 text-[12px] font-extrabold tabular-nums text-[var(--app-accent)]">
                      {formatMoney(item.pricePerKg, currency)} / кг
                    </span>
                    {hasKbju && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-[var(--app-kbju-soft)] px-2.5 py-0.5 text-[11px] font-semibold tabular-nums text-[var(--app-kbju)]">
                        <Flame className="h-3 w-3" strokeWidth={2.1} />
                        {Math.round(item.calories100g)} ккал · Б{" "}
                        {item.protein100g} · Ж {item.fat100g} · В{" "}
                        {item.carbs100g}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label="Редагувати"
                    onClick={() => openEdit(item)}
                  >
                    <Pencil
                      className="h-4 w-4 text-[var(--app-hint)]"
                      strokeWidth={1.9}
                    />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label="Видалити"
                    disabled={deletingId === item.id}
                    onClick={() => handleDelete(item)}
                    className="hover:bg-[var(--app-danger-soft)]"
                  >
                    <Trash2
                      className="h-4 w-4 text-[var(--app-danger)]"
                      strokeWidth={1.9}
                    />
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <IngredientFormModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        editing={editing}
        initialName={filtered.length === 0 ? search : ""}
        onSaved={handleSaved}
      />
    </div>
  );
}
