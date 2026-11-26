import {
  pgTable,
  serial,
  text,
  integer,
  doublePrecision,
  timestamp,
  jsonb,
  boolean,
  index,
} from "drizzle-orm/pg-core";
import type { IngredientUnitType, ProcurementPlanItem } from "@/types/pastry";

export const users = pgTable(
  "users",
  {
    id: serial("id").primaryKey(),
    telegramId: text("telegram_id").notNull().unique(),
    username: text("username"),
    firstName: text("first_name"),
    trialEndsAt: timestamp("trial_ends_at", { withTimezone: true }).notNull(),
    subscriptionEndsAt: timestamp("subscription_ends_at", {
      withTimezone: true,
    }),
    isUnlimited: boolean("is_unlimited").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("users_telegram_id_idx").on(table.telegramId)]
);

export const payments = pgTable(
  "payments",
  {
    id: serial("id").primaryKey(),
    telegramId: text("telegram_id").notNull(),
    amountStars: integer("amount_stars").notNull(),
    daysAdded: integer("days_added").notNull(),
    telegramPaymentChargeId: text("telegram_payment_charge_id")
      .notNull()
      .unique(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("payments_telegram_id_idx").on(table.telegramId)]
);

export const ingredients = pgTable(
  "ingredients",
  {
    id: serial("id").primaryKey(),
    userId: text("user_id").notNull().default("legacy"),
    name: text("name").notNull(),
    unitType: text("unit_type")
      .$type<IngredientUnitType>()
      .notNull()
      .default("weight"),
    pricePerKg: doublePrecision("price_per_kg").notNull().default(0),
    unitWeightGrams: doublePrecision("unit_weight_grams").notNull().default(0),
    calories100g: doublePrecision("calories_100g").notNull().default(0),
    protein100g: doublePrecision("protein_100g").notNull().default(0),
    fat100g: doublePrecision("fat100g").notNull().default(0),
    carbs100g: doublePrecision("carbs_100g").notNull().default(0),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("ingredients_user_id_idx").on(table.userId)]
);

export const recipes = pgTable(
  "recipes",
  {
    id: serial("id").primaryKey(),
    userId: text("user_id").notNull().default("legacy"),
    name: text("name").notNull(),
    baseDiameter: integer("base_diameter").notNull().default(16),
    baseHeight: integer("base_height").notNull().default(10),
    defaultMarkupPercent: doublePrecision("default_markup_percent")
      .notNull()
      .default(100),
    portionsCount: integer("portions_count").notNull().default(8),
    finishedWeightGrams: integer("finished_weight_grams").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("recipes_user_id_idx").on(table.userId)]
);

export const recipeComponents = pgTable("recipe_components", {
  id: serial("id").primaryKey(),
  recipeId: integer("recipe_id")
    .notNull()
    .references(() => recipes.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
});

export const componentIngredients = pgTable("component_ingredients", {
  id: serial("id").primaryKey(),
  componentId: integer("component_id")
    .notNull()
    .references(() => recipeComponents.id, { onDelete: "cascade" }),
  ingredientId: integer("ingredient_id")
    .notNull()
    .references(() => ingredients.id, { onDelete: "cascade" }),
  baseGrams: doublePrecision("base_grams").notNull().default(0),
});

export const procurementPlans = pgTable(
  "procurement_plans",
  {
    id: serial("id").primaryKey(),
    userId: text("user_id").notNull().default("legacy"),
    name: text("name").notNull(),
    itemsJson: jsonb("items_json")
      .$type<ProcurementPlanItem[]>()
      .notNull()
      .default([]),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("procurement_plans_user_id_idx").on(table.userId)]
);
