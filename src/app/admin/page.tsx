"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  Ban,
  CalendarPlus,
  CheckCircle2,
  Crown,
  Infinity as InfinityIcon,
  RefreshCw,
  Search,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Users,
  Webhook,
  X,
} from "lucide-react";
import type {
  AccessStatus,
  AdminUserView,
  PaymentRecord,
} from "@/types/pastry";
import { apiFetch } from "@/lib/api-client";
import { hapticImpact, hapticNotification } from "@/lib/telegram";
import { useApp } from "@/components/providers/AppProvider";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

function formatDateTimeUk(iso?: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("uk-UA", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "—";
  }
}

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

const STATUS_BADGE: Record<
  AccessStatus,
  { label: string; className: string }
> = {
  admin: {
    label: "Адмін",
    className: "bg-[var(--app-accent-soft)] text-[var(--app-accent)]",
  },
  unlimited: {
    label: "Назавжди",
    className: "bg-[var(--app-success-soft)] text-[var(--app-success)]",
  },
  active: {
    label: "Активна",
    className: "bg-[var(--app-success-soft)] text-[var(--app-success)]",
  },
  trial: {
    label: "Тріал",
    className: "bg-[var(--app-warning-soft)] text-[var(--app-warning)]",
  },
  expired: {
    label: "Закінчилась",
    className: "bg-[var(--app-danger-soft)] text-[var(--app-danger)]",
  },
};

