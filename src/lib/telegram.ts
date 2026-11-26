"use client";

import { useEffect } from "react";

type ImpactStyle = "light" | "medium" | "heavy" | "rigid" | "soft";
type NotificationType = "error" | "success" | "warning";

interface TelegramWebAppInstance {
  initData?: string;
  colorScheme?: "light" | "dark";
  themeParams?: Record<string, string | undefined>;
  ready: () => void;
  expand: () => void;
  openTelegramLink?: (url: string) => void;
  HapticFeedback?: {
    impactOccurred: (style: ImpactStyle) => void;
    notificationOccurred: (type: NotificationType) => void;
    selectionChanged: () => void;
  };
  BackButton?: {
    show: () => void;
    hide: () => void;
    onClick: (cb: () => void) => void;
    offClick: (cb: () => void) => void;
  };
}

let sdkPromise: Promise<TelegramWebAppInstance | null> | null = null;
let cachedWebApp: TelegramWebAppInstance | null = null;

function getWindowWebApp(): TelegramWebAppInstance | null {
  if (typeof window === "undefined") return null;
  const tg = (window as unknown as { Telegram?: { WebApp?: TelegramWebAppInstance } }).Telegram;
  return tg?.WebApp ?? null;
}

export async function loadTelegramWebApp(): Promise<TelegramWebAppInstance | null> {
  if (typeof window === "undefined") return null;
  if (cachedWebApp) return cachedWebApp;

  const fromWindow = getWindowWebApp();
  if (fromWindow) {
    cachedWebApp = fromWindow;
    return cachedWebApp;
  }

  if (!sdkPromise) {
    sdkPromise = import("@twa-dev/sdk")
      .then((mod) => {
        const wa = mod.default as unknown as TelegramWebAppInstance;
        cachedWebApp = wa;
        return wa;
      })
      .catch(() => null);
  }
  return sdkPromise;
}

export function isRunningInTelegram(): boolean {
  if (typeof window === "undefined") return false;
  const wa = cachedWebApp ?? getWindowWebApp();
  return Boolean(wa && wa.initData && wa.initData.length > 0);
}

export async function initTelegramWebApp(): Promise<boolean> {
  if (typeof window === "undefined") return false;
  try {
    const wa = await loadTelegramWebApp();
    if (!wa) return false;
    wa.ready();
    wa.expand();
    return Boolean(wa.initData && wa.initData.length > 0);
  } catch {
    return false;
  }
}

export function hapticImpact(style: ImpactStyle = "light"): void {
  if (typeof window === "undefined") return;
  try {
    const wa = cachedWebApp ?? getWindowWebApp();
    wa?.HapticFeedback?.impactOccurred(style);
  } catch {
    // No-op outside Telegram
  }
}

export function hapticNotification(type: NotificationType = "success"): void {
  if (typeof window === "undefined") return;
  try {
    const wa = cachedWebApp ?? getWindowWebApp();
    wa?.HapticFeedback?.notificationOccurred(type);
  } catch {
    // No-op outside Telegram
  }
}

export function openTelegramShare(text: string): void {
  if (typeof window === "undefined") return;
  const shareUrl = `https://t.me/share/url?text=${encodeURIComponent(text)}`;
  try {
    const wa = cachedWebApp ?? getWindowWebApp();
    if (wa && wa.initData && typeof wa.openTelegramLink === "function") {
      wa.openTelegramLink(shareUrl);
      return;
    }
  } catch {
    // Fallback to browser open
  }
  window.open(shareUrl, "_blank", "noopener,noreferrer");
}

export function useTelegramBackButton(onBack?: () => void): void {
  useEffect(() => {
    if (typeof window === "undefined" || !onBack) return;
    let active = true;
    let waRef: TelegramWebAppInstance | null = null;

    loadTelegramWebApp().then((wa) => {
      if (!active || !wa?.BackButton || !wa.initData) return;
      waRef = wa;
      wa.BackButton.onClick(onBack);
      wa.BackButton.show();
    });

    return () => {
      active = false;
      try {
        waRef?.BackButton?.offClick(onBack);
        waRef?.BackButton?.hide();
      } catch {
        // ignore
      }
    };
  }, [onBack]);
}
