import { notFound } from "next/navigation";
import { RecipeEditor } from "@/components/recipes/RecipeEditor";

export default async function RecipeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const numericId = Number(id);
  if (!Number.isInteger(numericId) || numericId <= 0) {
    notFound();
  }
  return <RecipeEditor recipeId={numericId} />;
}
