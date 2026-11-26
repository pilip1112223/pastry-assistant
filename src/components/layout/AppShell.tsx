"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CakeSlice,
  Calculator,
  Check,
  Clock,
  Crown,
  Database,
  Package,
  Settings,
  ShieldCheck,
  ShoppingBasket,
  Sparkles,
  UserCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { hapticImpact } from "@/lib/telegram";
import { useApp } from "@/components/providers/AppProvider";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { PaywallScreen } from "@/components/access/PaywallScreen";
import {
  CURRENCIES,
  SUBSCRIPTION_STARS_PRICE,
  type CurrencyCode,
} from "@/types/pastry";

interface NavItem {
  href: string;
  label: string;
  shortLabel: string;
  icon: React.ElementType;
  match: (path: string) => boolean;
}

const BASE_NAV_ITEMS: NavItem[] = [
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

const ADMIN_NAV_ITEM: NavItem = {
  href: "/admin",
  label: "Адмінка",
  shortLabel: "Адмінка",
  icon: ShieldCheck,
  match: (path: string) => path.startsWith("/admin"),
};

function formatDateUk(iso?: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("uk-UA", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  } catch {
    return "—";
  }
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const {
    currency,
    setCurrency,
    storageMode,
    isTelegram,
    userId,
    userDisplayName,
    access,
    accessLoading,
    paymentLoading,
    startSubscriptionPayment,
  } = useApp();
  const [settingsOpen, setSettingsOpen] = useState(false);

  const navItems = useMemo(
    () =>
      access?.isAdmin ? [...BASE_NAV_ITEMS, ADMIN_NAV_ITEM] : BASE_NAV_ITEMS,
    [access?.isAdmin]
  );

  // Wait for access status before mounting protected pages (prevents Paywall flash)
  if (accessLoading) {
    return (
      <div className="min-h-[100dvh] flex flex-col items-center justify-center bg-[var(--app-bg)] px-4">
        <div className="flex flex-col items-center gap-3">
          <span className="flex h-12 w-12 items-center justify-center rounded-[16px] bg-[var(--app-accent)] text-white shadow-[0_6px_18px_rgba(200,90,50,0.28)] animate-pulse">
            <CakeSlice className="h-6 w-6" strokeWidth={1.9} />
          </span>
          <div className="text-sm font-extrabold tracking-[-0.015em] text-[var(--app-text)]">
            Асистент кондитера
          </div>
          <div className="h-1.5 w-28 rounded-full skeleton-shimmer" />
        </div>
      </div>
    );
  }

  // Full Paywall lock when trial/subscription expired (admins never locked)
  if (access && !access.hasAccess && !access.isAdmin) {
    return <PaywallScreen />;
  }

  const showTrialBanner =
    !accessLoading &&
    access &&
    !access.isAdmin &&
    !access.isUnlimited &&
    access.status === "trial";

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
          {navItems.map((item) => {
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
          {/* Trial Banner */}
          {showTrialBanner && (
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2.5 rounded-[18px] border border-[var(--app-accent)]/20 bg-gradient-to-r from-[var(--app-accent-soft)] to-[var(--app-warning-soft)] px-4 py-2.5 shadow-[0_2px_10px_rgba(200,90,50,0.06)]">
              <div className="flex items-center gap-2 min-w-0">
                <Clock
                  className="h-4 w-4 shrink-0 text-[var(--app-accent)]"
                  strokeWidth={2.2}
                />
                <span className="text-xs sm:text-[13px] font-bold text-[var(--app-text)] tabular-nums">
                  Пробний період: залишилось {access.trialDaysLeft} дн.
                </span>
              </div>
              <button
                type="button"
                disabled={paymentLoading}
                onClick={startSubscriptionPayment}
                className="inline-flex min-h-[36px] shrink-0 items-center gap-1.5 rounded-full bg-[var(--app-accent)] px-3.5 py-1.5 text-xs font-extrabold text-white shadow-[0_2px_8px_rgba(200,90,50,0.24)] hover:bg-[var(--app-accent-hover)] active:scale-[0.97] transition-all cursor-pointer disabled:opacity-60"
              >
                <span>
                  {paymentLoading
                    ? "Завантаження..."
                    : `Оформити — ${SUBSCRIPTION_STARS_PRICE} ⭐`}
                </span>
              </button>
            </div>
          )}

          {children}
        </main>
      </div>

      {/* Native iOS / Telegram-style Mobile Bottom Tab Bar */}
      <nav
        aria-label="Головна навігація"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-[var(--app-border)] bg-[var(--app-card)]/92 backdrop-blur-xl shadow-[var(--app-shadow-nav)] md:hidden pb-safe"
      >
        <div
          className={cn(
            "grid px-1.5 pt-1.5",
            navItems.length === 5 ? "grid-cols-5" : "grid-cols-4"
          )}
        >
          {navItems.map((item) => {
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
                    "flex h-8 w-12 items-center justify-center rounded-full transition-all duration-200",
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
                    "text-[10.5px] leading-tight tracking-[-0.01em] truncate max-w-full px-0.5",
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
        subtitle="Валюта, підписка та стан синхронізації"
      >
        <div className="space-y-4 pb-2">
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-[0.06em] text-[var(--app-hint)] mb-2">
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
                      "flex min-h-[52px] items-center justify-between rounded-[16px] border px-4 py-2.5 text-left transition-all duration-150 active:scale-[0.99] cursor-pointer",
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

          {/* Subscription Status Block */}
          {access && (
            <div className="rounded-[18px] border border-[var(--app-border)] bg-[var(--app-bg)] p-4 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-xs font-bold text-[var(--app-text)]">
                  <Crown
                    className="h-4 w-4 text-[var(--app-accent)]"
                    strokeWidth={2}
                  />
                  <span>Доступ і підписка</span>
                </div>
                <span
                  className={cn(
                    "inline-flex items-center rounded-full px-2.5 py-0.5 text-[10.5px] font-bold",
                    access.status === "admin" ||
                      access.status === "unlimited" ||
                      access.status === "active"
                      ? "bg-[var(--app-success-soft)] text-[var(--app-success)]"
                      : access.status === "trial"
                      ? "bg-[var(--app-warning-soft)] text-[var(--app-warning)]"
                      : "bg-[var(--app-danger-soft)] text-[var(--app-danger)]"
                  )}
                >
                  {access.status === "admin"
                    ? "Адміністратор"
                    : access.status === "unlimited"
                    ? "Безліміт"
                    : access.status === "active"
                    ? "Активна"
                    : access.status === "trial"
                    ? `Тріал (${access.trialDaysLeft} дн.)`
                    : "Закінчилась"}
                </span>
              </div>

              <p className="text-xs text-[var(--app-hint)] leading-relaxed tabular-nums">
                {access.status === "admin"
                  ? "У вас повний адміністративний доступ без обмежень."
                  : access.status === "unlimited"
                  ? "У вас активовано безстроковий доступ до застосунку."
                  : access.status === "active"
                  ? `Оплачена підписка діє до ${formatDateUk(
                      access.subscriptionEndsAt
                    )}.`
                  : access.status === "trial"
                  ? `Пробний період діє до ${formatDateUk(
                      access.trialEndsAt
                    )}. Ви можете оформити підписку заздалегідь.`
                  : "Пробний період завершився. Оформіть підписку, щоб продовжити роботу."}
              </p>

              {!access.isAdmin && !access.isUnlimited && (
                <Button
                  type="button"
                  size="sm"
                  disabled={paymentLoading}
                  onClick={() => {
                    setSettingsOpen(false);
                    startSubscriptionPayment();
                  }}
                  className="w-full"
                >
                  {paymentLoading
                    ? "Відкриваємо оплату..."
                    : access.status === "active"
                    ? `Продовжити на 30 днів — ${SUBSCRIPTION_STARS_PRICE} ⭐`
                    : `Оплатити підписку — ${SUBSCRIPTION_STARS_PRICE} ⭐ (30 днів)`}
                </Button>
              )}
            </div>
          )}

          {/* Profile & Isolation Info */}
          <div className="rounded-[18px] border border-[var(--app-border)] bg-[var(--app-subtle)]/80 p-4 space-y-2">
            <div className="flex items-center gap-2 text-xs font-bold text-[var(--app-text)]">
              <UserCheck
                className="h-4 w-4 text-[var(--app-accent)]"
                strokeWidth={2}
              />
              <span>Профіль та ізоляція даних</span>
              <span
                className={cn(
                  "ml-auto inline-flex items-center rounded-full px-2 py-0.5 text-[10.5px] font-bold",
                  isTelegram
                    ? "bg-[var(--app-success-soft)] text-[var(--app-success)]"
                    : "bg-[var(--app-accent-soft)] text-[var(--app-accent)]"
                )}
              >
                {isTelegram ? "Telegram" : "Браузер"}
              </span>
            </div>
            <div className="text-xs font-semibold text-[var(--app-text)]">
              {userDisplayName}
            </div>
            <p className="text-[11.5px] text-[var(--app-hint)] leading-relaxed">
              {isTelegram
                ? "Усі ваші рецепти, інгредієнти та плани закупівель прив'язані до вашого Telegram-акаунту."
                : "Ви працюєте в ізольованому гостьовому профілі цього браузера."}
            </p>
            {(access?.telegramId || userId) && (
              <div className="text-[10.5px] font-mono text-[var(--app-hint)]/80 truncate">
                ID: {access?.telegramId || userId}
              </div>
            )}
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
            {isTelegram && (
              <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--app-success)]">
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
