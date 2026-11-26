import { NextResponse } from "next/server";
import { z } from "zod";
import { resolveRequestUserId } from "@/lib/auth";
import { createRecipe, listRecipes } from "@/lib/store";

const recipeSchema = z.object({
  name: z.string().trim().min(1, "Вкажіть назву торта").max(200),
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

export async function GET(request: Request) {
  try {
    const auth = resolveRequestUserId(request);
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }
    const items = await listRecipes(auth.userId);
    return NextResponse.json(items);
  } catch (error) {
    console.error("GET /api/recipes error:", error);
    return NextResponse.json(
      { error: "Не вдалося завантажити рецепти" },
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
    const parsed = recipeSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Некоректні дані" },
        { status: 400 }
      );
    }
    const created = await createRecipe(auth.userId, parsed.data);
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    console.error("POST /api/recipes error:", error);
    return NextResponse.json(
      { error: "Не вдалося створити рецепт" },
      { status: 500 }
    );
  }
}
