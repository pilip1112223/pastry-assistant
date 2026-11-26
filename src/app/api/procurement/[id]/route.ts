import { NextResponse } from "next/server";
import { z } from "zod";
import { deleteProcurementPlan, updateProcurementPlan } from "@/lib/store";

const planItemSchema = z.object({
  recipe_id: z.coerce.number().int().positive(),
  diameter: z.coerce.number().int().min(4).max(100),
  quantity: z.coerce.number().int().min(1).max(1000),
});

const updatePlanSchema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  itemsJson: z.array(planItemSchema).optional(),
});

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const numericId = Number(id);
    if (!Number.isInteger(numericId) || numericId <= 0) {
      return NextResponse.json({ error: "Неверный ID" }, { status: 400 });
    }
    const body = await request.json();
    const parsed = updatePlanSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Некорректные данные" },
        { status: 400 }
      );
    }
    const updated = await updateProcurementPlan(numericId, parsed.data);
    if (!updated) {
      return NextResponse.json({ error: "План закупки не найден" }, { status: 404 });
    }
    return NextResponse.json(updated);
  } catch (error) {
    console.error("PATCH /api/procurement/[id] error:", error);
    return NextResponse.json(
      { error: "Не удалось обновить план закупки" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const numericId = Number(id);
    if (!Number.isInteger(numericId) || numericId <= 0) {
      return NextResponse.json({ error: "Неверный ID" }, { status: 400 });
    }
    const deleted = await deleteProcurementPlan(numericId);
    if (!deleted) {
      return NextResponse.json({ error: "План закупки не найден" }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("DELETE /api/procurement/[id] error:", error);
    return NextResponse.json(
      { error: "Не удалось удалить план закупки" },
      { status: 500 }
    );
  }
}
