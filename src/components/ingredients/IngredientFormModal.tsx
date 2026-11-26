"use client";

import React, { useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronUp, Scale } from "lucide-react";
import type { Ingredient } from "@/types/pastry";
import { CURRENCIES } from "@/types/pastry";
import { formatMoney } from "@/lib/calculations";
import { hapticImpact, hapticNotification } from "@/lib/telegram";
import { useApp } from "@/components/providers/AppProvider";
import { Modal } from "@/components/ui/modal";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface IngredientFormModalProps {
  open: boolean;
  onClose: () => void;
  editing?: Ingredient | null;
  initialName?: string;
  onSaved: (ingredient: Ingredient) => void;
}

export function IngredientFormModal({
  open,
  onClose,
  editing,
  initialName = "",
  onSaved,
}: IngredientFormModalProps) {
  const { currency, showToast } = useApp();
  const [name, setName] = useState("");
  const [priceMode, setPriceMode] = useState<"pack" | "kg">("pack");
  const [pricePerKgInput, setPricePerKgInput] = useState("");
  const [packPrice, setPackPrice] = useState("");
  const [packWeight, setPackWeight] = useState("");
  const [showKbju, setShowKbju] = useState(false);
  const [calories, setCalories] = useState("0");
  const [protein, setProtein] = useState("0");
  const [fat, setFat] = useState("0");
  const [carbs, setCarbs] = useState("0");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setName(editing.name);
      setPriceMode("kg");
      setPricePerKgInput(String(editing.pricePerKg));
      setPackPrice("");
      setPackWeight("");
      const hasKbju =
        editing.calories100g > 0 ||
        editing.protein100g > 0 ||
        editing.fat100g > 0 ||
        editing.carbs100g > 0;
      setShowKbju(hasKbju);
      setCalories(String(editing.calories100g || 0));
      setProtein(String(editing.protein100g || 0));
      setFat(String(editing.fat100g || 0));
      setCarbs(String(editing.carbs100g || 0));
    } else {
      setName(initialName);
      setPriceMode("pack");
      setPricePerKgInput("");
      setPackPrice("");
      setPackWeight("");
      setShowKbju(false);
      setCalories("0");
      setProtein("0");
      setFat("0");
      setCarbs("0");
    }
  }, [open, editing, initialName]);

  const computedPricePerKg = useMemo(() => {
    if (priceMode === "kg") {
      const val = parseFloat(pricePerKgInput.replace(",", "."));
      return Number.isFinite(val) && val >= 0 ? val : 0;
    }
    const p = parseFloat(packPrice.replace(",", "."));
    const w = parseFloat(packWeight.replace(",", "."));
    if (!Number.isFinite(p) || !Number.isFinite(w) || p < 0 || w <= 0) {
      return 0;
    }
    return Math.round(((p / w) * 1000) * 100) / 100;
  }, [priceMode, pricePerKgInput, packPrice, packWeight]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      showToast("Введите название продукта", "error");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        name: name.trim(),
        pricePerKg: computedPricePerKg,
        calories100g: parseFloat(calories.replace(",", ".")) || 0,
        protein100g: parseFloat(protein.replace(",", ".")) || 0,
        fat100g: parseFloat(fat.replace(",", ".")) || 0,
        carbs100g: parseFloat(carbs.replace(",", ".")) || 0,
      };

      const url = editing
        ? `/api/ingredients/${editing.id}`
        : "/api/ingredients";
      const method = editing ? "PATCH" : "POST";

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
      showToast(
        editing ? "Продукт обновлён — техкарты пересчитаны" : "Продукт добавлен на склад",
        "success"
      );
      onSaved(data as Ingredient);
      onClose();
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

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? "Редактировать продукт" : "Новый продукт"}
      subtitle={
        editing
          ? "Изменение цены автоматически обновит все техкарты"
          : "Укажите цену за упаковку или сразу за 1 кг"
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-semibold text-[var(--app-hint)] mb-1.5">
            Название продукта *
          </label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Например: Масло сливочное 82,5%"
            autoFocus
            required
          />
        </div>

        {/* Smart Price Mode Toggle */}
        <div>
          <label className="block text-xs font-semibold text-[var(--app-hint)] mb-1.5">
            Способ ввода цены
          </label>
          <div className="grid grid-cols-2 gap-1.5 rounded-xl bg-[var(--app-subtle)] p-1">
            <button
              type="button"
              onClick={() => {
                hapticImpact("light");
                setPriceMode("pack");
              }}
              className={`rounded-lg py-2 text-xs font-semibold transition-all cursor-pointer ${
                priceMode === "pack"
                  ? "bg-[var(--app-card)] text-[var(--app-text)] shadow-xs"
                  : "text-[var(--app-hint)]"
              }`}
            >
              За упаковку
            </button>
            <button
              type="button"
              onClick={() => {
                hapticImpact("light");
                setPriceMode("kg");
              }}
              className={`rounded-lg py-2 text-xs font-semibold transition-all cursor-pointer ${
                priceMode === "kg"
                  ? "bg-[var(--app-card)] text-[var(--app-text)] shadow-xs"
                  : "text-[var(--app-hint)]"
              }`}
            >
              Сразу за 1 кг
            </button>
          </div>
        </div>

        {priceMode === "pack" ? (
          <div className="space-y-2.5">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-[var(--app-hint)] mb-1">
                  Вес упаковки (г)
                </label>
                <Input
                  type="number"
                  inputMode="decimal"
                  min="1"
                  step="any"
                  value={packWeight}
                  onChange={(e) => setPackWeight(e.target.value)}
                  placeholder="180"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[var(--app-hint)] mb-1">
                  Цена упаковки ({CURRENCIES[currency].symbol})
                </label>
                <Input
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="any"
                  value={packPrice}
                  onChange={(e) => setPackPrice(e.target.value)}
                  placeholder="95"
                />
              </div>
            </div>

            <div className="flex items-center justify-between rounded-xl bg-[var(--app-accent-soft)] px-3.5 py-2.5">
              <span className="flex items-center gap-2 text-xs font-medium text-[var(--app-text)]">
                <Scale className="h-4 w-4 text-[var(--app-accent)]" />
                Цена за 1 кг:
              </span>
              <span className="text-sm font-bold tabular-nums text-[var(--app-accent)]">
                {formatMoney(computedPricePerKg, currency)} / кг
              </span>
            </div>
          </div>
        ) : (
          <div>
            <label className="block text-xs font-semibold text-[var(--app-hint)] mb-1">
              Цена за 1 кг ({CURRENCIES[currency].symbol})
            </label>
            <Input
              type="number"
              inputMode="decimal"
              min="0"
              step="any"
              value={pricePerKgInput}
              onChange={(e) => setPricePerKgInput(e.target.value)}
              placeholder="520"
            />
          </div>
        )}

        {/* Collapsible Optional KBJU */}
        <div className="rounded-xl border border-[var(--app-border)] overflow-hidden">
          <button
            type="button"
            onClick={() => {
              hapticImpact("light");
              setShowKbju((v) => !v);
            }}
            className="flex w-full items-center justify-between px-3.5 py-2.5 text-xs font-semibold text-[var(--app-hint)] hover:bg-[var(--app-subtle)] cursor-pointer"
          >
            <span>КБЖУ на 100 г (необязательно)</span>
            {showKbju ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </button>

          {showKbju && (
            <div className="grid grid-cols-2 gap-2.5 border-t border-[var(--app-border)] p-3 bg-[var(--app-subtle)]/50">
              <div>
                <label className="block text-[11px] font-medium text-[var(--app-hint)] mb-1">
                  Калории (ккал)
                </label>
                <Input
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="any"
                  value={calories}
                  onChange={(e) => setCalories(e.target.value)}
                  className="h-9 text-xs"
                />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-[var(--app-hint)] mb-1">
                  Белки (г)
                </label>
                <Input
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="any"
                  value={protein}
                  onChange={(e) => setProtein(e.target.value)}
                  className="h-9 text-xs"
                />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-[var(--app-hint)] mb-1">
                  Жиры (г)
                </label>
                <Input
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="any"
                  value={fat}
                  onChange={(e) => setFat(e.target.value)}
                  className="h-9 text-xs"
                />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-[var(--app-hint)] mb-1">
                  Углеводы (г)
                </label>
                <Input
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="any"
                  value={carbs}
                  onChange={(e) => setCarbs(e.target.value)}
                  className="h-9 text-xs"
                />
              </div>
            </div>
          )}
        </div>

        <div className="flex gap-2 pt-2">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            className="flex-1"
          >
            Отмена
          </Button>
          <Button type="submit" disabled={saving} className="flex-1">
            {saving ? "Сохранение..." : editing ? "Сохранить" : "Добавить"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
