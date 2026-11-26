"use client";

import React, { useMemo, useState } from "react";
import { ArrowRight, Copy } from "lucide-react";
import type { RecipeWithDetails } from "@/types/pastry";
import {
  getPanRatio,
  getRecipeUnitLabel,
  roundQuantity,
  scaleRecipeText,
  type PanShape,
  type PanSpec,
} from "@/lib/calculations";
import { hapticImpact, hapticNotification } from "@/lib/telegram";
import { useApp } from "@/components/providers/AppProvider";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

interface PanRecalculatorProps {
  recipes: RecipeWithDetails[];
}

const SHAPE_LABELS: Record<PanShape, string> = {
  circle: "Коло",
  square: "Квадрат",
  rectangle: "Прямокут.",
};

export function PanRecalculator({ recipes }: PanRecalculatorProps) {
  const { showToast } = useApp();

  const [mode, setMode] = useState<"pan" | "weight" | "multiplier">("pan");
  const [sourceType, setSourceType] = useState<"text" | "recipe">(
    recipes.length > 0 ? "recipe" : "text"
  );
  const [selectedRecipeId, setSelectedRecipeId] = useState<string>(
    recipes[0] ? String(recipes[0].id) : ""
  );
  const [rawText, setRawText] = useState("");

  // Pan mode state
  const [fromPan, setFromPan] = useState<PanSpec>({
    shape: "circle",
    diameter: 16,
    width: 16,
    length: 20,
    height: 10,
  });
  const [toPan, setToPan] = useState<PanSpec>({
    shape: "circle",
    diameter: 20,
    width: 20,
    length: 24,
    height: 10,
  });

  // Weight mode state
  const [fromWeightKg, setFromWeightKg] = useState("1.5");
  const [toWeightKg, setToWeightKg] = useState("2.5");

  // Multiplier mode state
  const [multiplier, setMultiplier] = useState("2");

  const factor = useMemo(() => {
    if (mode === "pan") {
      return getPanRatio(fromPan, toPan);
    }
    if (mode === "weight") {
      const a = parseFloat(fromWeightKg.replace(",", ".")) || 0;
      const b = parseFloat(toWeightKg.replace(",", ".")) || 0;
      return a > 0 && b > 0 ? b / a : 1;
    }
    const m = parseFloat(multiplier.replace(",", ".")) || 1;
    return m > 0 ? m : 1;
  }, [mode, fromPan, toPan, fromWeightKg, toWeightKg, multiplier]);

  const selectedRecipe = useMemo(
    () => recipes.find((r) => String(r.id) === selectedRecipeId) ?? null,
    [recipes, selectedRecipeId]
  );

  const scaledText = useMemo(
    () => scaleRecipeText(rawText, factor),
    [rawText, factor]
  );

  async function handleCopyResult() {
    hapticImpact("light");
    let textToCopy = "";
    if (sourceType === "text") {
      textToCopy = scaledText;
    } else if (selectedRecipe) {
      textToCopy = [
        `${selectedRecipe.name} (коефіцієнт ×${factor.toFixed(2)})`,
        ...selectedRecipe.components.map((c) => {
          const lines = c.ingredients
            .map((ci) => {
              const unitType = ci.ingredient.unitType ?? "weight";
              const unitLabel = getRecipeUnitLabel(unitType);
              return `• ${ci.ingredient.name}: ${roundQuantity(
                ci.baseGrams * factor,
                unitType
              )} ${unitLabel}`;
            })
            .join("\n");
          return `\n${c.name}:\n${lines}`;
        }),
      ].join("\n");
    }

    if (!textToCopy.trim()) return;
    try {
      await navigator.clipboard.writeText(textToCopy);
      hapticNotification("success");
      showToast("Перерахований рецепт скопійовано", "success");
    } catch {
      showToast("Не вдалося скопіювати", "error");
    }
  }

  function renderPanInputs(
    label: string,
    pan: PanSpec,
    setPan: React.Dispatch<React.SetStateAction<PanSpec>>
  ) {
    return (
      <div className="space-y-3 rounded-[16px] bg-[var(--app-bg)] border border-[var(--app-border)] p-3.5">
        <div className="text-xs font-extrabold tracking-[-0.01em]">{label}</div>
        <div className="grid grid-cols-3 gap-1 rounded-[12px] bg-[var(--app-card)] p-1 border border-[var(--app-border)]">
          {(["circle", "square", "rectangle"] as PanShape[]).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => {
                hapticImpact("light");
                setPan((prev) => ({ ...prev, shape: s }));
              }}
              className={`min-h-[36px] rounded-[9px] py-1.5 text-[11.5px] font-bold cursor-pointer transition-all ${
                pan.shape === s
                  ? "bg-[var(--app-accent)] text-white shadow-xs"
                  : "text-[var(--app-hint)] hover:text-[var(--app-text)]"
              }`}
            >
              {SHAPE_LABELS[s]}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-2.5">
          {pan.shape === "circle" && (
            <div>
              <label className="block text-[11px] font-bold text-[var(--app-hint)] mb-1">
                Діаметр
              </label>
              <Input
                type="number"
                inputMode="decimal"
                min="1"
                value={pan.diameter}
                onChange={(e) =>
                  setPan((p) => ({
                    ...p,
                    diameter: Number(e.target.value) || 0,
                  }))
                }
                suffix="см"
                className="tabular-nums font-semibold"
              />
            </div>
          )}

          {pan.shape === "square" && (
            <div>
              <label className="block text-[11px] font-bold text-[var(--app-hint)] mb-1">
                Сторона
              </label>
              <Input
                type="number"
                inputMode="decimal"
                min="1"
                value={pan.width}
                onChange={(e) =>
                  setPan((p) => ({ ...p, width: Number(e.target.value) || 0 }))
                }
                suffix="см"
                className="tabular-nums font-semibold"
              />
            </div>
          )}

          {pan.shape === "rectangle" && (
            <>
              <div>
                <label className="block text-[11px] font-bold text-[var(--app-hint)] mb-1">
                  Ширина
                </label>
                <Input
                  type="number"
                  inputMode="decimal"
                  min="1"
                  value={pan.width}
                  onChange={(e) =>
                    setPan((p) => ({
                      ...p,
                      width: Number(e.target.value) || 0,
                    }))
                  }
                  suffix="см"
                  className="tabular-nums font-semibold"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-[var(--app-hint)] mb-1">
                  Довжина
                </label>
                <Input
                  type="number"
                  inputMode="decimal"
                  min="1"
                  value={pan.length}
                  onChange={(e) =>
                    setPan((p) => ({
                      ...p,
                      length: Number(e.target.value) || 0,
                    }))
                  }
                  suffix="см"
                  className="tabular-nums font-semibold"
                />
              </div>
            </>
          )}

          <div>
            <label className="block text-[11px] font-bold text-[var(--app-hint)] mb-1">
              Висота
            </label>
            <Input
              type="number"
              inputMode="decimal"
              min="1"
              value={pan.height}
              onChange={(e) =>
                setPan((p) => ({ ...p, height: Number(e.target.value) || 0 }))
              }
              suffix="см"
              className="tabular-nums font-semibold"
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Mode Switcher */}
      <Card className="p-4.5 space-y-4">
        <div className="grid grid-cols-3 gap-1 rounded-[15px] bg-[var(--app-subtle)] p-1 border border-[var(--app-border)]">
          {[
            { id: "pan", label: "За формою" },
            { id: "weight", label: "За вагою" },
            { id: "multiplier", label: "Кратність" },
          ].map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => {
                hapticImpact("light");
                setMode(m.id as "pan" | "weight" | "multiplier");
              }}
              className={`min-h-[40px] rounded-[11px] py-2 text-xs font-bold transition-all cursor-pointer ${
                mode === m.id
                  ? "bg-[var(--app-card)] text-[var(--app-text)] shadow-[0_1px_4px_rgba(42,30,23,0.08)]"
                  : "text-[var(--app-hint)] hover:text-[var(--app-text)]"
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>

        {mode === "pan" && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {renderPanInputs("Початкова форма", fromPan, setFromPan)}
            {renderPanInputs("Нова форма", toPan, setToPan)}
          </div>
        )}

        {mode === "weight" && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-[var(--app-hint)] mb-1.5">
                Вага за рецептом
              </label>
              <Input
                type="number"
                inputMode="decimal"
                min="0.1"
                step="0.1"
                value={fromWeightKg}
                onChange={(e) => setFromWeightKg(e.target.value)}
                suffix="кг"
                className="tabular-nums font-semibold"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-[var(--app-hint)] mb-1.5">
                Потрібна вага
              </label>
              <Input
                type="number"
                inputMode="decimal"
                min="0.1"
                step="0.1"
                value={toWeightKg}
                onChange={(e) => setToWeightKg(e.target.value)}
                suffix="кг"
                className="tabular-nums font-semibold"
              />
            </div>
          </div>
        )}

        {mode === "multiplier" && (
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              {[
                { label: "÷ 2 (×0.5)", val: "0.5" },
                { label: "× 1.5", val: "1.5" },
                { label: "× 2", val: "2" },
                { label: "× 3", val: "3" },
              ].map((chip) => (
                <button
                  key={chip.val}
                  type="button"
                  onClick={() => {
                    hapticImpact("light");
                    setMultiplier(chip.val);
                  }}
                  className={`min-h-[44px] rounded-[13px] px-4 py-2 text-xs font-extrabold tabular-nums cursor-pointer active:scale-95 transition-all ${
                    multiplier === chip.val
                      ? "bg-[var(--app-accent)] text-white shadow-[0_3px_10px_rgba(200,90,50,0.24)]"
                      : "bg-[var(--app-subtle)] border border-[var(--app-border)] text-[var(--app-text)]"
                  }`}
                >
                  {chip.label}
                </button>
              ))}
            </div>
            <div>
              <label className="block text-xs font-bold text-[var(--app-hint)] mb-1.5">
                Свій коефіцієнт
              </label>
              <Input
                type="number"
                inputMode="decimal"
                min="0.05"
                step="any"
                value={multiplier}
                onChange={(e) => setMultiplier(e.target.value)}
                suffix="×"
                className="tabular-nums font-semibold"
              />
            </div>
          </div>
        )}

        {/* Resulting Coefficient Banner */}
        <div className="flex items-center justify-between rounded-[16px] bg-[var(--app-accent-soft)] border border-[var(--app-accent)]/15 px-4 py-3">
          <span className="text-xs font-bold text-[var(--app-text)]">
            Коефіцієнт перерахунку
          </span>
          <span className="text-lg font-extrabold tabular-nums text-[var(--app-accent)]">
            × {factor.toFixed(2)}
          </span>
        </div>
      </Card>

      {/* Source Toggle (Saved Cake vs Manual Text) */}
      <Card className="p-4.5 space-y-4">
        <div className="flex items-center justify-between gap-2">
          <div className="grid grid-cols-2 gap-1 rounded-[15px] bg-[var(--app-subtle)] p-1 border border-[var(--app-border)] flex-1">
            <button
              type="button"
              onClick={() => {
                hapticImpact("light");
                setSourceType("text");
              }}
              className={`min-h-[40px] rounded-[11px] py-2 text-xs font-bold cursor-pointer transition-all ${
                sourceType === "text"
                  ? "bg-[var(--app-card)] text-[var(--app-text)] shadow-[0_1px_4px_rgba(42,30,23,0.08)]"
                  : "text-[var(--app-hint)]"
              }`}
            >
              Вручну (текст)
            </button>
            <button
              type="button"
              disabled={recipes.length === 0}
              onClick={() => {
                hapticImpact("light");
                setSourceType("recipe");
                if (!selectedRecipeId && recipes[0]) {
                  setSelectedRecipeId(String(recipes[0].id));
                }
              }}
              className={`min-h-[40px] rounded-[11px] py-2 text-xs font-bold cursor-pointer transition-all disabled:opacity-40 ${
                sourceType === "recipe"
                  ? "bg-[var(--app-card)] text-[var(--app-text)] shadow-[0_1px_4px_rgba(42,30,23,0.08)]"
                  : "text-[var(--app-hint)]"
              }`}
            >
              З моїх тортів
            </button>
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleCopyResult}
            disabled={
              sourceType === "text" ? !rawText.trim() : !selectedRecipe
            }
          >
            <Copy className="h-4 w-4" strokeWidth={2} />
            <span>Копія</span>
          </Button>
        </div>

        {sourceType === "text" ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-[var(--app-hint)] mb-1.5">
                Початковий рецепт
              </label>
              <textarea
                rows={7}
                value={rawText}
                onChange={(e) => setRawText(e.target.value)}
                placeholder={
                  "Вставте грамування по рядках, наприклад:\nБорошно — 250 г\nЦукор — 180 г\nВершки 33% — 400 г\nЯйця — 3 шт"
                }
                className="app-input w-full rounded-[16px] p-3.5 text-sm leading-relaxed resize-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-[var(--app-accent)] mb-1.5 tabular-nums">
                Перерахований рецепт (×{factor.toFixed(2)})
              </label>
              <div className="min-h-[186px] whitespace-pre-wrap rounded-[16px] border border-[var(--app-accent)]/25 bg-[var(--app-accent-soft)]/55 p-3.5 text-sm leading-relaxed tabular-nums font-medium">
                {scaledText.trim() ? (
                  scaledText
                ) : (
                  <span className="font-normal text-[var(--app-hint)]">
                    Результат з&apos;явиться тут автоматично. Відсотки жирності
                    (33%) та температури (°C) не змінюються.
                  </span>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <select
              value={selectedRecipeId}
              onChange={(e) => {
                setSelectedRecipeId(e.target.value);
                const rec = recipes.find((r) => String(r.id) === e.target.value);
                if (rec && mode === "pan") {
                  setFromPan((p) => ({
                    ...p,
                    shape: "circle",
                    diameter: rec.baseDiameter || 16,
                    height: rec.baseHeight || 10,
                  }));
                }
              }}
              className="app-input h-11 min-h-[44px] w-full rounded-[14px] px-3.5 text-sm font-semibold"
            >
              {recipes.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name} (база Ø {r.baseDiameter} см)
                </option>
              ))}
            </select>

            {selectedRecipe && (
              <div className="space-y-2.5">
                {selectedRecipe.components.map((comp) => (
                  <div
                    key={comp.id}
                    className="rounded-[16px] border border-[var(--app-border)] overflow-hidden"
                  >
                    <div className="bg-[var(--app-bg)] px-3.5 py-2.5 text-xs font-extrabold tracking-[-0.01em] border-b border-[var(--app-border)]">
                      {comp.name}
                    </div>
                    <div className="divide-y divide-[var(--app-border)]">
                      {comp.ingredients.map((ci) => {
                        const unitType = ci.ingredient.unitType ?? "weight";
                        const unitLabel = getRecipeUnitLabel(unitType);
                        return (
                          <div
                            key={ci.id}
                            className="flex items-center justify-between gap-2 px-3.5 py-2.5 text-sm"
                          >
                            <span className="truncate font-medium">
                              {ci.ingredient.name}
                            </span>
                            <span className="flex items-center gap-1.5 shrink-0 tabular-nums text-xs">
                              <span className="text-[var(--app-hint)]">
                                {roundQuantity(ci.baseGrams, unitType)}{" "}
                                {unitLabel}
                              </span>
                              <ArrowRight className="h-3.5 w-3.5 text-[var(--app-hint)]" />
                              <strong className="rounded-full bg-[var(--app-accent-soft)] px-2.5 py-0.5 text-[13px] font-extrabold text-[var(--app-accent)]">
                                {roundQuantity(ci.baseGrams * factor, unitType)}{" "}
                                {unitLabel}
                              </strong>
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </Card>
    </div>
  );
}
