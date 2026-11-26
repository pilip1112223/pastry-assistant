"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { AlertCircle, CheckCircle2, Info } from "lucide-react";
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
      const saved = localStorage.getItem(
        CURRENCY_STORAGE_KEY
      ) as CurrencyCode | null;
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
      }, 3000);
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

      {/* Floating artisanal toast notifications positioned safely above mobile bottom tab bar */}
      <div className="pointer-events-none fixed inset-x-0 bottom-24 z-[60] flex flex-col items-center gap-2 px-4 md:bottom-6">
        {toasts.map((toast) => {
          const Icon =
            toast.type === "error"
              ? AlertCircle
              : toast.type === "success"
              ? CheckCircle2
              : Info;
          return (
            <div
              key={toast.id}
              className={`pointer-events-auto animate-toast-in flex items-center gap-2.5 max-w-sm rounded-2xl border px-4 py-3 text-[13px] font-semibold shadow-[0_10px_30px_-6px_rgba(42,30,23,0.22)] backdrop-blur-md ${
                toast.type === "error"
                  ? "border-[#b23728] bg-[#c44536] text-white"
                  : toast.type === "success"
                  ? "border-[#255b3c] bg-[#2f704b] text-white"
                  : "border-[#3c2d24] bg-[#2a1e17] text-[#faf7f2]"
              }`}
            >
              <Icon className="h-4.5 w-4.5 shrink-0 opacity-95" strokeWidth={2.2} />
              <span className="leading-snug">{toast.text}</span>
            </div>
          );
        })}
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
