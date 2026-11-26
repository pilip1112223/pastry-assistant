"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CakeSlice,
  Calculator,
  Check,
  Database,
  Package,
  Settings,
  ShoppingBasket,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { hapticImpact } from "@/lib/telegram";
import { useApp } from "@/components/providers/AppProvider";
import { Modal } from "@/components/ui/modal";
import { CURRENCIES, type CurrencyCode } from "@/types/pastry";

const NAV_ITEMS = [
  {
    href: "/",
    label: "Мої торти",
    shortLabel: "Торти",
    icon: CakeSlice,
    match: (path: string) => path === "/" || path.startsWith("/recipes"),
  },
  {
    href: "/ingredients",
    label: "Склад і ціни",
    shortLabel: "Склад",
    icon: Package,
    match: (path: string) => path.startsWith("/ingredients"),
  },
  {
    href: "/procurement",
    label: "Закупівля",
    shortLabel: "Закупівля",
    icon: ShoppingBasket,
    match: (path: string) => path.startsWith("/procurement"),
  },
  {
    href: "/calculators",
    label: "Калькулятори",
    shortLabel: "Калькулятор",
    icon: Calculator,
    match: (path: string) => path.startsWith("/calculators"),
  },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { currency, setCurrency, storageMode, isTelegram } = useApp();
  const [settingsOpen, setSettingsOpen] = useState(false);

  return (
    <div className="min-h-[100dvh] flex flex-col md:flex-row">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex md:w-64 md:shrink-0 md:flex-col border-r border-[var(--app-border)] bg-[var(--app-card)] sticky top-0 h-[100dvh]">
        <div className="flex items-center gap-3 px-5 py-5 border-b border-[var(--app-border)]">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[var(--app-accent-soft)] text-[var(--app-accent)]">
            <CakeSlice className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <div className="text-sm font-bold leading-tight truncate">
              Асистент кондитера
            </div>
            <div className="text-xs text-[var(--app-hint)]">
              Техкарти та розрахунки
            </div>
          </div>
        </div>

        <nav className="flex-1 p-3 space-y-1">
          {NAV_ITEMS.map((item) => {
            const active = item.match(pathname);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => hapticImpact("light")}
                className={cn(
                  "flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-semibold transition-colors",
                  active
                    ? "bg-[var(--app-accent)] text-[var(--app-accent-text)] shadow-xs"
                    : "text-[var(--app-text)] hover:bg-[var(--app-subtle)]"
                )}
              >
                <Icon className="h-4.5 w-4.5 shrink-0" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="p-3 border-t border-[var(--app-border)]">
          <button
            type="button"
            onClick={() => {
              hapticImpact("light");
              setSettingsOpen(true);
            }}
            className="flex w-full items-center justify-between rounded-xl px-3.5 py-2.5 text-sm font-medium text-[var(--app-text)] hover:bg-[var(--app-subtle)] cursor-pointer"
          >
            <span className="flex items-center gap-2.5">
              <Settings className="h-4 w-4 text-[var(--app-hint)]" />
              Налаштування
            </span>
            <span className="rounded-lg bg-[var(--app-subtle)] px-2 py-0.5 text-xs font-semibold text-[var(--app-hint)]">
              {CURRENCIES[currency].symbol}
            </span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Compact Mobile Top Bar */}
        <header className="sticky top-0 z-30 flex items-center justify-between border-b border-[var(--app-border)] bg-[var(--app-card)]/92 backdrop-blur-md px-4 h-13 md:hidden">
          <Link
            href="/"
            onClick={() => hapticImpact("light")}
            className="flex items-center gap-2.5 min-w-0"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-[var(--app-accent-soft)] text-[var(--app-accent)]">
              <CakeSlice className="h-4 w-4" />
            </span>
            <span className="text-sm font-bold truncate">
              Асистент кондитера
            </span>
          </Link>

          <button
            type="button"
            onClick={() => {
              hapticImpact("light");
              setSettingsOpen(true);
            }}
            aria-label="Налаштування"
            className="flex items-center gap-1.5 rounded-xl bg-[var(--app-subtle)] px-2.5 py-1.5 text-xs font-semibold text-[var(--app-text)] cursor-pointer active:scale-95 transition-transform"
          >
            <span>{CURRENCIES[currency].symbol}</span>
            <Settings className="h-3.5 w-3.5 text-[var(--app-hint)]" />
          </button>
        </header>

        {/* Page Container */}
        <main className="flex-1 w-full max-w-4xl mx-auto px-3.5 pt-4 pb-24 md:px-8 md:py-7 md:pb-10">
          {children}
        </main>
      </div>

      {/* Mobile Bottom Navigation Bar */}
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-[var(--app-border)] bg-[var(--app-card)]/95 backdrop-blur-md md:hidden pb-safe">
        <div className="grid grid-cols-4 px-2 pt-1.5">
          {NAV_ITEMS.map((item) => {
            const active = item.match(pathname);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => hapticImpact("light")}
                className={cn(
                  "flex flex-col items-center justify-center gap-0.5 rounded-xl py-1.5 transition-colors",
                  active
                    ? "text-[var(--app-accent)]"
                    : "text-[var(--app-hint)] hover:text-[var(--app-text)]"
                )}
              >
                <span
                  className={cn(
                    "flex h-7 w-12 items-center justify-center rounded-full transition-colors",
                    active ? "bg-[var(--app-accent-soft)]" : "bg-transparent"
                  )}
                >
                  <Icon className="h-4.5 w-4.5" strokeWidth={active ? 2.3 : 1.9} />
                </span>
                <span className="text-[11px] font-semibold leading-tight">
                  {item.shortLabel}
                </span>
              </Link>
            );
          })}
        </div>
      </nav>

      {/* Settings Modal */}
      <Modal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        title="Налаштування"
        subtitle="Валюта розрахунків та стан підключення"
      >
        <div className="space-y-5">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--app-hint)] mb-2">
              Валюта відображення
            </label>
            <div className="grid grid-cols-1 gap-2">
              {(Object.keys(CURRENCIES) as CurrencyCode[]).map((code) => {
                const cfg = CURRENCIES[code];
                const selected = currency === code;
                return (
                  <button
                    key={code}
                    type="button"
                    onClick={() => setCurrency(code)}
                    className={cn(
                      "flex items-center justify-between rounded-xl border px-3.5 py-3 text-left transition-all cursor-pointer",
                      selected
                        ? "border-[var(--app-accent)] bg-[var(--app-accent-soft)]"
                        : "border-[var(--app-border)] bg-[var(--app-card)] hover:bg-[var(--app-subtle)]"
                    )}
                  >
                    <div>
                      <div className="text-sm font-semibold">{cfg.label}</div>
                      <div className="text-xs text-[var(--app-hint)]">
                        Код: {cfg.code}
                      </div>
                    </div>
                    {selected && (
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--app-accent)] text-[var(--app-accent-text)]">
                        <Check className="h-3.5 w-3.5" />
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-subtle)] p-3.5 space-y-2">
            <div className="flex items-center gap-2 text-xs font-semibold">
              <Database className="h-4 w-4 text-[var(--app-accent)]" />
              <span>Сховище даних</span>
            </div>
            <p className="text-xs text-[var(--app-hint)] leading-relaxed">
              {storageMode === "neon"
                ? "Підключено базу даних Neon PostgreSQL. Ваші рецепти та продукти синхронізуються між телефоном і комп'ютером."
                : "Локальний режим зберігання (змінну DATABASE_URL не задано). Підключіть Neon PostgreSQL для синхронізації між пристроями."}
            </p>
            {isTelegram && (
              <p className="text-xs font-medium text-[var(--app-success)]">
                Відкрито всередині Telegram Mini App
              </p>
            )}
          </div>
        </div>
      </Modal>
    </div>
  );
}
