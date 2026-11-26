CREATE TABLE IF NOT EXISTS "ingredients" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"price_per_kg" double precision DEFAULT 0 NOT NULL,
	"calories_100g" double precision DEFAULT 0 NOT NULL,
	"protein_100g" double precision DEFAULT 0 NOT NULL,
	"fat_100g" double precision DEFAULT 0 NOT NULL,
	"carbs_100g" double precision DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "recipes" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"base_diameter" integer DEFAULT 16 NOT NULL,
	"base_height" integer DEFAULT 10 NOT NULL,
	"default_markup_percent" double precision DEFAULT 100 NOT NULL,
	"portions_count" integer DEFAULT 8 NOT NULL,
	"finished_weight_grams" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "recipe_components" (
	"id" serial PRIMARY KEY NOT NULL,
	"recipe_id" integer NOT NULL,
	"name" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL
);

CREATE TABLE IF NOT EXISTS "component_ingredients" (
	"id" serial PRIMARY KEY NOT NULL,
	"component_id" integer NOT NULL,
	"ingredient_id" integer NOT NULL,
	"base_grams" double precision DEFAULT 0 NOT NULL
);

CREATE TABLE IF NOT EXISTS "procurement_plans" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"items_json" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

DO $$ BEGIN
 ALTER TABLE "recipe_components" ADD CONSTRAINT "recipe_components_recipe_id_recipes_id_fk" FOREIGN KEY ("recipe_id") REFERENCES "public"."recipes"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "component_ingredients" ADD CONSTRAINT "component_ingredients_component_id_recipe_components_id_fk" FOREIGN KEY ("component_id") REFERENCES "public"."recipe_components"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "component_ingredients" ADD CONSTRAINT "component_ingredients_ingredient_id_ingredients_id_fk" FOREIGN KEY ("ingredient_id") REFERENCES "public"."ingredients"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
