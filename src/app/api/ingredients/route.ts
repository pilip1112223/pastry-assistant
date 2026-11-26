import { NextResponse } from "next/server";
import { z } from "zod";
import { requireActiveAccess } from "@/lib/users";
import { createIngredient, listIngredients } from "@/lib/store";

const createIngredientSchema = z.object({
  name: z.string().trim().min(1, "Вкажіть назву продукту").max(200),
  unitType: z.enum(["weight", "volume", "piece"]).optional().default("weight"),
  pricePerKg: z.coerce.number().min(0, "Ціна не може бути від'ємною"),
  unitWeightGrams: z.coerce.number().min(0).optional().default(0),
  calories100g: z.coerce.number().min(0).optional().default(0),
  protein100g: z.coerce.number().min(0).optional().default(0),
  fat100g: z.coerce.number().min(0).optional().default(0),
  carbs100g: z.coerce.number().min(0).optional().default(0),
});

export async function GET(request: Request) {
  try {
    const auth = await requireActiveAccess(request);
    if (!auth.ok) return auth.response;
    const items = await listIngredients(auth.userId);
    return NextResponse.json(items);
  } catch (error) {
    console.error("GET /api/ingredients error:", error);
    return NextResponse.json(
      { error: "Не вдалося завантажити інгредієнти" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireActiveAccess(request);
    if (!auth.ok) return auth.response;
    const body = await request.json();
    const parsed = createIngredientSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Некоректні дані" },
        { status: 400 }
      );
    }
    const created = await createIngredient(auth.userId, parsed.data);
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    console.error("POST /api/ingredients error:", error);
    return NextResponse.json(
      { error: "Не вдалося створити продукт" },
      { status: 500 }
    );
  }
}
