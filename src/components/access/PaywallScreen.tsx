"use client";

import React, { useState } from "react";
import {
  CakeSlice,
  Check,
  Copy,
  Lock,
  RefreshCw,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import {
  SUBSCRIPTION_DURATION_DAYS,
  SUBSCRIPTION_STARS_PRICE,
} from "@/types/pastry";
import { hapticImpact, hapticNotification } from "@/lib/telegram";
import { useApp } from "@/components/providers/AppProvider";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export function PaywallScreen() {
  const {
    access,
    userId,
    paymentLoading,
    startSubscriptionPayment,
    refreshAccess,
    showToast,
  } = useApp();

  const [checking, setChecking] = useState(false);
  const [copied, setCopied] = useState(false);

  const displayId =
    access?.telegramId ||
    (userId.startsWith("tg_") ? userId.slice(3) : userId) ||
    "—";

  async function handleCopyId() {
    hapticImpact("light");
    try {
      await navigator.clipboard.writeText(displayId);
      setCopied(true);
      hapticNotification("success");
      showToast("ID скопійовано", "success");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      showToast("Не вдалося скопіювати ID", "error");
    }
  }

  async function handleRecheck() {
    hapticImpact("light");
    setChecking(true);
    try {
      const updated = await refreshAccess();
      if (updated?.hasAccess) {
        hapticNotification("success");
        showToast("Підписку успішно активовано!", "success");
      } else {
        showToast("Оплата ще не надійшла. Спробуйте за мить.", "default");
      }
    } finally {
      setChecking(false);
    }
  }

  return (
    <div className="min-h-[100dvh] flex flex-col items-center justify-center px-4 py-8 pb-safe bg-[var(--app-bg)]">
      <div className="w-full max-w-md space-y-4">
        {/* Brand pill */}
        <div className="flex items-center justify-center gap-2.5">
          <span className="flex h-10 w-10 items-center justify-center rounded-[14px] bg-[var(--app-accent)] text-white shadow-[0_4px_14px_rgba(200,90,50,0.28)]">
            <CakeSlice className="h-5 w-5" strokeWidth={1.9} />
          </span>
          <div className="text-left">
            <div className="text-[15px] font-extrabold tracking-[-0.02em] leading-tight">
              Асистент кондитера
            </div>
            <div className="text-[11px] font-medium text-[var(--app-hint)]">
              Крафтові техкарти та розрахунки
            </div>
          </div>
        </div>

        {/* Main Paywall Card */}
        <Card className="p-6 sm:p-7 text-center space-y-5">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-[22px] bg-[var(--app-accent-soft)] text-[var(--app-accent)] shadow-[inset_0_0_0_1px_rgba(200,90,50,0.16)]">
            <Lock className="h-7 w-7" strokeWidth={1.85} />
          </div>

          <div className="space-y-2">
            <h1 className="text-[22px] font-extrabold tracking-[-0.025em] leading-tight">
              Пробний період завершився
            </h1>
            <p className="text-[13.5px] text-[var(--app-hint)] leading-relaxed">
              Не хвилюйтесь — усі ваші рецепти, техкарти, інгредієнти та списки
              закупівель надійно збережені в базі й нікуди не зникли.
            </p>
          </div>

          {/* What is unlocked */}
          <div className="rounded-[16px] bg-[var(--app-bg)] border border-[var(--app-border)] p-4 text-left space-y-2.5">
            <div className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-[0.05em] text-[var(--app-hint)]">
              <Sparkles className="h-3.5 w-3.5 text-[var(--app-accent)]" />
              <span>Що входить у підписку</span>
            </div>
            <ul className="space-y-2 text-[13px] font-medium text-[var(--app-text)]">
              {[
                "Необмежені техкарти, собівартість і перерахунок форм",
                "Склад продуктів у грамах, мілілітрах та штуках",
                "Планувальник закупівель з експортом у Telegram",
                "Калькулятори КБЖВ, форм і швидкої собівартості",
              ].map((item) => (
                <li key={item} className="flex items-start gap-2">
                  <span className="mt-0.5 flex h-4.5 w-4.5 shrink-0 items-center justify-center rounded-full bg-[var(--app-success-soft)] text-[var(--app-success)]">
                    <Check className="h-3 w-3" strokeWidth={2.8} />
                  </span>
                  <span className="leading-snug">{item}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Primary Payment CTA */}
          <div className="space-y-2.5 pt-1">
            <Button
              type="button"
              size="lg"
              disabled={paymentLoading}
              onClick={startSubscriptionPayment}
              className="w-full text-[15px] font-extrabold"
            >
              {paymentLoading
                ? "Відкриваємо оплату..."
                : `Оплатити підписку — ${SUBSCRIPTION_STARS_PRICE} ⭐ (${SUBSCRIPTION_DURATION_DAYS} днів)`}
            </Button>

            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={checking}
              onClick={handleRecheck}
              className="w-full text-xs text-[var(--app-hint)]"
            >
              <RefreshCw
                className={`h-3.5 w-3.5 ${checking ? "animate-spin" : ""}`}
              />
              <span>
                {checking
                  ? "Перевіряємо доступ..."
                  : "Я вже оплатив — оновити доступ"}
              </span>
            </Button>
          </div>

          <div className="flex items-center justify-center gap-1.5 text-[11px] font-medium text-[var(--app-hint)]">
            <ShieldCheck className="h-3.5 w-3.5 text-[var(--app-success)]" />
            <span>Миттєва активація через Telegram Stars</span>
          </div>
        </Card>

        {/* Support ID Block */}
        <div className="flex items-center justify-between gap-3 rounded-[16px] border border-[var(--app-border)] bg-[var(--app-card)]/90 px-4 py-2.5 shadow-[0_1px_2px_rgba(42,30,23,0.03)]">
          <div className="min-w-0">
            <div className="text-[10.5px] font-bold uppercase tracking-[0.04em] text-[var(--app-hint)]">
              Для звернення в підтримку
            </div>
            <div className="truncate text-xs font-bold tabular-nums text-[var(--app-text)]">
              Ваш ID: <span className="font-mono">{displayId}</span>
            </div>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleCopyId}
            className="shrink-0 h-10 min-h-[40px] px-3 text-xs"
          >
            {copied ? (
              <Check className="h-3.5 w-3.5 text-[var(--app-success)]" />
            ) : (
              <Copy className="h-3.5 w-3.5" />
            )}
            <span>{copied ? "Скопійовано" : "Скопіювати ID"}</span>
          </Button>
        </div>
      </div>
    </div>
  );
}
