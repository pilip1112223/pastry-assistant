"use client";

import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-semibold transition-all active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50 cursor-pointer select-none",
  {
    variants: {
      variant: {
        default:
          "bg-[var(--app-accent)] text-[var(--app-accent-text)] shadow-xs hover:brightness-95",
        secondary:
          "bg-[var(--app-subtle)] text-[var(--app-text)] hover:brightness-95",
        outline:
          "border border-[var(--app-border)] bg-[var(--app-card)] text-[var(--app-text)] hover:bg-[var(--app-subtle)]",
        ghost: "text-[var(--app-text)] hover:bg-[var(--app-subtle)]",
        destructive:
          "bg-[var(--app-danger-soft)] text-[var(--app-danger)] hover:brightness-95",
        success:
          "bg-[var(--app-success-soft)] text-[var(--app-success)] hover:brightness-95",
      },
      size: {
        default: "h-11 px-4 py-2",
        sm: "h-9 rounded-lg px-3 text-xs",
        lg: "h-12 rounded-2xl px-6 text-base",
        icon: "h-10 w-10 rounded-xl",
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
