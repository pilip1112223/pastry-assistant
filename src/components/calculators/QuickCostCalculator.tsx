"use client";

import React, { useMemo, useState } from "react";
import { Plus, RotateCcw, Trash2 } from "lucide-react";
import { CURRENCIES } from "@/types/pastry";
import { formatMoney } from "@/lib/calculations";
import { hapticImpact } from "@/lib/telegram";
import { useApp } from "@/components/providers/AppProvider";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

interface QuickRow {
  id: string;
  name: string;
  packWeight: string;
  packPrice: string;
  usedGrams: string;
}

function makeRow(): QuickRow {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    name: "",
    packWeight: "",
    packPrice: "",
    usedGrams: "",
  };
}

export function QuickCostCalculator() {
  const { currency } = useApp();
  const [rows, setRows] = useState<QuickRow[]>([makeRow(), makeRow()]);
  const [portions, setPortions] = useState("8");
  const [markupPercent, setMarkupPercent] = useState("100");

  function updateRow(id: string, field: keyof QuickRow, value: string) {
    setRows((prev) =>
      prev.map((r) => (r.id === id ? { ...r, [field]: value } : r))
    );
  }

  function addRow() {
    hapticImpact("light");
    setRows((prev) => [...prev, makeRow()]);
  }

  function removeRow(id: string) {
    hapticImpact("light");
    setRows((prev) =>
      prev.length > 1 ? prev.filter((r) => r.id !== id) : prev
    );
  }

  function resetAll() {
    hapticImpact("light");
    setRows([makeRow(), makeRow()]);
    setPortions("8");
    setMarkupPercent("100");
  }

  const results = useMemo(() => {
    const rowCosts = rows.map((r) => {
      const pw = parseFloat(r.packWeight.replace(",", ".")) || 0;
      const pp = parseFloat(r.packPrice.replace(",", ".")) || 0;
      const ug = parseFloat(r.usedGrams.replace(",", ".")) || 0;
      if (pw <= 0 || pp < 0 || ug <= 0) return 0;
      return (pp / pw) * ug;
    });

    const totalCost = rowCosts.reduce((s, c) => s + c, 0);
    const totalGrams = rows.reduce(
      (s, r) => s + (parseFloat(r.usedGrams.replace(",", ".")) || 0),
      0
    );
    const pCount = Math.max(1, parseInt(portions, 10) || 1);
    const markup = Math.max(0, parseFloat(markupPercent.replace(",", ".")) || 0);
    const sellingPrice = totalCost * (1 + markup / 100);
    const profit = sellingPrice - totalCost;

    return {
      rowCosts,
      totalCost,
      totalGrams,
      costPerPortion: totalCost / pCount,
      sellingPrice,
      pricePerPortion: sellingPrice / pCount,
      profit,
    };
  }, [rows, portions, markupPercent]);

  const sym = CURRENCIES[currency].symbol;

  return (
    <div className="space-y-4">
      {/* Live KPI Summary */}
      <Card className="p-4.5">
        <div className="grid grid-cols-3 gap-2.5">
          <div className="rounded-[16px] bg-[var(--app-bg)] border border-[var(--app-border)] p-3">
            <div className="text-[10.5px] font-bold uppercase tracking-[0.04em] text-[var(--app-hint)]">
              Собівартість
            </div>
            <div className="mt-1 text-[15px] sm:text-lg font-extrabold tabular-nums">
              {formatMoney(results.totalCost, currency)}
            </div>
          </div>
          <div className="rounded-[16px] bg-[var(--app-accent-soft)] border border-[var(--app-accent)]/15 p-3">
            <div className="text-[10.5px] font-bold uppercase tracking-[0.04em] text-[var(--app-accent)]">
              Продаж
            </div>
            <div className="mt-1 text-[15px] sm:text-lg font-extrabold tabular-nums text-[var(--app-accent)]">
              {formatMoney(results.sellingPrice, currency)}
            </div>
          </div>
          <div className="rounded-[16px] bg-[var(--app-success-soft)] border border-[var(--app-success)]/15 p-3">
            <div className="text-[10.5px] font-bold uppercase tracking-[0.04em] text-[var(--app-success)]">
              Прибуток
            </div>
            <div className="mt-1 text-[15px] sm:text-lg font-extrabold tabular-nums text-[var(--app-success)]">
              {formatMoney(results.profit, currency)}
            </div>
          </div>
        </div>

        <div className="mt-3.5 flex flex-wrap gap-2 border-t border-[var(--app-border)] pt-3 text-xs">
          <span className="inline-flex items-center rounded-full bg-[var(--app-subtle)] px-3 py-1 font-semibold tabular-nums">
            <span className="text-[var(--app-hint)] mr-1">
              Собіварт. 1 порції:
            </span>
            <strong>{formatMoney(results.costPerPortion, currency)}</strong>
          </span>
          <span className="inline-flex items-center rounded-full bg-[var(--app-accent-soft)] px-3 py-1 font-bold tabular-nums text-[var(--app-accent)]">
            <span className="opacity-80 mr-1 font-semibold">
              Ціна 1 порції:
            </span>
            <strong>{formatMoney(results.pricePerPortion, currency)}</strong>
          </span>
        </div>
      </Card>

      {/* Yield & Markup */}
      <Card className="p-4.5">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-bold text-[var(--app-hint)] mb-1.5">
              Вихід виробу
            </label>
            <Input
              type="number"
              inputMode="numeric"
              min="1"
              value={portions}
              onChange={(e) => setPortions(e.target.value)}
              suffix="порц."
              className="tabular-nums font-semibold"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-[var(--app-hint)] mb-1.5">
              Націнка
            </label>
            <Input
              type="number"
              inputMode="decimal"
              min="0"
              value={markupPercent}
              onChange={(e) => setMarkupPercent(e.target.value)}
              suffix="%"
              className="tabular-nums font-semibold"
            />
          </div>
        </div>
      </Card>

      {/* Ingredient Rows */}
      <div className="space-y-3">
        {rows.map((row, idx) => (
          <Card key={row.id} className="p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Input
                value={row.name}
                onChange={(e) => updateRow(row.id, "name", e.target.value)}
                placeholder={`Інгредієнт ${idx + 1} (необов'язково)`}
              />
              <span className="shrink-0 rounded-full bg-[var(--app-accent-soft)] px-2.5 py-1 text-xs font-extrabold tabular-nums text-[var(--app-accent)] min-w-[70px] text-center">
                {formatMoney(results.rowCosts[idx] ?? 0, currency)}
              </span>
              <button
                type="button"
                onClick={() => removeRow(row.id)}
                disabled={rows.length === 1}
                aria-label="Видалити рядок"
                className="flex h-11 w-10 min-h-[44px] shrink-0 items-center justify-center rounded-xl text-[var(--app-hint)] hover:bg-[var(--app-danger-soft)] hover:text-[var(--app-danger)] disabled:opacity-30 active:scale-95 transition-all cursor-pointer"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>

            <div className="grid grid-cols-3 gap-2.5">
              <div>
                <label className="block text-[11px] font-bold text-[var(--app-hint)] mb-1">
                  Упаковка
                </label>
                <Input
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="any"
                  value={row.packWeight}
                  onChange={(e) =>
                    updateRow(row.id, "packWeight", e.target.value)
                  }
                  placeholder="1000"
                  suffix="г"
                  className="tabular-nums"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-[var(--app-hint)] mb-1">
                  Ціна
                </label>
                <Input
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="any"
                  value={row.packPrice}
                  onChange={(e) =>
                    updateRow(row.id, "packPrice", e.target.value)
                  }
                  placeholder="120"
                  suffix={sym}
                  className="tabular-nums"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-[var(--app-hint)] mb-1">
                  Витрата
                </label>
                <Input
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="any"
                  value={row.usedGrams}
                  onChange={(e) =>
                    updateRow(row.id, "usedGrams", e.target.value)
                  }
                  placeholder="250"
                  suffix="г"
                  className="tabular-nums"
                />
              </div>
            </div>
          </Card>
        ))}

        <div className="flex gap-2.5">
          <Button
            type="button"
            variant="secondary"
            onClick={addRow}
            className="flex-1"
          >
            <Plus className="h-4 w-4" strokeWidth={2.3} />
            <span>Додати інгредієнт</span>
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={resetAll}
            aria-label="Скинути"
          >
            <RotateCcw className="h-4 w-4" strokeWidth={2} />
          </Button>
        </div>
      </div>
    </div>
  );
}
