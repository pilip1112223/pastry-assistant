import { NextResponse } from "next/server";
import { resolveRequestUserId } from "@/lib/auth";
import { ensureUserRecord } from "@/lib/users";
import {
  SUBSCRIPTION_DURATION_DAYS,
  SUBSCRIPTION_STARS_PRICE,
} from "@/types/pastry";

export async function POST(request: Request) {
  try {
    const auth = resolveRequestUserId(request);
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const botToken = process.env.TELEGRAM_BOT_TOKEN?.trim();
    if (!botToken) {
      return NextResponse.json(
        {
          error:
            "Оплата тимчасово недоступна: не налаштовано TELEGRAM_BOT_TOKEN на сервері.",
        },
        { status: 503 }
      );
    }

    await ensureUserRecord({
      telegramId: auth.telegramId,
      username: auth.username,
      firstName: auth.firstName,
    });

    const payload = JSON.stringify({
      telegramId: auth.telegramId,
      days: SUBSCRIPTION_DURATION_DAYS,
    });

    const tgRes = await fetch(
      `https://api.telegram.org/bot${botToken}/createInvoiceLink`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "Підписка «Асистент кондитера»",
          description:
            "Повний доступ до техкарт, складу, перерахунку форм, КБЖВ та планування закупівель на 30 днів.",
          payload,
          provider_token: "",
          currency: "XTR",
          prices: [
            {
              label: `Підписка на ${SUBSCRIPTION_DURATION_DAYS} днів`,
              amount: SUBSCRIPTION_STARS_PRICE,
            },
          ],
        }),
      }
    );

    const tgData = (await tgRes.json()) as {
      ok?: boolean;
      result?: string;
      description?: string;
    };

    if (!tgRes.ok || !tgData.ok || !tgData.result) {
      console.error("Telegram createInvoiceLink error:", tgData);
      return NextResponse.json(
        {
          error:
            tgData.description ||
            "Не вдалося створити рахунок у Telegram Stars",
        },
        { status: 502 }
      );
    }

    return NextResponse.json({ invoiceUrl: tgData.result });
  } catch (error) {
    console.error("POST /api/payments/create-invoice error:", error);
    return NextResponse.json(
      { error: "Помилка створення платежу" },
      { status: 500 }
    );
  }
}
