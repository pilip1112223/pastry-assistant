"use client";

import React, { useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronUp, Flame, Scale } from "lucide-react";
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
  const [nameError, setNameError] = useState("");
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
    setNameError("");
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
    return Math.round((p / w) * 1000 * 100) / 100;
  }, [priceMode, pricePerKgInput, packPrice, packWeight]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setNameError("Вкажіть назву продукту");
      showToast("Введіть назву продукту", "error");
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
        throw new Error(data.error || "Помилка збереження");
      }

      hapticNotification("success");
      showToast(
        editing
          ? "Продукт оновлено — техкарти перераховано"
          : "Продукт додано на склад",
        "success"
      );
      onSaved(data as Ingredient);
      onClose();
    } catch (err) {
      hapticNotification("error");
      showToast(
        err instanceof Error ? err.message : "Не вдалося зберегти",
        "error"
      );
    } finally {
      setSaving(false);
    }
  }

  const sym = CURRENCIES[currency].symbol;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? "Редагувати продукт" : "Новий продукт"}
      subtitle={
        editing
          ? "Зміна ціни автоматично оновить усі техкарти"
          : "Вкажіть ціну за упаковку або одразу за 1 кг"
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4 pb-2" noValidate>
        <div>
          <label className="block text-xs font-bold text-[var(--app-hint)] mb-1.5">
            Назва продукту *
          </label>
          <Input
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              if (nameError) setNameError("");
            }}
            placeholder="Наприклад: Масло вершкове 82,5%"
            error={nameError}
            autoFocus
            required
          />
        </div>

        {/* Smart Price Mode Toggle */}
        <div>
          <label className="block text-xs font-bold text-[var(--app-hint)] mb-1.5">
            Спосіб введення ціни
          </label>
          <div className="grid grid-cols-2 gap-1.5 rounded-[15px] bg-[var(--app-subtle)] p-1 border border-[var(--app-border)]">
            <button
              type="button"
              onClick={() => {
                hapticImpact("light");
                setPriceMode("pack");
              }}
              className={`min-h-[40px] rounded-[11px] py-2 text-xs font-bold transition-all cursor-pointer ${
                priceMode === "pack"
                  ? "bg-[var(--app-card)] text-[var(--app-text)] shadow-[0_1px_4px_rgba(42,30,23,0.08)]"
                  : "text-[var(--app-hint)] hover:text-[var(--app-text)]"
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
              className={`min-h-[40px] rounded-[11px] py-2 text-xs font-bold transition-all cursor-pointer ${
                priceMode === "kg"
                  ? "bg-[var(--app-card)] text-[var(--app-text)] shadow-[0_1px_4px_rgba(42,30,23,0.08)]"
                  : "text-[var(--app-hint)] hover:text-[var(--app-text)]"
              }`}
            >
              Одразу за 1 кг
            </button>
          </div>
        </div>

        {priceMode === "pack" ? (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-[var(--app-hint)] mb-1.5">
                  Вага упаковки
                </label>
                <Input
                  type="number"
                  inputMode="decimal"
                  min="1"
                  step="any"
                  value={packWeight}
                  onChange={(e) => setPackWeight(e.target.value)}
                  placeholder="180"
                  suffix="г"
                  className="tabular-nums"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-[var(--app-hint)] mb-1.5">
                  Ціна упаковки
                </label>
                <Input
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="any"
                  value={packPrice}
                  onChange={(e) => setPackPrice(e.target.value)}
                  placeholder="95"
                  suffix={sym}
                  className="tabular-nums"
                />
              </div>
            </div>

            <div className="flex items-center justify-between rounded-[16px] bg-[var(--app-accent-soft)] border border-[var(--app-accent)]/15 px-4 py-3">
              <span className="flex items-center gap-2 text-xs font-bold text-[var(--app-text)]">
                <Scale
                  className="h-4 w-4 text-[var(--app-accent)]"
                  strokeWidth={2}
                />
                Перерахунок за 1 кг:
              </span>
              <span className="text-[15px] font-extrabold tabular-nums text-[var(--app-accent)]">
                {formatMoney(computedPricePerKg, currency)} / кг
              </span>
            </div>
          </div>
        ) : (
          <div>
            <label className="block text-xs font-bold text-[var(--app-hint)] mb-1.5">
              Ціна за 1 кг
            </label>
            <Input
              type="number"
              inputMode="decimal"
              min="0"
              step="any"
              value={pricePerKgInput}
              onChange={(e) => setPricePerKgInput(e.target.value)}
              placeholder="520"
              suffix={sym}
              className="tabular-nums"
            />
          </div>
        )}

        {/* Collapsible Optional KBJU */}
        <div className="rounded-[16px] border border-[var(--app-border)] overflow-hidden bg-[var(--app-card)]">
          <button
            type="button"
            onClick={() => {
              hapticImpact("light");
              setShowKbju((v) => !v);
            }}
            className="flex w-full min-h-[46px] items-center justify-between px-4 py-2.5 text-xs font-bold text-[var(--app-hint)] hover:bg-[var(--app-subtle)]/60 transition-colors cursor-pointer"
          >
            <span className="flex items-center gap-2">
              <Flame
                className="h-4 w-4 text-[var(--app-kbju)]"
                strokeWidth={1.9}
              />
              КБЖВ на 100 г (необов&apos;язково)
            </span>
            {showKbju ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </button>

          {showKbju && (
            <div className="grid grid-cols-2 gap-3 border-t border-[var(--app-border)] p-3.5 bg-[var(--app-bg)]/70">
              <div>
                <label className="block text-[11px] font-bold text-[var(--app-hint)] mb-1">
                  Калорії
                </label>
                <Input
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="any"
                  value={calories}
                  onChange={(e) => setCalories(e.target.value)}
                  suffix="ккал"
                  className="tabular-nums"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-[var(--app-hint)] mb-1">
                  Білки
                </label>
                <Input
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="any"
                  value={protein}
                  onChange={(e) => setProtein(e.target.value)}
                  suffix="г"
                  className="tabular-nums"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-[var(--app-hint)] mb-1">
                  Жири
                </label>
                <Input
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="any"
                  value={fat}
                  onChange={(e) => setFat(e.target.value)}
                  suffix="г"
                  className="tabular-nums"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-[var(--app-hint)] mb-1">
                  Вуглеводи
                </label>
                <Input
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="any"
                  value={carbs}
                  onChange={(e) => setCarbs(e.target.value)}
                  suffix="г"
                  className="tabular-nums"
                />
              </div>
            </div>
          )}
        </div>

        <div className="flex gap-2.5 pt-2">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            className="flex-1"
          >
            Скасувати
          </Button>
          <Button type="submit" disabled={saving} className="flex-1">
            {saving ? "Збереження..." : editing ? "Зберегти" : "Додати"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
