"use client";

import * as React from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  className?: string;
}

export function Modal({
  open,
  onClose,
  title,
  subtitle,
  children,
  className,
}: ModalProps) {
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
    >
      <div
        className="fixed inset-0 bg-[#2A1E17]/38 backdrop-blur-[4px] animate-fade-in"
        onClick={onClose}
      />
      <div
        className={cn(
          "relative z-10 flex max-h-[90dvh] w-full flex-col overflow-hidden rounded-t-[28px] sm:max-w-lg sm:rounded-[24px]",
          "bg-[var(--app-card)] text-[var(--app-text)] border border-[var(--app-border)] shadow-[var(--app-shadow-sheet)] sm:shadow-2xl animate-sheet-up",
          className
        )}
      >
        {/* Drag handle for mobile bottom sheet */}
        <div className="flex justify-center pt-3 pb-1 sm:hidden">
          <div className="h-1.5 w-11 rounded-full bg-[#DFD3C5]" />
        </div>
        <div className="flex items-start justify-between gap-3 border-b border-[var(--app-border)] px-5 py-3.5 sm:py-4">
          <div className="min-w-0 pt-0.5">
            <h2 className="text-[17px] font-bold tracking-[-0.015em] leading-snug">
              {title}
            </h2>
            {subtitle && (
              <p className="mt-0.5 text-xs text-[var(--app-hint)] leading-relaxed">
                {subtitle}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Закрити"
            className="flex h-11 w-11 min-h-[44px] min-w-[44px] -mr-1.5 -mt-1 shrink-0 items-center justify-center rounded-full bg-[var(--app-subtle)] text-[var(--app-hint)] hover:bg-[#ece3d7] hover:text-[var(--app-text)] active:scale-[0.95] transition-all cursor-pointer"
          >
            <X className="h-4.5 w-4.5" strokeWidth={2} />
          </button>
        </div>
        <div className="overflow-y-auto px-5 py-4 pb-safe">{children}</div>
      </div>
    </div>
  );
}