export default function AdminPage() {
  const { access, accessLoading, showToast } = useApp();

  const [users, setUsers] = useState<AdminUserView[]>([]);
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [busyUserId, setBusyUserId] = useState<string | null>(null);

  const [webhookLoading, setWebhookLoading] = useState(false);
  const [webhookStatus, setWebhookStatus] = useState<{
    ok: boolean;
    message: string;
    url?: string;
  } | null>(null);

  const loadOverview = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch("/api/admin/overview", { cache: "no-store" });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Помилка завантаження");
      }
      const data = (await res.json()) as {
        users: AdminUserView[];
        payments: PaymentRecord[];
      };
      setUsers(data.users ?? []);
      setPayments(data.payments ?? []);
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : "Не вдалося завантажити адмінку",
        "error"
      );
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    if (!accessLoading && access?.isAdmin) {
      loadOverview();
    } else if (!accessLoading) {
      setLoading(false);
    }
  }, [accessLoading, access?.isAdmin, loadOverview]);

  async function handleSetWebhook() {
    hapticImpact("medium");
    setWebhookLoading(true);
    setWebhookStatus(null);
    try {
      const res = await apiFetch("/api/admin/set-webhook", {
        method: "POST",
      });
      const data = (await res.json()) as {
        ok?: boolean;
        webhookUrl?: string;
        description?: string;
        error?: string;
      };
      if (!res.ok || !data.ok) {
        const msg = data.error || "Не вдалося активувати Webhook";
        setWebhookStatus({ ok: false, message: msg, url: data.webhookUrl });
        hapticNotification("error");
        showToast(msg, "error");
        return;
      }
      setWebhookStatus({
        ok: true,
        message: data.description || "Telegram Webhook успішно активовано!",
        url: data.webhookUrl,
      });
      hapticNotification("success");
      showToast("Telegram Webhook активовано!", "success");
    } catch {
      const msg = "Мережева помилка при активації Webhook";
      setWebhookStatus({ ok: false, message: msg });
      hapticNotification("error");
      showToast(msg, "error");
    } finally {
      setWebhookLoading(false);
    }
  }

  async function handleUserAction(
    telegramId: string,
    action: "add_30" | "add_90" | "unlimited" | "revoke"
  ) {
    hapticImpact("light");
    if (
      action === "revoke" &&
      !window.confirm(`Забрати доступ у користувача ID ${telegramId}?`)
    ) {
      return;
    }

    setBusyUserId(telegramId);
    try {
      const res = await apiFetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ telegramId, action }),
      });
      const data = (await res.json()) as {
        user?: AdminUserView;
        error?: string;
      };
      if (!res.ok || !data.user) {
        throw new Error(data.error || "Помилка оновлення");
      }

      setUsers((prev) =>
        prev.map((u) => (u.telegramId === telegramId ? data.user! : u))
      );
      hapticNotification("success");

      const messages: Record<typeof action, string> = {
        add_30: "Додано +30 днів доступу",
        add_90: "Додано +90 днів доступу",
        unlimited: "Надано безстроковий доступ",
        revoke: "Доступ користувача скасовано",
      };
      showToast(messages[action], "success");
    } catch (err) {
      hapticNotification("error");
      showToast(
        err instanceof Error ? err.message : "Не вдалося оновити доступ",
        "error"
      );
    } finally {
      setBusyUserId(null);
    }
  }

  const filteredUsers = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return users;
    return users.filter(
      (u) =>
        u.telegramId.toLowerCase().includes(q) ||
        (u.username ?? "").toLowerCase().includes(q) ||
        (u.firstName ?? "").toLowerCase().includes(q)
    );
  }, [users, search]);

  const stats = useMemo(() => {
    const activeCount = users.filter((u) => u.hasAccess).length;
    const totalStars = payments.reduce((sum, p) => sum + p.amountStars, 0);
    return {
      totalUsers: users.length,
      activeCount,
      totalStars,
    };
  }, [users, payments]);

  if (accessLoading) {
    return (
      <div className="space-y-4">
        <div className="h-12 w-48 rounded-2xl skeleton-shimmer" />
        <div className="h-32 rounded-[20px] skeleton-shimmer" />
        <div className="h-64 rounded-[20px] skeleton-shimmer" />
      </div>
    );
  }

  if (!access?.isAdmin) {
    return (
      <Card className="p-8 sm:p-10 text-center space-y-4">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-[22px] bg-[var(--app-danger-soft)] text-[var(--app-danger)]">
          <ShieldAlert className="h-8 w-8" strokeWidth={1.8} />
        </div>
        <h1 className="text-lg font-extrabold">Доступ заборонено</h1>
        <p className="mx-auto max-w-xs text-xs text-[var(--app-hint)] leading-relaxed">
          Цей розділ доступний лише адміністраторам застосунку.
        </p>
        <Link href="/" className="inline-block pt-1">
          <Button variant="outline">Повернутися на головну</Button>
        </Link>
      </Card>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-[22px] sm:text-2xl font-extrabold tracking-[-0.025em]">
            <ShieldCheck
              className="h-6 w-6 text-[var(--app-accent)]"
              strokeWidth={2.1}
            />
            <span>Адмінка</span>
          </h1>
          <p className="mt-0.5 text-xs font-medium text-[var(--app-hint)]">
            Керування підписками, оплатами Stars та Telegram Webhook
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={loadOverview}
          disabled={loading}
          aria-label="Оновити"
        >
          <RefreshCw
            className={`h-4 w-4 ${loading ? "animate-spin" : ""}`}
            strokeWidth={2}
          />
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-3 gap-2.5">
        <Card className="p-3.5">
          <div className="text-[10.5px] font-bold uppercase tracking-[0.04em] text-[var(--app-hint)]">
            Користувачів
          </div>
          <div className="mt-1 text-xl font-extrabold tabular-nums">
            {stats.totalUsers}
          </div>
        </Card>
        <Card className="p-3.5">
          <div className="text-[10.5px] font-bold uppercase tracking-[0.04em] text-[var(--app-success)]">
            З доступом
          </div>
          <div className="mt-1 text-xl font-extrabold tabular-nums text-[var(--app-success)]">
            {stats.activeCount}
          </div>
        </Card>
        <Card className="p-3.5">
          <div className="text-[10.5px] font-bold uppercase tracking-[0.04em] text-[var(--app-accent)]">
            Оплачено ⭐
          </div>
          <div className="mt-1 text-xl font-extrabold tabular-nums text-[var(--app-accent)]">
            {stats.totalStars}
          </div>
        </Card>
      </div>

      {/* Telegram Webhook Activation Card */}
      <Card className="p-4.5 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-0.5">
            <div className="flex items-center gap-2 text-sm font-extrabold">
              <Webhook
                className="h-4.5 w-4.5 text-[var(--app-accent)]"
                strokeWidth={2}
              />
              <span>Telegram Stars Webhook</span>
            </div>
            <p className="text-xs text-[var(--app-hint)] leading-relaxed">
              Реєструє поточний HTTPS-домен у Telegram Bot API для миттєвого
              підтвердження оплат у Stars.
            </p>
          </div>
          <Button
            type="button"
            onClick={handleSetWebhook}
            disabled={webhookLoading}
            className="shrink-0"
          >
            <Webhook className="h-4 w-4" strokeWidth={2} />
            <span>
              {webhookLoading
                ? "Активація..."
                : "Активувати Telegram Webhook"}
            </span>
          </Button>
        </div>

        {webhookStatus && (
          <div
            className={`flex items-start gap-2.5 rounded-[14px] border px-3.5 py-3 text-xs leading-relaxed ${
              webhookStatus.ok
                ? "border-[var(--app-success)]/25 bg-[var(--app-success-soft)] text-[var(--app-success)]"
                : "border-[var(--app-danger)]/25 bg-[var(--app-danger-soft)] text-[var(--app-danger)]"
            }`}
          >
            {webhookStatus.ok ? (
              <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
            ) : (
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            )}
            <div className="min-w-0">
              <div className="font-bold">{webhookStatus.message}</div>
              {webhookStatus.url && (
                <div className="mt-0.5 font-mono text-[11px] break-all opacity-90">
                  {webhookStatus.url}
                </div>
              )}
            </div>
          </div>
        )}
      </Card>

      {/* Users Management Section */}
      <Card className="p-4.5 space-y-4">
        <div className="flex items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 text-[15px] font-extrabold">
            <Users
              className="h-4.5 w-4.5 text-[var(--app-accent)]"
              strokeWidth={2}
            />
            <span>Користувачі ({filteredUsers.length})</span>
          </h2>
        </div>

        <div className="relative">
          <Search
            className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--app-hint)]"
            strokeWidth={1.9}
          />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Пошук за ID, @username або ім'ям..."
            className="pl-10 pr-11"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
              aria-label="Очистити пошук"
              className="absolute right-1.5 top-1/2 -translate-y-1/2 flex h-9 w-9 items-center justify-center rounded-xl text-[var(--app-hint)] hover:bg-[var(--app-subtle)] cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {loading ? (
          <div className="space-y-2.5">
            {[1, 2, 3].map((n) => (
              <div key={n} className="h-28 rounded-[16px] skeleton-shimmer" />
            ))}
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="py-6 text-center text-xs font-medium text-[var(--app-hint)]">
            Користувачів не знайдено
          </div>
        ) : (
          <div className="space-y-3">
            {filteredUsers.map((u) => {
              const badge = STATUS_BADGE[u.status];
              const isBusy = busyUserId === u.telegramId;
              const endDateText =
                u.status === "admin" || u.status === "unlimited"
                  ? "Безстроково"
                  : u.status === "active"
                  ? `Підписка до ${formatDateUk(u.subscriptionEndsAt)}`
                  : u.status === "trial"
                  ? `Тріал до ${formatDateUk(u.trialEndsAt)}`
                  : `Завершився ${formatDateUk(
                      u.subscriptionEndsAt || u.trialEndsAt
                    )}`;

              return (
                <div
                  key={u.telegramId}
                  className="rounded-[16px] border border-[var(--app-border)] bg-[var(--app-bg)]/60 p-3.5 space-y-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-[14.5px] font-extrabold truncate">
                          {u.firstName || "Без імені"}
                        </span>
                        {u.username && (
                          <span className="text-xs font-semibold text-[var(--app-accent)]">
                            @{u.username}
                          </span>
                        )}
                      </div>
                      <div className="mt-0.5 flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-[11.5px] text-[var(--app-hint)] tabular-nums">
                        <span className="font-mono">ID: {u.telegramId}</span>
                        <span>· {endDateText}</span>
                      </div>
                    </div>

                    <span
                      className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-extrabold ${badge.className}`}
                    >
                      {badge.label}
                    </span>
                  </div>

                  {/* Quick Admin Actions */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={isBusy}
                      onClick={() => handleUserAction(u.telegramId, "add_30")}
                      className="text-xs px-2.5"
                    >
                      <CalendarPlus className="h-3.5 w-3.5 text-[var(--app-accent)]" />
                      <span>+30 днів</span>
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={isBusy}
                      onClick={() => handleUserAction(u.telegramId, "add_90")}
                      className="text-xs px-2.5"
                    >
                      <CalendarPlus className="h-3.5 w-3.5 text-[var(--app-accent)]" />
                      <span>+90 днів</span>
                    </Button>
                    <Button
                      type="button"
                      variant="success"
                      size="sm"
                      disabled={isBusy || u.isUnlimited}
                      onClick={() =>
                        handleUserAction(u.telegramId, "unlimited")
                      }
                      className="text-xs px-2.5"
                    >
                      <InfinityIcon className="h-3.5 w-3.5" />
                      <span>Назавжди</span>
                    </Button>
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      disabled={isBusy || u.isAdmin}
                      onClick={() => handleUserAction(u.telegramId, "revoke")}
                      className="text-xs px-2.5"
                    >
                      <Ban className="h-3.5 w-3.5" />
                      <span>Забрати доступ</span>
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* Recent Stars Payments */}
      <Card className="p-4.5 space-y-3.5">
        <h2 className="flex items-center gap-2 text-[15px] font-extrabold">
          <Sparkles
            className="h-4.5 w-4.5 text-[var(--app-accent)]"
            strokeWidth={2}
          />
          <span>Останні оплати в Stars</span>
        </h2>

        {payments.length === 0 ? (
          <div className="rounded-[14px] bg-[var(--app-bg)] border border-[var(--app-border)] p-5 text-center text-xs font-medium text-[var(--app-hint)]">
            Поки немає зафіксованих оплат у Telegram Stars
          </div>
        ) : (
          <div className="divide-y divide-[var(--app-border)] rounded-[16px] border border-[var(--app-border)] overflow-hidden">
            {payments.map((p) => (
              <div
                key={p.id}
                className="flex items-center justify-between gap-3 px-4 py-3 bg-[var(--app-card)]"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 text-sm font-bold truncate">
                    <Crown className="h-3.5 w-3.5 shrink-0 text-[var(--app-warning)]" />
                    <span className="truncate">
                      {p.firstName || p.username || `ID ${p.telegramId}`}
                    </span>
                    {p.username && (
                      <span className="text-xs font-medium text-[var(--app-hint)]">
                        @{p.username}
                      </span>
                    )}
                  </div>
                  <div className="mt-0.5 text-[11px] text-[var(--app-hint)] tabular-nums">
                    ID: {p.telegramId} · {formatDateTimeUk(p.createdAt)} · +
                    {p.daysAdded} дн.
                  </div>
                </div>
                <span className="shrink-0 rounded-full bg-[var(--app-accent-soft)] px-3 py-1 text-xs font-extrabold tabular-nums text-[var(--app-accent)]">
                  {p.amountStars} ⭐
                </span>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
