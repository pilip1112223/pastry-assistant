"use client";

import React, { useMemo, useState } from "react";
import { ArrowRight, Copy } from "lucide-react";
import type { RecipeWithDetails } from "@/types/pastry";
import {
  getPanRatio,
  roundGrams,
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
  circle: "Круг",
  square: "Квадрат",
  rectangle: "Прямоуг.",
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
        `${selectedRecipe.name} (коэффициент ×${factor.toFixed(2)})`,
        ...selectedRecipe.components.map((c) => {
          const lines = c.ingredients
            .map((ci) => `• ${ci.ingredient.name}: ${roundGrams(ci.baseGrams * factor)} г`)
            .join("\n");
          return `\n${c.name}:\n${lines}`;
        }),
      ].join("\n");
    }

    if (!textToCopy.trim()) return;
    try {
      await navigator.clipboard.writeText(textToCopy);
      hapticNotification("success");
      showToast("Пересчитанный рецепт скопирован", "success");
    } catch {
      showToast("Не удалось скопировать", "error");
    }
  }

  function renderPanInputs(
    label: string,
    pan: PanSpec,
    setPan: React.Dispatch<React.SetStateAction<PanSpec>>
  ) {
    return (
      <div className="space-y-2.5 rounded-xl bg-[var(--app-subtle)] p-3">
        <div className="text-xs font-bold">{label}</div>
        <div className="grid grid-cols-3 gap-1 rounded-lg bg-[var(--app-card)] p-0.5 border border-[var(--app-border)]">
          {(["circle", "square", "rectangle"] as PanShape[]).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => {
                hapticImpact("light");
                setPan((prev) => ({ ...prev, shape: s }));
              }}
              className={`rounded-md py-1.5 text-[11px] font-semibold cursor-pointer transition-colors ${
                pan.shape === s
                  ? "bg-[var(--app-accent)] text-[var(--app-accent-text)]"
                  : "text-[var(--app-hint)]"
              }`}
            >
              {SHAPE_LABELS[s]}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-2">
          {pan.shape === "circle" && (
            <div>
              <label className="block text-[10px] text-[var(--app-hint)] mb-0.5">
                Диаметр (см)
              </label>
              <Input
                type="number"
                inputMode="decimal"
                min="1"
                value={pan.diameter}
                onChange={(e) =>
                  setPan((p) => ({ ...p, diameter: Number(e.target.value) || 0 }))
                }
                className="h-9 text-sm tabular-nums"
              />
            </div>
          )}

          {pan.shape === "square" && (
            <div>
              <label className="block text-[10px] text-[var(--app-hint)] mb-0.5">
                Сторона (см)
              </label>
              <Input
                type="number"
                inputMode="decimal"
                min="1"
                value={pan.width}
                onChange={(e) =>
                  setPan((p) => ({ ...p, width: Number(e.target.value) || 0 }))
                }
                className="h-9 text-sm tabular-nums"
              />
            </div>
          )}

          {pan.shape === "rectangle" && (
            <>
              <div>
                <label className="block text-[10px] text-[var(--app-hint)] mb-0.5">
                  Ширина (см)
                </label>
                <Input
                  type="number"
                  inputMode="decimal"
                  min="1"
                  value={pan.width}
                  onChange={(e) =>
                    setPan((p) => ({ ...p, width: Number(e.target.value) || 0 }))
                  }
                  className="h-9 text-sm tabular-nums"
                />
              </div>
              <div>
                <label className="block text-[10px] text-[var(--app-hint)] mb-0.5">
                  Длина (см)
                </label>
                <Input
                  type="number"
                  inputMode="decimal"
                  min="1"
                  value={pan.length}
                  onChange={(e) =>
                    setPan((p) => ({ ...p, length: Number(e.target.value) || 0 }))
                  }
                  className="h-9 text-sm tabular-nums"
                />
              </div>
            </>
          )}

          <div>
            <label className="block text-[10px] text-[var(--app-hint)] mb-0.5">
              Высота (см)
            </label>
            <Input
              type="number"
              inputMode="decimal"
              min="1"
              value={pan.height}
              onChange={(e) =>
                setPan((p) => ({ ...p, height: Number(e.target.value) || 0 }))
              }
              className="h-9 text-sm tabular-nums"
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Mode Switcher */}
      <Card className="p-4 space-y-3.5">
        <div className="grid grid-cols-3 gap-1 rounded-xl bg-[var(--app-subtle)] p-1">
          {[
            { id: "pan", label: "По форме" },
            { id: "weight", label: "По весу" },
            { id: "multiplier", label: "Кратность" },
          ].map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => {
                hapticImpact("light");
                setMode(m.id as "pan" | "weight" | "multiplier");
              }}
              className={`rounded-lg py-2 text-xs font-semibold transition-all cursor-pointer ${
                mode === m.id
                  ? "bg-[var(--app-card)] text-[var(--app-text)] shadow-xs"
                  : "text-[var(--app-hint)]"
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>

        {mode === "pan" && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {renderPanInputs("Исходная форма", fromPan, setFromPan)}
            {renderPanInputs("Новая форма", toPan, setToPan)}
          </div>
        )}

        {mode === "weight" && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[var(--app-hint)] mb-1">
                Вес по рецепту (кг)
              </label>
              <Input
                type="number"
                inputMode="decimal"
                min="0.1"
                step="0.1"
                value={fromWeightKg}
                onChange={(e) => setFromWeightKg(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[var(--app-hint)] mb-1">
                Нужный вес (кг)
              </label>
              <Input
                type="number"
                inputMode="decimal"
                min="0.1"
                step="0.1"
                value={toWeightKg}
                onChange={(e) => setToWeightKg(e.target.value)}
              />
            </div>
          </div>
        )}

        {mode === "multiplier" && (
          <div className="space-y-2.5">
            <div className="flex flex-wrap gap-1.5">
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
                  className={`rounded-xl px-3.5 py-2 text-xs font-bold cursor-pointer transition-colors ${
                    multiplier === chip.val
                      ? "bg-[var(--app-accent)] text-[var(--app-accent-text)]"
                      : "bg-[var(--app-subtle)] text-[var(--app-text)]"
                  }`}
                >
                  {chip.label}
                </button>
              ))}
            </div>
            <div>
              <label className="block text-xs font-semibold text-[var(--app-hint)] mb-1">
                Свой коэффициент
              </label>
              <Input
                type="number"
                inputMode="decimal"
                min="0.05"
                step="any"
                value={multiplier}
                onChange={(e) => setMultiplier(e.target.value)}
              />
            </div>
          </div>
        )}

        {/* Resulting Coefficient Banner */}
        <div className="flex items-center justify-between rounded-xl bg-[var(--app-accent-soft)] px-3.5 py-2.5">
          <span className="text-xs font-semibold">Коэффициент пересчёта</span>
          <span className="text-base font-bold tabular-nums text-[var(--app-accent)]">
            × {factor.toFixed(2)}
          </span>
        </div>
      </Card>

      {/* Source Toggle (Saved Cake vs Manual Text) */}
      <Card className="p-4 space-y-3.5">
        <div className="flex items-center justify-between gap-2">
          <div className="grid grid-cols-2 gap-1 rounded-xl bg-[var(--app-subtle)] p-1 flex-1">
            <button
              type="button"
              onClick={() => {
                hapticImpact("light");
                setSourceType("text");
              }}
              className={`rounded-lg py-1.5 text-xs font-semibold cursor-pointer ${
                sourceType === "text"
                  ? "bg-[var(--app-card)] text-[var(--app-text)] shadow-xs"
                  : "text-[var(--app-hint)]"
              }`}
            >
              Вручную (текст)
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
              className={`rounded-lg py-1.5 text-xs font-semibold cursor-pointer disabled:opacity-40 ${
                sourceType === "recipe"
                  ? "bg-[var(--app-card)] text-[var(--app-text)] shadow-xs"
                  : "text-[var(--app-hint)]"
              }`}
            >
              Из моих тортов
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
            <Copy className="h-3.5 w-3.5" />
            <span>Копия</span>
          </Button>
        </div>

        {sourceType === "text" ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[var(--app-hint)] mb-1">
                Исходный рецепт
              </label>
              <textarea
                rows={7}
                value={rawText}
                onChange={(e) => setRawText(e.target.value)}
                placeholder={
                  "Вставьте граммовки построчно, например:\nМука — 250 г\nСахар — 180 г\nСливки 33% — 400 г\nЯйца — 3 шт"
                }
                className="app-input w-full rounded-xl p-3 text-sm leading-relaxed resize-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[var(--app-accent)] mb-1">
                Пересчитанный рецепт (×{factor.toFixed(2)})
              </label>
              <div className="min-h-[178px] whitespace-pre-wrap rounded-xl border border-[var(--app-accent)]/30 bg-[var(--app-accent-soft)]/50 p-3 text-sm leading-relaxed tabular-nums">
                {scaledText.trim() ? (
                  scaledText
                ) : (
                  <span className="text-[var(--app-hint)]">
                    Результат появится здесь автоматически. Проценты жирности
                    (33%) и температуры (°C) не изменяются.
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
              className="app-input h-11 w-full rounded-xl px-3 text-sm font-medium"
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
                    className="rounded-xl border border-[var(--app-border)] overflow-hidden"
                  >
                    <div className="bg-[var(--app-subtle)] px-3 py-2 text-xs font-bold">
                      {comp.name}
                    </div>
                    <div className="divide-y divide-[var(--app-border)]">
                      {comp.ingredients.map((ci) => (
                        <div
                          key={ci.id}
                          className="flex items-center justify-between gap-2 px-3 py-2 text-sm"
                        >
                          <span className="truncate">{ci.ingredient.name}</span>
                          <span className="flex items-center gap-1.5 shrink-0 tabular-nums text-xs">
                            <span className="text-[var(--app-hint)]">
                              {roundGrams(ci.baseGrams)} г
                            </span>
                            <ArrowRight className="h-3 w-3 text-[var(--app-hint)]" />
                            <strong className="text-sm text-[var(--app-accent)]">
                              {roundGrams(ci.baseGrams * factor)} г
                            </strong>
                          </span>
                        </div>
                      ))}
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
