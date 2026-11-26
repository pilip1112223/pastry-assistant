"use client";

import React, { useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronUp, Flame, Info, Scale } from "lucide-react";
import type { Ingredient, IngredientUnitType } from "@/types/pastry";
import { CURRENCIES } from "@/types/pastry";
import {
  formatMoney,
  getPriceUnitLabel,
  getRecipeUnitLabel,
} from "@/lib/calculations";
import { apiFetch } from "@/lib/api-client";
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

const UNIT_OPTIONS: Array<{
  id: IngredientUnitType;
  label: string;
  sublabel: string;
}> = [
  { id: "weight", label: "г / кг", sublabel: "Вага" },
  { id: "volume", label: "мл / л", sublabel: "Об'єм" },
  { id: "piece", label: "шт", sublabel: "Поштучно" },
];

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
  const [unitType, setUnitType] = useState<IngredientUnitType>("weight");
  const [priceMode, setPriceMode] = useState<"pack" | "unit">("pack");
  const [directPriceInput, setDirectPriceInput] = useState("");
  const [packPrice, setPackPrice] = useState("");
  const [packAmount, setPackAmount] = useState("");
  const [unitWeightGrams, setUnitWeightGrams] = useState("");
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
      setUnitType(editing.unitType ?? "weight");
      setPriceMode("unit");
      setDirectPriceInput(String(editing.pricePerKg));
      setPackPrice("");
      setPackAmount("");
      setUnitWeightGrams(
        editing.unitWeightGrams > 0 ? String(editing.unitWeightGrams) : ""
      );
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
      setUnitType("weight");
      setPriceMode("pack");
      setDirectPriceInput("");
      setPackPrice("");
      setPackAmount("");
      setUnitWeightGrams("");
      setShowKbju(false);
      setCalories("0");
      setProtein("0");
      setFat("0");
      setCarbs("0");
    }
  }, [open, editing, initialName]);

  const computedUnitPrice = useMemo(() => {
    if (priceMode === "unit") {
      const val = parseFloat(directPriceInput.replace(",", "."));
      return Number.isFinite(val) && val >= 0 ? val : 0;
    }
    const p = parseFloat(packPrice.replace(",", "."));
    const amount = parseFloat(packAmount.replace(",", "."));
    if (!Number.isFinite(p) || !Number.isFinite(amount) || p < 0 || amount <= 0) {
      return 0;
    }
    if (unitType === "piece") {
      return Math.round((p / amount) * 100) / 100;
    }
    return Math.round((p / amount) * 1000 * 100) / 100;
  }, [priceMode, directPriceInput, packPrice, packAmount, unitType]);

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
        unitType,
        pricePerKg: computedUnitPrice,
        unitWeightGrams:
          unitType === "piece"
            ? Math.max(0, parseFloat(unitWeightGrams.replace(",", ".")) || 0)
            : 0,
        calories100g: parseFloat(calories.replace(",", ".")) || 0,
        protein100g: parseFloat(protein.replace(",", ".")) || 0,
        fat100g: parseFloat(fat.replace(",", ".")) || 0,
        carbs100g: parseFloat(carbs.replace(",", ".")) || 0,
      };

      const url = editing
        ? `/api/ingredients/${editing.id}`
        : "/api/ingredients";
      const method = editing ? "PATCH" : "POST";

      const res = await apiFetch(url, {
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
  const priceUnit = getPriceUnitLabel(unitType);
  const recipeUnit = getRecipeUnitLabel(unitType);

  const packAmountLabel =
    unitType === "piece"
      ? "Кількість в упаковці"
      : unitType === "volume"
      ? "Об'єм упаковки"
      : "Вага упаковки";

  const packAmountPlaceholder =
    unitType === "piece" ? "10" : unitType === "volume" ? "500" : "180";

  const packPricePlaceholder =
    unitType === "piece" ? "65" : unitType === "volume" ? "115" : "95";

  const directPriceLabel =
    unitType === "piece"
      ? "Ціна за 1 шт"
      : unitType === "volume"
      ? "Ціна за 1 л"
      : "Ціна за 1 кг";

  const directPricePlaceholder =
    unitType === "piece" ? "6.5" : unitType === "volume" ? "230" : "520";

  const namePlaceholder =
    unitType === "piece"
      ? "Наприклад: Яйця курячі С1 або Коробка 24×24"
      : unitType === "volume"
      ? "Наприклад: Вершки 33% або Молоко 3,2%"
      : "Наприклад: Масло вершкове 82,5%";

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? "Редагувати продукт" : "Новий продукт"}
      subtitle={
        editing
          ? "Зміна ціни або одиниць автоматично оновить усі техкарти"
          : "Оберіть одиницю виміру та вкажіть ціну"
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4 pb-2" noValidate>
        {/* Unit Type Selector */}
        <div>
          <label className="block text-xs font-bold text-[var(--app-hint)] mb-1.5">
            Одиниця виміру
          </label>
          <div className="grid grid-cols-3 gap-1.5 rounded-[15px] bg-[var(--app-subtle)] p-1 border border-[var(--app-border)]">
            {UNIT_OPTIONS.map((opt) => {
              const active = unitType === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => {
                    hapticImpact("light");
                    setUnitType(opt.id);
                  }}
                  className={`min-h-[44px] rounded-[11px] px-2 py-1.5 transition-all cursor-pointer ${
                    active
                      ? "bg-[var(--app-card)] text-[var(--app-accent)] shadow-[0_1px_4px_rgba(42,30,23,0.08)]"
                      : "text-[var(--app-hint)] hover:text-[var(--app-text)]"
                  }`}
                >
                  <div className="text-[13px] font-extrabold leading-tight">
                    {opt.label}
                  </div>
                  <div className="text-[10px] font-semibold opacity-80 leading-tight mt-0.5">
                    {opt.sublabel}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

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
            placeholder={namePlaceholder}
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
                setPriceMode("unit");
              }}
              className={`min-h-[40px] rounded-[11px] py-2 text-xs font-bold transition-all cursor-pointer ${
                priceMode === "unit"
                  ? "bg-[var(--app-card)] text-[var(--app-text)] shadow-[0_1px_4px_rgba(42,30,23,0.08)]"
                  : "text-[var(--app-hint)] hover:text-[var(--app-text)]"
              }`}
            >
              Одразу за 1 {priceUnit}
            </button>
          </div>
        </div>

        {priceMode === "pack" ? (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-[var(--app-hint)] mb-1.5">
                  {packAmountLabel}
                </label>
                <Input
                  type="number"
                  inputMode="decimal"
                  min="0.1"
                  step="any"
                  value={packAmount}
                  onChange={(e) => setPackAmount(e.target.value)}
                  placeholder={packAmountPlaceholder}
                  suffix={recipeUnit}
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
                  placeholder={packPricePlaceholder}
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
                Ціна за 1 {priceUnit}:
              </span>
              <span className="text-[15px] font-extrabold tabular-nums text-[var(--app-accent)]">
                {formatMoney(computedUnitPrice, currency)} / {priceUnit}
              </span>
            </div>
          </div>
        ) : (
          <div>
            <label className="block text-xs font-bold text-[var(--app-hint)] mb-1.5">
              {directPriceLabel}
            </label>
            <Input
              type="number"
              inputMode="decimal"
              min="0"
              step="any"
              value={directPriceInput}
              onChange={(e) => setDirectPriceInput(e.target.value)}
              placeholder={directPricePlaceholder}
              suffix={sym}
              className="tabular-nums"
            />
          </div>
        )}

        {/* Optional Unit Weight for Piece Items */}
        {unitType === "piece" && (
          <div className="rounded-[16px] border border-[var(--app-border)] bg-[var(--app-bg)]/80 p-3.5 space-y-2">
            <label className="block text-xs font-bold text-[var(--app-text)]">
              Вага 1 шт в грамах (необов&apos;язково)
            </label>
            <Input
              type="number"
              inputMode="decimal"
              min="0"
              step="any"
              value={unitWeightGrams}
              onChange={(e) => setUnitWeightGrams(e.target.value)}
              placeholder="0"
              suffix="г"
              className="tabular-nums"
            />
            <p className="flex items-start gap-1.5 text-[11.5px] text-[var(--app-hint)] leading-relaxed">
              <Info className="h-3.5 w-3.5 shrink-0 mt-0.5 text-[var(--app-accent)]" />
              <span>
                Наприклад: для яйця ~55 г, для стручка ванілі ~4 г, для коробки
                або підкладки — 0 г. Потрібно для точного розрахунку ваги торта
                та КБЖВ.
              </span>
            </p>
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
