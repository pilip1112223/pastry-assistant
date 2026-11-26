import { NextResponse } from "next/server";
import { z } from "zod";
import { deleteIngredient, updateIngredient } from "@/lib/store";

const updateIngredientSchema = z.object({
  name: z.string().trim().min(1, "Вкажіть назву продукту").max(200).optional(),
  pricePerKg: z.coerce.number().min(0).optional(),
  calories100g: z.coerce.number().min(0).optional(),
  protein100g: z.coerce.number().min(0).optional(),
  fat100g: z.coerce.number().min(0).optional(),
  carbs100g: z.coerce.number().min(0).optional(),
});

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const numericId = Number(id);
    if (!Number.isInteger(numericId) || numericId <= 0) {
      return NextResponse.json({ error: "Невірний ID" }, { status: 400 });
    }
    const body = await request.json();
    const parsed = updateIngredientSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Некоректні дані" },
        { status: 400 }
      );
    }
    const updated = await updateIngredient(numericId, parsed.data);
    if (!updated) {
      return NextResponse.json({ error: "Продукт не знайдено" }, { status: 404 });
    }
    return NextResponse.json(updated);
  } catch (error) {
    console.error("PATCH /api/ingredients/[id] error:", error);
    return NextResponse.json(
      { error: "Не вдалося оновити продукт" },
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
      return NextResponse.json({ error: "Невірний ID" }, { status: 400 });
    }
    const deleted = await deleteIngredient(numericId);
    if (!deleted) {
      return NextResponse.json({ error: "Продукт не знайдено" }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("DELETE /api/ingredients/[id] error:", error);
    return NextResponse.json(
      { error: "Не вдалося видалити продукт" },
      { status: 500 }
    );
  }
}
