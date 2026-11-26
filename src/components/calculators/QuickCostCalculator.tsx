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
    setRows((prev) => (prev.length > 1 ? prev.filter((r) => r.id !== id) : prev));
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
      <Card className="p-4">
        <div className="grid grid-cols-3 gap-2.5">
          <div className="rounded-xl bg-[var(--app-subtle)] p-3">
            <div className="text-[11px] text-[var(--app-hint)]">Себестоимость</div>
            <div className="mt-1 text-base font-bold tabular-nums">
              {formatMoney(results.totalCost, currency)}
            </div>
          </div>
          <div className="rounded-xl bg-[var(--app-accent-soft)] p-3">
            <div className="text-[11px] text-[var(--app-accent)]">Продажа</div>
            <div className="mt-1 text-base font-bold tabular-nums text-[var(--app-accent)]">
              {formatMoney(results.sellingPrice, currency)}
            </div>
          </div>
          <div className="rounded-xl bg-[var(--app-success-soft)] p-3">
            <div className="text-[11px] text-[var(--app-success)]">Прибыль</div>
            <div className="mt-1 text-base font-bold tabular-nums text-[var(--app-success)]">
              {formatMoney(results.profit, currency)}
            </div>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 border-t border-[var(--app-border)] pt-2.5 text-xs">
          <span>
            <span className="text-[var(--app-hint)]">Себест. 1 порции: </span>
            <strong className="tabular-nums">
              {formatMoney(results.costPerPortion, currency)}
            </strong>
          </span>
          <span>
            <span className="text-[var(--app-hint)]">Цена 1 порции: </span>
            <strong className="tabular-nums text-[var(--app-accent)]">
              {formatMoney(results.pricePerPortion, currency)}
            </strong>
          </span>
        </div>
      </Card>

      {/* Yield & Markup */}
      <Card className="p-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-[var(--app-hint)] mb-1">
              Выход (порций)
            </label>
            <Input
              type="number"
              inputMode="numeric"
              min="1"
              value={portions}
              onChange={(e) => setPortions(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[var(--app-hint)] mb-1">
              Наценка (%)
            </label>
            <Input
              type="number"
              inputMode="decimal"
              min="0"
              value={markupPercent}
              onChange={(e) => setMarkupPercent(e.target.value)}
            />
          </div>
        </div>
      </Card>

      {/* Ingredient Rows */}
      <div className="space-y-2.5">
        {rows.map((row, idx) => (
          <Card key={row.id} className="p-3.5 space-y-2.5">
            <div className="flex items-center gap-2">
              <Input
                value={row.name}
                onChange={(e) => updateRow(row.id, "name", e.target.value)}
                placeholder={`Ингредиент ${idx + 1} (необязательно)`}
                className="h-9 text-sm"
              />
              <span className="shrink-0 text-xs font-bold tabular-nums text-[var(--app-accent)] min-w-[64px] text-right">
                {formatMoney(results.rowCosts[idx] ?? 0, currency)}
              </span>
              <button
                type="button"
                onClick={() => removeRow(row.id)}
                disabled={rows.length === 1}
                aria-label="Удалить строку"
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[var(--app-hint)] hover:text-[var(--app-danger)] disabled:opacity-30 cursor-pointer"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="block text-[10px] font-medium text-[var(--app-hint)] mb-0.5">
                  Упаковка (г)
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
                  className="h-9 text-sm tabular-nums"
                />
              </div>
              <div>
                <label className="block text-[10px] font-medium text-[var(--app-hint)] mb-0.5">
                  Цена ({sym})
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
                  className="h-9 text-sm tabular-nums"
                />
              </div>
              <div>
                <label className="block text-[10px] font-medium text-[var(--app-hint)] mb-0.5">
                  Расход (г)
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
                  className="h-9 text-sm tabular-nums"
                />
              </div>
            </div>
          </Card>
        ))}

        <div className="flex gap-2">
          <Button
            type="button"
            variant="secondary"
            onClick={addRow}
            className="flex-1"
          >
            <Plus className="h-4 w-4" />
            <span>Добавить ингредиент</span>
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={resetAll}
            aria-label="Сбросить"
          >
            <RotateCcw className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
