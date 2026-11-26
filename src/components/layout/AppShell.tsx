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
  Sparkles,
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
    <div className="min-h-[100dvh] flex flex-col md:flex-row bg-[var(--app-bg)]">
      {/* Compact Desktop Sidebar */}
      <aside className="hidden md:flex md:w-60 md:shrink-0 md:flex-col border-r border-[var(--app-border)] bg-[var(--app-card)] sticky top-0 h-[100dvh]">
        <div className="flex items-center gap-3 px-4 py-5 border-b border-[var(--app-border)]">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] bg-[var(--app-accent)] text-white shadow-[0_4px_12px_rgba(200,90,50,0.28)]">
            <CakeSlice className="h-5 w-5" strokeWidth={1.9} />
          </div>
          <div className="min-w-0">
            <div className="text-[14px] font-extrabold tracking-[-0.02em] leading-tight truncate">
              Асистент кондитера
            </div>
            <div className="mt-0.5 text-[11px] font-medium text-[var(--app-hint)]">
              Крафтові техкарти
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
                  "flex items-center gap-3 rounded-[14px] min-h-[44px] px-3.5 py-2.5 text-[13.5px] font-semibold transition-all duration-150 active:scale-[0.98]",
                  active
                    ? "bg-[var(--app-accent)] text-[var(--app-accent-text)] shadow-[0_4px_12px_rgba(200,90,50,0.22)]"
                    : "text-[var(--app-text)] hover:bg-[var(--app-subtle)]"
                )}
              >
                <Icon
                  className={cn(
                    "h-[18px] w-[18px] shrink-0",
                    active ? "text-white" : "text-[var(--app-hint)]"
                  )}
                  strokeWidth={active ? 2.2 : 1.85}
                />
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
            className="flex w-full min-h-[44px] items-center justify-between rounded-[14px] px-3.5 py-2.5 text-[13.5px] font-semibold text-[var(--app-text)] hover:bg-[var(--app-subtle)] active:scale-[0.98] transition-all cursor-pointer"
          >
            <span className="flex items-center gap-2.5">
              <Settings
                className="h-[18px] w-[18px] text-[var(--app-hint)]"
                strokeWidth={1.85}
              />
              Налаштування
            </span>
            <span className="rounded-lg bg-[var(--app-accent-soft)] px-2 py-0.5 text-xs font-bold text-[var(--app-accent)]">
              {CURRENCIES[currency].symbol}
            </span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Clean Mobile Top Header */}
        <header className="sticky top-0 z-30 flex items-center justify-between border-b border-[var(--app-border)] bg-[var(--app-bg)]/88 backdrop-blur-xl px-4 h-14 md:hidden">
          <Link
            href="/"
            onClick={() => hapticImpact("light")}
            className="flex items-center gap-2.5 min-w-0"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[12px] bg-[var(--app-accent)] text-white shadow-[0_3px_10px_rgba(200,90,50,0.25)]">
              <CakeSlice className="h-[18px] w-[18px]" strokeWidth={1.9} />
            </span>
            <div className="min-w-0">
              <span className="block text-[14.5px] font-extrabold tracking-[-0.02em] leading-tight truncate">
                Асистент кондитера
              </span>
              <span className="block text-[10.5px] font-medium text-[var(--app-hint)] leading-tight">
                Техкарти та розрахунки
              </span>
            </div>
          </Link>

          <button
            type="button"
            onClick={() => {
              hapticImpact("light");
              setSettingsOpen(true);
            }}
            aria-label="Налаштування"
            className="flex h-11 min-h-[44px] items-center gap-1.5 rounded-[13px] border border-[var(--app-border)] bg-[var(--app-card)] px-3 text-xs font-bold text-[var(--app-text)] shadow-[0_1px_3px_rgba(42,30,23,0.04)] cursor-pointer active:scale-[0.96] transition-all"
          >
            <span className="text-[var(--app-accent)]">
              {CURRENCIES[currency].symbol}
            </span>
            <Settings
              className="h-4 w-4 text-[var(--app-hint)]"
              strokeWidth={1.85}
            />
          </button>
        </header>

        {/* Page Container */}
        <main className="flex-1 w-full max-w-4xl mx-auto px-4 pt-4 pb-safe-page md:px-8 md:py-7">
          {children}
        </main>
      </div>

      {/* Native iOS / Telegram-style Mobile Bottom Tab Bar */}
      <nav
        aria-label="Головна навігація"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-[var(--app-border)] bg-[var(--app-card)]/92 backdrop-blur-xl shadow-[var(--app-shadow-nav)] md:hidden pb-safe"
      >
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
                  "flex flex-col items-center justify-center gap-1 min-h-[52px] rounded-2xl py-1 transition-all duration-150 active:scale-[0.95]",
                  active
                    ? "text-[var(--app-accent)]"
                    : "text-[var(--app-hint)] hover:text-[var(--app-text)]"
                )}
              >
                <span
                  className={cn(
                    "flex h-8 w-14 items-center justify-center rounded-full transition-all duration-200",
                    active ? "bg-[var(--app-accent-soft)]" : "bg-transparent"
                  )}
                >
                  <Icon
                    className="h-[20px] w-[20px]"
                    strokeWidth={active ? 2.25 : 1.75}
                  />
                </span>
                <span
                  className={cn(
                    "text-[11px] leading-tight tracking-[-0.01em]",
                    active ? "font-bold" : "font-medium"
                  )}
                >
                  {item.shortLabel}
                </span>
              </Link>
            );
          })}
        </div>
      </nav>

      {/* Settings Bottom Sheet / Modal */}
      <Modal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        title="Налаштування"
        subtitle="Валюта розрахунків та стан синхронізації"
      >
        <div className="space-y-5 pb-2">
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-[0.06em] text-[var(--app-hint)] mb-2.5">
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
                      "flex min-h-[54px] items-center justify-between rounded-[16px] border px-4 py-3 text-left transition-all duration-150 active:scale-[0.99] cursor-pointer",
                      selected
                        ? "border-[var(--app-accent)] bg-[var(--app-accent-soft)] shadow-[0_2px_10px_rgba(200,90,50,0.08)]"
                        : "border-[var(--app-border)] bg-[var(--app-card)] hover:bg-[var(--app-subtle)]"
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <span
                        className={cn(
                          "flex h-9 w-9 items-center justify-center rounded-xl text-sm font-extrabold",
                          selected
                            ? "bg-[var(--app-accent)] text-white"
                            : "bg-[var(--app-subtle)] text-[var(--app-text)]"
                        )}
                      >
                        {cfg.symbol}
                      </span>
                      <div>
                        <div className="text-[14px] font-bold leading-tight">
                          {cfg.label}
                        </div>
                        <div className="mt-0.5 text-[11.5px] font-medium text-[var(--app-hint)]">
                          Код валюти: {cfg.code}
                        </div>
                      </div>
                    </div>
                    {selected && (
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--app-accent)] text-white">
                        <Check className="h-3.5 w-3.5" strokeWidth={2.5} />
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="rounded-[18px] border border-[var(--app-border)] bg-[var(--app-subtle)]/80 p-4 space-y-2">
            <div className="flex items-center gap-2 text-xs font-bold text-[var(--app-text)]">
              <Database
                className="h-4 w-4 text-[var(--app-accent)]"
                strokeWidth={2}
              />
              <span>Сховище даних</span>
              <span
                className={cn(
                  "ml-auto inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10.5px] font-bold",
                  storageMode === "neon"
                    ? "bg-[var(--app-success-soft)] text-[var(--app-success)]"
                    : "bg-[var(--app-warning-soft)] text-[var(--app-warning)]"
                )}
              >
                <span
                  className={cn(
                    "h-1.5 w-1.5 rounded-full",
                    storageMode === "neon"
                      ? "bg-[var(--app-success)]"
                      : "bg-[var(--app-warning)]"
                  )}
                />
                {storageMode === "neon" ? "Neon Cloud" : "Локально"}
              </span>
            </div>
            <p className="text-xs text-[var(--app-hint)] leading-relaxed">
              {storageMode === "neon"
                ? "Підключено хмарну базу Neon PostgreSQL. Ваші рецепти та продукти автоматично синхронізуються між телефоном і комп'ютером."
                : "Локальний режим зберігання (змінну DATABASE_URL не задано). Підключіть Neon PostgreSQL для синхронізації між пристроями."}
            </p>
            {isTelegram && (
              <div className="inline-flex items-center gap-1.5 pt-0.5 text-xs font-semibold text-[var(--app-success)]">
                <Sparkles className="h-3.5 w-3.5" />
                <span>Працює всередині Telegram Mini App</span>
              </div>
            )}
          </div>
        </div>
      </Modal>
    </div>
  );
}
