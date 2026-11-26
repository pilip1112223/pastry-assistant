CREATE TABLE IF NOT EXISTS "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"telegram_id" text NOT NULL,
	"username" text,
	"first_name" text,
	"trial_ends_at" timestamp with time zone NOT NULL,
	"subscription_ends_at" timestamp with time zone,
	"is_unlimited" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_telegram_id_unique" UNIQUE("telegram_id")
);

CREATE TABLE IF NOT EXISTS "payments" (
	"id" serial PRIMARY KEY NOT NULL,
	"telegram_id" text NOT NULL,
	"amount_stars" integer NOT NULL,
	"days_added" integer NOT NULL,
	"telegram_payment_charge_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payments_telegram_payment_charge_id_unique" UNIQUE("telegram_payment_charge_id")
);

CREATE INDEX IF NOT EXISTS "users_telegram_id_idx" ON "users" USING btree ("telegram_id");
CREATE INDEX IF NOT EXISTS "payments_telegram_id_idx" ON "payments" USING btree ("telegram_id");
