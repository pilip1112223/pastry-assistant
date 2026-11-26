import { NextResponse } from "next/server";
import { requireAdminAccess } from "@/lib/users";

export async function POST(request: Request) {
  try {
    const auth = await requireAdminAccess(request);
    if (!auth.ok) return auth.response;

    const botToken = process.env.TELEGRAM_BOT_TOKEN?.trim();
    if (!botToken) {
      return NextResponse.json(
        { error: "Змінна середовища TELEGRAM_BOT_TOKEN не задана на сервері." },
        { status: 400 }
      );
    }

    const host =
      request.headers.get("x-forwarded-host")?.split(",")[0]?.trim() ||
      request.headers.get("host")?.trim();

    if (!host) {
      return NextResponse.json(
        { error: "Не вдалося визначити домен сервера." },
        { status: 400 }
      );
    }

    const webhookUrl = `https://${host}/api/telegram/webhook`;

    const tgRes = await fetch(
      `https://api.telegram.org/bot${botToken}/setWebhook`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: webhookUrl,
          allowed_updates: ["pre_checkout_query", "message"],
        }),
      }
    );

    const tgData = (await tgRes.json()) as {
      ok?: boolean;
      description?: string;
    };

    if (!tgRes.ok || !tgData.ok) {
      return NextResponse.json(
        {
          error:
            tgData.description ||
            "Telegram відхилив реєстрацію Webhook. Перевірте токен і HTTPS-домен.",
          webhookUrl,
        },
        { status: 502 }
      );
    }

    return NextResponse.json({
      ok: true,
      webhookUrl,
      description: tgData.description || "Webhook успішно активовано",
    });
  } catch (error) {
    console.error("POST /api/admin/set-webhook error:", error);
    return NextResponse.json(
      { error: "Помилка активації Telegram Webhook" },
      { status: 500 }
    );
  }
}
