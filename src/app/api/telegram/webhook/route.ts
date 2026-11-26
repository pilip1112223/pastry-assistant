import { NextResponse } from "next/server";
import { recordStarsPaymentAndExtendSubscription } from "@/lib/users";
import {
  SUBSCRIPTION_DURATION_DAYS,
  SUBSCRIPTION_STARS_PRICE,
} from "@/types/pastry";

interface TelegramUpdate {
  pre_checkout_query?: {
    id: string;
    from?: {
      id: number;
      username?: string;
      first_name?: string;
    };
    currency?: string;
    total_amount?: number;
    invoice_payload?: string;
  };
  message?: {
    from?: {
      id: number;
      username?: string;
      first_name?: string;
    };
    successful_payment?: {
      currency?: string;
      total_amount?: number;
      invoice_payload?: string;
      telegram_payment_charge_id?: string;
    };
  };
}

export async function POST(request: Request) {
  try {
    const botToken = process.env.TELEGRAM_BOT_TOKEN?.trim();
    if (!botToken) {
      console.error("Telegram webhook called without TELEGRAM_BOT_TOKEN");
      return NextResponse.json({ ok: true });
    }

    const update = (await request.json()) as TelegramUpdate;

    // 1. Immediately approve pre_checkout_query so Telegram completes the Stars payment
    if (update.pre_checkout_query?.id) {
      const answerRes = await fetch(
        `https://api.telegram.org/bot${botToken}/answerPreCheckoutQuery`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            pre_checkout_query_id: update.pre_checkout_query.id,
            ok: true,
          }),
        }
      );
      if (!answerRes.ok) {
        const errText = await answerRes.text().catch(() => "");
        console.error("answerPreCheckoutQuery failed:", errText);
      }
      return NextResponse.json({ ok: true });
    }

    // 2. Process successful_payment idempotently
    const sp = update.message?.successful_payment;
    if (sp && sp.telegram_payment_charge_id) {
      let telegramId = update.message?.from?.id
        ? String(update.message.from.id)
        : "";
      let daysAdded = SUBSCRIPTION_DURATION_DAYS;

      if (sp.invoice_payload) {
        try {
          const parsed = JSON.parse(sp.invoice_payload) as {
            telegramId?: string | number;
            days?: number;
          };
          if (parsed.telegramId !== undefined && parsed.telegramId !== null) {
            telegramId = String(parsed.telegramId);
          }
          if (
            typeof parsed.days === "number" &&
            Number.isFinite(parsed.days) &&
            parsed.days > 0
          ) {
            daysAdded = Math.round(parsed.days);
          }
        } catch {
          // Fallback to message.from.id and default 30 days
        }
      }

      if (telegramId) {
        await recordStarsPaymentAndExtendSubscription({
          telegramId,
          amountStars: Number(sp.total_amount) || SUBSCRIPTION_STARS_PRICE,
          daysAdded,
          telegramPaymentChargeId: sp.telegram_payment_charge_id,
          username: update.message?.from?.username ?? null,
          firstName: update.message?.from?.first_name ?? null,
        });
      }
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("POST /api/telegram/webhook error:", error);
    // Return 200 to avoid infinite Telegram retry storms on malformed payloads
    return NextResponse.json({ ok: true });
  }
}
