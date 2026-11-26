"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import type { CurrencyCode } from "@/types/pastry";
import { CURRENCIES } from "@/types/pastry";
import { hapticImpact, initTelegramWebApp } from "@/lib/telegram";

interface ToastMessage {
  id: number;
  text: string;
  type: "default" | "success" | "error";
}

interface AppContextValue {
  currency: CurrencyCode;
  setCurrency: (code: CurrencyCode) => void;
  storageMode: "neon" | "local" | null;
  isTelegram: boolean;
  showToast: (text: string, type?: "default" | "success" | "error") => void;
}

const AppContext = createContext<AppContextValue | null>(null);

const CURRENCY_STORAGE_KEY = "pastry_assistant_currency";

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [currency, setCurrencyState] = useState<CurrencyCode>("UAH");
  const [storageMode, setStorageMode] = useState<"neon" | "local" | null>(null);
  const [isTelegram, setIsTelegram] = useState(false);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(CURRENCY_STORAGE_KEY) as CurrencyCode | null;
      if (saved && saved in CURRENCIES) {
        setCurrencyState(saved);
      }
    } catch {
      // ignore storage errors
    }

    initTelegramWebApp().then((inTg) => setIsTelegram(inTg));

    fetch("/api/status")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.storageMode === "neon" || data?.storageMode === "local") {
          setStorageMode(data.storageMode);
        }
      })
      .catch(() => null);
  }, []);

  const setCurrency = useCallback((code: CurrencyCode) => {
    hapticImpact("light");
    setCurrencyState(code);
    try {
      localStorage.setItem(CURRENCY_STORAGE_KEY, code);
    } catch {
      // ignore
    }
  }, []);

  const showToast = useCallback(
    (text: string, type: "default" | "success" | "error" = "default") => {
      const id = Date.now() + Math.random();
      setToasts((prev) => [...prev, { id, text, type }]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 2800);
    },
    []
  );

  return (
    <AppContext.Provider
      value={{
        currency,
        setCurrency,
        storageMode,
        isTelegram,
        showToast,
      }}
    >
      {children}

      {/* Floating toast notifications positioned safely above mobile bottom nav */}
      <div className="pointer-events-none fixed inset-x-0 bottom-20 z-50 flex flex-col items-center gap-2 px-4 sm:bottom-6">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`pointer-events-auto max-w-sm rounded-2xl px-4 py-2.5 text-sm font-medium shadow-lg backdrop-blur-md transition-all ${
              toast.type === "error"
                ? "bg-[#c44536] text-white"
                : toast.type === "success"
                ? "bg-[#2f6847] text-white"
                : "bg-[#2c1f1a] text-[#faf6f1]"
            }`}
          >
            {toast.text}
          </div>
        ))}
      </div>
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) {
    throw new Error("useApp must be used within AppProvider");
  }
  return ctx;
}
