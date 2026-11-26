import { NextResponse } from "next/server";
import { z } from "zod";
import { adminUpdateUserAccess, requireAdminAccess } from "@/lib/users";

const updateUserSchema = z.object({
  telegramId: z.string().trim().min(1, "Вкажіть ID користувача"),
  action: z.enum(["add_30", "add_90", "unlimited", "revoke"]),
});

export async function POST(request: Request) {
  try {
    const auth = await requireAdminAccess(request);
    if (!auth.ok) return auth.response;

    const body = await request.json();
    const parsed = updateUserSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Некоректні дані" },
        { status: 400 }
      );
    }

    const updated = await adminUpdateUserAccess(
      parsed.data.telegramId,
      parsed.data.action
    );
    if (!updated) {
      return NextResponse.json(
        { error: "Користувача не знайдено" },
        { status: 404 }
      );
    }

    return NextResponse.json({ user: updated });
  } catch (error) {
    console.error("POST /api/admin/users error:", error);
    return NextResponse.json(
      { error: "Не вдалося оновити доступ користувача" },
      { status: 500 }
    );
  }
}
