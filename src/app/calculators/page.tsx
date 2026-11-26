"use client";

import React, { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Calculator, Flame, Ruler } from "lucide-react";
import type { Ingredient, RecipeWithDetails } from "@/types/pastry";
import { hapticImpact } from "@/lib/telegram";
import { QuickCostCalculator } from "@/components/calculators/QuickCostCalculator";
import { PanRecalculator } from "@/components/calculators/PanRecalculator";
import { KbjuCalculator } from "@/components/calculators/KbjuCalculator";

type CalcTab = "quick" | "pan" | "kbju";

function CalculatorsContent() {
  const searchParams = useSearchParams();
  const tabParam = searchParams.get("tab") as CalcTab | null;
  const recipeIdParam = searchParams.get("recipeId");
  const diameterParam = searchParams.get("diameter");

  const [activeTab, setActiveTab] = useState<CalcTab>(
    tabParam === "pan" || tabParam === "kbju" ? tabParam : "quick"
  );
  const [recipes, setRecipes] = useState<RecipeWithDetails[]>([]);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);

  useEffect(() => {
    if (tabParam === "quick" || tabParam === "pan" || tabParam === "kbju") {
      setActiveTab(tabParam);
    }
  }, [tabParam]);

  useEffect(() => {
    Promise.all([
      fetch("/api/recipes", { cache: "no-store" }).then((r) =>
        r.ok ? r.json() : []
      ),
      fetch("/api/ingredients", { cache: "no-store" }).then((r) =>
        r.ok ? r.json() : []
      ),
    ])
      .then(([recs, ings]) => {
        setRecipes(recs);
        setIngredients(ings);
      })
      .catch(() => null);
  }, []);

  const tabs: Array<{ id: CalcTab; label: string; icon: React.ElementType }> = [
    { id: "quick", label: "Швидкий", icon: Calculator },
    { id: "pan", label: "Форми", icon: Ruler },
    { id: "kbju", label: "КБЖВ", icon: Flame },
  ];

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold tracking-tight">Калькулятори</h1>
        <p className="text-xs text-[var(--app-hint)]">
          Швидка собівартість, перерахунок форм та харчова цінність
        </p>
      </div>

      {/* Sub-Tabs */}
      <div className="grid grid-cols-3 gap-1.5 rounded-2xl bg-[var(--app-subtle)] p-1.5 border border-[var(--app-border)]">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => {
                hapticImpact("light");
                setActiveTab(tab.id);
              }}
              className={`flex items-center justify-center gap-1.5 rounded-xl py-2.5 text-xs font-bold transition-all cursor-pointer ${
                active
                  ? "bg-[var(--app-card)] text-[var(--app-accent)] shadow-xs"
                  : "text-[var(--app-hint)] hover:text-[var(--app-text)]"
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {activeTab === "quick" && <QuickCostCalculator />}
      {activeTab === "pan" && <PanRecalculator recipes={recipes} />}
      {activeTab === "kbju" && (
        <KbjuCalculator
          recipes={recipes}
          ingredients={ingredients}
          initialRecipeId={recipeIdParam}
          initialDiameter={diameterParam ? Number(diameterParam) : null}
        />
      )}
    </div>
  );
}

export default function CalculatorsPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-4">
          <div className="h-12 rounded-2xl bg-[var(--app-subtle)] animate-pulse" />
          <div className="h-64 rounded-2xl bg-[var(--app-subtle)] animate-pulse" />
        </div>
      }
    >
      <CalculatorsContent />
    </Suspense>
  );
}
