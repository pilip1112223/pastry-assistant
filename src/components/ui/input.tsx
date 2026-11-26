import * as React from "react";
import { cn } from "@/lib/utils";

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  suffix?: string;
  error?: boolean | string;
  wrapperClassName?: string;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  (
    { className, type, suffix, error, wrapperClassName, ...props },
    ref
  ) => {
    const hasError = Boolean(error);
    const errorMessage = typeof error === "string" ? error : undefined;

    const inputEl = (
      <input
        ref={ref}
        type={type}
        aria-invalid={hasError || undefined}
        className={cn(
          "app-input flex h-11 min-h-[44px] w-full rounded-[14px] px-3.5 py-2 text-[14px] font-medium placeholder:font-normal placeholder:text-[var(--app-hint)]/80 disabled:cursor-not-allowed disabled:opacity-50",
          suffix && (suffix.length > 3 ? "pr-14" : "pr-11"),
          className
        )}
        {...props}
      />
    );

    if (!suffix && !errorMessage) {
      return inputEl;
    }

    return (
      <div className={cn("w-full", wrapperClassName)}>
        <div className="relative flex items-center">
          {inputEl}
          {suffix && (
            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 select-none rounded-md bg-[var(--app-subtle)] px-1.5 py-0.5 text-[11px] font-semibold text-[var(--app-hint)]">
              {suffix}
            </span>
          )}
        </div>
        {errorMessage && (
          <p className="mt-1.5 text-xs font-medium text-[var(--app-danger)]">
            {errorMessage}
          </p>
        )}
      </div>
    );
  }
);
Input.displayName = "Input";
