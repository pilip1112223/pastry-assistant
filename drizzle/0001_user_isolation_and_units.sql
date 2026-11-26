ALTER TABLE "ingredients" ADD COLUMN IF NOT EXISTS "user_id" text DEFAULT 'legacy' NOT NULL;
ALTER TABLE "ingredients" ADD COLUMN IF NOT EXISTS "unit_type" text DEFAULT 'weight' NOT NULL;
ALTER TABLE "ingredients" ADD COLUMN IF NOT EXISTS "unit_weight_grams" double precision DEFAULT 0 NOT NULL;

ALTER TABLE "recipes" ADD COLUMN IF NOT EXISTS "user_id" text DEFAULT 'legacy' NOT NULL;

ALTER TABLE "procurement_plans" ADD COLUMN IF NOT EXISTS "user_id" text DEFAULT 'legacy' NOT NULL;

CREATE INDEX IF NOT EXISTS "ingredients_user_id_idx" ON "ingredients" USING btree ("user_id");
CREATE INDEX IF NOT EXISTS "recipes_user_id_idx" ON "recipes" USING btree ("user_id");
CREATE INDEX IF NOT EXISTS "procurement_plans_user_id_idx" ON "procurement_plans" USING btree ("user_id");
