import { NextResponse } from "next/server";
import { z } from "zod";
import { deleteRecipe, getRecipeById, updateRecipe } from "@/lib/store";

const recipeSchema = z.object({
  name: z.string().trim().min(1, "Укажите название торта").max(200),
  baseDiameter: z.coerce.number().int().min(4).max(100).default(16),
  baseHeight: z.coerce.number().int().min(1).max(60).default(10),
  defaultMarkupPercent: z.coerce.number().min(0).max(10000).default(100),
  portionsCount: z.coerce.number().int().min(1).max(500).default(8),
  finishedWeightGrams: z.coerce.number().int().min(0).max(100000).default(0),
  components: z
    .array(
      z.object({
        name: z.string().trim().min(1).max(200),
        sortOrder: z.coerce.number().int().default(0),
        ingredients: z
          .array(
            z.object({
              ingredientId: z.coerce.number().int().positive(),
              baseGrams: z.coerce.number().min(0),
            })
          )
          .default([]),
      })
    )
    .default([]),
});

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const numericId = Number(id);
    if (!Number.isInteger(numericId) || numericId <= 0) {
      return NextResponse.json({ error: "Неверный ID" }, { status: 400 });
    }
    const recipe = await getRecipeById(numericId);
    if (!recipe) {
      return NextResponse.json({ error: "Рецепт не найден" }, { status: 404 });
    }
    return NextResponse.json(recipe);
  } catch (error) {
    console.error("GET /api/recipes/[id] error:", error);
    return NextResponse.json(
      { error: "Не удалось загрузить рецепт" },
      { status: 500 }
    );
  }
}

export async function PUT(
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
    const parsed = recipeSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Некорректные данные" },
        { status: 400 }
      );
    }
    const updated = await updateRecipe(numericId, parsed.data);
    if (!updated) {
      return NextResponse.json({ error: "Рецепт не найден" }, { status: 404 });
    }
    return NextResponse.json(updated);
  } catch (error) {
    console.error("PUT /api/recipes/[id] error:", error);
    return NextResponse.json(
      { error: "Не удалось сохранить рецепт" },
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
    const deleted = await deleteRecipe(numericId);
    if (!deleted) {
      return NextResponse.json({ error: "Рецепт не найден" }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("DELETE /api/recipes/[id] error:", error);
    return NextResponse.json(
      { error: "Не удалось удалить рецепт" },
      { status: 500 }
    );
  }
}
