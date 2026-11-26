import { NextResponse } from "next/server";
import { z } from "zod";
import { resolveRequestUserId } from "@/lib/auth";
import { createProcurementPlan, listProcurementPlans } from "@/lib/store";

const planItemSchema = z.object({
  recipe_id: z.coerce.number().int().positive(),
  diameter: z.coerce.number().int().min(4).max(100),
  quantity: z.coerce.number().int().min(1).max(1000),
});

const createPlanSchema = z.object({
  name: z.string().trim().min(1).max(200).default("Нова закупівля"),
  itemsJson: z.array(planItemSchema).default([]),
});

export async function GET(request: Request) {
  try {
    const auth = resolveRequestUserId(request);
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }
    const plans = await listProcurementPlans(auth.userId);
    return NextResponse.json(plans);
  } catch (error) {
    console.error("GET /api/procurement error:", error);
    return NextResponse.json(
      { error: "Не вдалося завантажити плани закупівель" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const auth = resolveRequestUserId(request);
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }
    const body = await request.json();
    const parsed = createPlanSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Некоректні дані" },
        { status: 400 }
      );
    }
    const created = await createProcurementPlan(auth.userId, parsed.data);
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    console.error("POST /api/procurement error:", error);
    return NextResponse.json(
      { error: "Не вдалося створити закупівлю" },
      { status: 500 }
    );
  }
}
