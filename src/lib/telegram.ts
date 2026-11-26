"use client";

import { useEffect } from "react";

type ImpactStyle = "light" | "medium" | "heavy" | "rigid" | "soft";
type NotificationType = "error" | "success" | "warning";

export interface TelegramWebAppUser {
  id: number | string;
  first_name?: string;
  last_name?: string;
  username?: string;
}

interface TelegramWebAppInstance {
  initData?: string;
  initDataUnsafe?: {
    user?: TelegramWebAppUser;
  };
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

const GUEST_ID_STORAGE_KEY = "pastry_assistant_guest_id";

let sdkPromise: Promise<TelegramWebAppInstance | null> | null = null;
let cachedWebApp: TelegramWebAppInstance | null = null;
let memoryGuestId: string | null = null;

function getWindowWebApp(): TelegramWebAppInstance | null {
  if (typeof window === "undefined") return null;
  const tg = (
    window as unknown as { Telegram?: { WebApp?: TelegramWebAppInstance } }
  ).Telegram;
  return tg?.WebApp ?? null;
}

function generateGuestId(): string {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return `guest_${crypto.randomUUID()}`;
  }
  return `guest_${Date.now().toString(36)}_${Math.random()
    .toString(36)
    .slice(2, 10)}`;
}

export function getTelegramUser(): TelegramWebAppUser | null {
  if (typeof window === "undefined") return null;
  const wa = getWindowWebApp() ?? cachedWebApp;
  const user = wa?.initDataUnsafe?.user;
  if (user && user.id !== undefined && user.id !== null) {
    return user;
  }
  return null;
}

export function getTelegramInitData(): string | null {
  if (typeof window === "undefined") return null;
  const wa = getWindowWebApp() ?? cachedWebApp;
  if (wa?.initData && wa.initData.trim().length > 0) {
    return wa.initData;
  }
  return null;
}

export function getClientUserId(): string {
  const tgUser = getTelegramUser();
  if (tgUser) {
    return `tg_${String(tgUser.id)}`;
  }

  if (typeof window !== "undefined") {
    try {
      const existing = localStorage.getItem(GUEST_ID_STORAGE_KEY);
      if (existing && existing.trim().length > 0) {
        return existing;
      }
      const created = generateGuestId();
      localStorage.setItem(GUEST_ID_STORAGE_KEY, created);
      return created;
    } catch {
      // Fallback when localStorage is unavailable
    }
  }

  if (!memoryGuestId) {
    memoryGuestId = generateGuestId();
  }
  return memoryGuestId;
}

export function getClientIdentity(): {
  userId: string;
  isTelegramUser: boolean;
  displayName: string;
} {
  const tgUser = getTelegramUser();
  if (tgUser) {
    const fullName = [tgUser.first_name, tgUser.last_name]
      .filter(Boolean)
      .join(" ")
      .trim();
    return {
      userId: `tg_${String(tgUser.id)}`,
      isTelegramUser: true,
      displayName: fullName || (tgUser.username ? `@${tgUser.username}` : `ID ${tgUser.id}`),
    };
  }
  return {
    userId: getClientUserId(),
    isTelegramUser: false,
    displayName: "Гість (браузер)",
  };
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
  const wa = getWindowWebApp() ?? cachedWebApp;
  return Boolean(
    wa && ((wa.initData && wa.initData.length > 0) || wa.initDataUnsafe?.user?.id)
  );
}

export async function initTelegramWebApp(): Promise<boolean> {
  if (typeof window === "undefined") return false;
  try {
    const wa = await loadTelegramWebApp();
    if (!wa) return false;
    wa.ready();
    wa.expand();
    return Boolean(
      (wa.initData && wa.initData.length > 0) || wa.initDataUnsafe?.user?.id
    );
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
