"use client";

import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[14px] text-sm font-semibold tracking-[-0.01em] transition-all duration-150 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-45 cursor-pointer select-none focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-[var(--app-accent-ring)]",
  {
    variants: {
      variant: {
        default:
          "bg-[var(--app-accent)] text-[var(--app-accent-text)] shadow-[0_2px_10px_rgba(200,90,50,0.24)] hover:bg-[var(--app-accent-hover)] hover:shadow-[0_4px_14px_rgba(200,90,50,0.28)]",
        secondary:
          "bg-[var(--app-subtle)] text-[var(--app-text)] border border-[var(--app-border)] hover:bg-[#eee5d9] hover:border-[var(--app-border-strong)]",
        outline:
          "border border-[var(--app-border)] bg-[var(--app-card)] text-[var(--app-text)] shadow-[0_1px_2px_rgba(42,30,23,0.03)] hover:bg-[var(--app-subtle)] hover:border-[var(--app-border-strong)]",
        ghost:
          "text-[var(--app-text)] hover:bg-[var(--app-subtle)]",
        destructive:
          "bg-[var(--app-danger-soft)] text-[var(--app-danger)] border border-[#f5d5d0] hover:bg-[#fae2de]",
        success:
          "bg-[var(--app-success-soft)] text-[var(--app-success)] border border-[#cde6d7] hover:bg-[#ddf0e4]",
      },
      size: {
        default: "h-11 min-h-[44px] px-4.5 py-2",
        sm: "h-11 min-h-[44px] rounded-[12px] px-3.5 text-[13px]",
        lg: "h-12 min-h-[48px] rounded-[16px] px-6 text-[15px]",
        icon: "h-11 w-11 min-h-[44px] min-w-[44px] rounded-[13px]",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(buttonVariants({ variant, size, className }))}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";
