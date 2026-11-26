import { NextResponse } from "next/server";
import { resolveRequestUserId } from "@/lib/auth";
import { ensureUserAndGetAccess } from "@/lib/users";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const auth = resolveRequestUserId(request);
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const access = await ensureUserAndGetAccess({
      telegramId: auth.telegramId,
      username: auth.username,
      firstName: auth.firstName,
    });

    return NextResponse.json(access, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    console.error("GET /api/user/access error:", error);
    return NextResponse.json(
      { error: "Не вдалося перевірити статус доступу" },
      { status: 500 }
    );
  }
}
