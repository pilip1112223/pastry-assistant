import { NextResponse } from "next/server";
import { z } from "zod";
import { createIngredient, listIngredients } from "@/lib/store";

const createIngredientSchema = z.object({
  name: z.string().trim().min(1, "Укажите название продукта").max(200),
  pricePerKg: z.coerce.number().min(0, "Цена не может быть отрицательной"),
  calories100g: z.coerce.number().min(0).optional().default(0),
  protein100g: z.coerce.number().min(0).optional().default(0),
  fat100g: z.coerce.number().min(0).optional().default(0),
  carbs100g: z.coerce.number().min(0).optional().default(0),
});

export async function GET() {
  try {
    const items = await listIngredients();
    return NextResponse.json(items);
  } catch (error) {
    console.error("GET /api/ingredients error:", error);
    return NextResponse.json(
      { error: "Не удалось загрузить ингредиенты" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = createIngredientSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Некорректные данные" },
        { status: 400 }
      );
    }
    const created = await createIngredient(parsed.data);
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    console.error("POST /api/ingredients error:", error);
    return NextResponse.json(
      { error: "Не удалось создать продукт" },
      { status: 500 }
    );
  }
}
