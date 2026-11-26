import { NextResponse } from "next/server";
import { getAdminOverview, requireAdminAccess } from "@/lib/users";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const auth = await requireAdminAccess(request);
    if (!auth.ok) return auth.response;

    const overview = await getAdminOverview();
    return NextResponse.json(overview, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    console.error("GET /api/admin/overview error:", error);
    return NextResponse.json(
      { error: "Не вдалося завантажити дані адмін-панелі" },
      { status: 500 }
    );
  }
}
