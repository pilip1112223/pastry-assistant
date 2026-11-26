"use client";

import React, { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Calculator, Flame, Ruler } from "lucide-react";
import type { Ingredient, RecipeWithDetails } from "@/types/pastry";
import { apiFetch } from "@/lib/api-client";
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
      apiFetch("/api/recipes", { cache: "no-store" }).then((r) =>
        r.ok ? r.json() : []
      ),
      apiFetch("/api/ingredients", { cache: "no-store" }).then((r) =>
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
    <div className="space-y-5">
      <div>
        <h1 className="text-[22px] sm:text-2xl font-extrabold tracking-[-0.025em]">
          Калькулятори
        </h1>
        <p className="mt-0.5 text-xs font-medium text-[var(--app-hint)]">
          Швидка собівартість, перерахунок форм та харчова цінність
        </p>
      </div>

      {/* Tactile Sub-Tabs */}
      <div className="grid grid-cols-3 gap-1.5 rounded-[18px] bg-[var(--app-subtle)] p-1.5 border border-[var(--app-border)]">
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
              className={`flex min-h-[44px] items-center justify-center gap-1.5 rounded-[13px] py-2.5 text-[13px] font-bold transition-all active:scale-[0.97] cursor-pointer ${
                active
                  ? "bg-[var(--app-card)] text-[var(--app-accent)] shadow-[0_2px_8px_rgba(42,30,23,0.08)]"
                  : "text-[var(--app-hint)] hover:text-[var(--app-text)]"
              }`}
            >
              <Icon className="h-4 w-4" strokeWidth={active ? 2.2 : 1.85} />
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
          <div className="h-14 rounded-[18px] skeleton-shimmer" />
          <div className="h-64 rounded-[20px] skeleton-shimmer" />
        </div>
      }
    >
      <CalculatorsContent />
    </Suspense>
  );
}
