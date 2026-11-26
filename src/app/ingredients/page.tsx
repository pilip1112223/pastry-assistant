"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Package, Pencil, Plus, Search, Trash2 } from "lucide-react";
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
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Склад і ціни</h1>
          <p className="text-xs text-[var(--app-hint)]">
            {ingredients.length > 0
              ? `Продуктів у базі: ${ingredients.length}`
              : "База продуктів для розрахунку собівартості"}
          </p>
        </div>
        <Button onClick={openCreate} size="sm" className="shrink-0 h-10 px-3.5">
          <Plus className="h-4 w-4" />
          <span>Продукт</span>
        </Button>
      </div>

      {/* Search */}
      {ingredients.length > 0 && (
        <div className="relative">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--app-hint)]" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Пошук продукту..."
            className="pl-10"
          />
        </div>
      )}

      {/* Content */}
      {loading ? (
        <div className="space-y-2.5">
          {[1, 2, 3].map((n) => (
            <div
              key={n}
              className="h-18 rounded-2xl bg-[var(--app-subtle)] animate-pulse"
            />
          ))}
        </div>
      ) : ingredients.length === 0 ? (
        <Card className="p-8 text-center">
          <div className="mx-auto mb-3.5 flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--app-accent-soft)] text-[var(--app-accent)]">
            <Package className="h-7 w-7" />
          </div>
          <h2 className="text-base font-bold">Склад поки порожній</h2>
          <p className="mx-auto mt-1.5 max-w-xs text-xs text-[var(--app-hint)] leading-relaxed">
            Додайте продукти, з якими працюєте. Ціну можна вказати одразу за
            1 кг або за упаковку — система перерахує сама.
          </p>
          <Button onClick={openCreate} className="mt-5">
            <Plus className="h-4 w-4" />
            <span>Додати перший продукт</span>
          </Button>
        </Card>
      ) : filtered.length === 0 ? (
        <Card className="p-6 text-center">
          <p className="text-sm font-medium">За запитом «{search}» нічого не знайдено</p>
          <Button
            variant="secondary"
            size="sm"
            className="mt-3"
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
        <div className="space-y-2">
          {filtered.map((item) => {
            const hasKbju =
              item.calories100g > 0 ||
              item.protein100g > 0 ||
              item.fat100g > 0 ||
              item.carbs100g > 0;

            return (
              <Card
                key={item.id}
                className="flex items-center justify-between gap-3 px-4 py-3 transition-colors hover:border-[var(--app-accent)]/40"
              >
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold">
                    {item.name}
                  </div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-xs">
                    <span className="font-bold tabular-nums text-[var(--app-accent)]">
                      {formatMoney(item.pricePerKg, currency)} / кг
                    </span>
                    {hasKbju && (
                      <span className="text-[11px] tabular-nums text-[var(--app-hint)]">
                        {Math.round(item.calories100g)} ккал · Б {item.protein100g} · Ж{" "}
                        {item.fat100g} · В {item.carbs100g}
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
                    <Pencil className="h-4 w-4 text-[var(--app-hint)]" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label="Видалити"
                    disabled={deletingId === item.id}
                    onClick={() => handleDelete(item)}
                  >
                    <Trash2 className="h-4 w-4 text-[var(--app-danger)]" />
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
