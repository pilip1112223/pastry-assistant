import fs from "node:fs";
import path from "node:path";
import { desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb, hasValidDatabaseUrl } from "@/db";
import { payments, users } from "@/db/schema";
import { isAdminTelegramId, resolveRequestUserId } from "@/lib/auth";
import {
  TRIAL_DURATION_DAYS,
  type AccessStatus,
  type AdminUserView,
  type PaymentRecord,
  type UserAccessInfo,
  type UserRecord,
} from "@/types/pastry";

const DAY_MS = 24 * 60 * 60 * 1000;

interface LocalUsersDb {
  nextUserId: number;
  nextPaymentId: number;
  users: UserRecord[];
  payments: PaymentRecord[];
}

const LOCAL_DATA_DIR = path.join(process.cwd(), ".local-data");
const LOCAL_USERS_PATH = path.join(LOCAL_DATA_DIR, "users-payments.json");

function createEmptyUsersDb(): LocalUsersDb {
  return {
    nextUserId: 1,
    nextPaymentId: 1,
    users: [],
    payments: [],
  };
}

function readLocalUsersDb(): LocalUsersDb {
  try {
    if (!fs.existsSync(LOCAL_USERS_PATH)) {
      fs.mkdirSync(LOCAL_DATA_DIR, { recursive: true });
      const empty = createEmptyUsersDb();
      fs.writeFileSync(LOCAL_USERS_PATH, JSON.stringify(empty, null, 2), "utf8");
      return empty;
    }
    const raw = fs.readFileSync(LOCAL_USERS_PATH, "utf8");
    const parsed = JSON.parse(raw) as LocalUsersDb;
    return {
      ...createEmptyUsersDb(),
      ...parsed,
    };
  } catch {
    return createEmptyUsersDb();
  }
}

function writeLocalUsersDb(data: LocalUsersDb): void {
  fs.mkdirSync(LOCAL_DATA_DIR, { recursive: true });
  fs.writeFileSync(LOCAL_USERS_PATH, JSON.stringify(data, null, 2), "utf8");
}

export function computeUserAccess(user: UserRecord): UserAccessInfo {
  const now = Date.now();
  const isAdmin = isAdminTelegramId(user.telegramId);
  const trialEndsMs = new Date(user.trialEndsAt).getTime();
  const subEndsMs = user.subscriptionEndsAt
    ? new Date(user.subscriptionEndsAt).getTime()
    : 0;

  const isTrialActive = trialEndsMs > now;
  const isSubActive = subEndsMs > now;
  const hasAccess = isAdmin || user.isUnlimited || isSubActive || isTrialActive;

  let status: AccessStatus = "expired";
  if (isAdmin) status = "admin";
  else if (user.isUnlimited) status = "unlimited";
  else if (isSubActive) status = "active";
  else if (isTrialActive) status = "trial";

  const trialDaysLeft = isTrialActive
    ? Math.max(1, Math.ceil((trialEndsMs - now) / DAY_MS))
    : 0;
  const subscriptionDaysLeft = isSubActive
    ? Math.max(1, Math.ceil((subEndsMs - now) / DAY_MS))
    : 0;

  return {
    telegramId: user.telegramId,
    username: user.username,
    firstName: user.firstName,
    isAdmin,
    isUnlimited: user.isUnlimited,
    hasAccess,
    status,
    trialEndsAt: user.trialEndsAt,
    subscriptionEndsAt: user.subscriptionEndsAt,
    trialDaysLeft,
    subscriptionDaysLeft,
  };
}

function mapDbUser(row: typeof users.$inferSelect): UserRecord {
  return {
    id: row.id,
    telegramId: row.telegramId,
    username: row.username ?? null,
    firstName: row.firstName ?? null,
    trialEndsAt: row.trialEndsAt.toISOString(),
    subscriptionEndsAt: row.subscriptionEndsAt
      ? row.subscriptionEndsAt.toISOString()
      : null,
    isUnlimited: row.isUnlimited,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function ensureUserRecord(input: {
  telegramId: string;
  username?: string | null;
  firstName?: string | null;
}): Promise<UserRecord> {
  const telegramId = input.telegramId.trim().replace(/^tg_/, "");
  const cleanUsername = input.username?.trim() || null;
  const cleanFirstName = input.firstName?.trim() || null;

  if (!hasValidDatabaseUrl()) {
    const data = readLocalUsersDb();
    let existing = data.users.find((u) => u.telegramId === telegramId);
    if (!existing) {
      const now = new Date();
      const trialEndsAt = new Date(
        now.getTime() + TRIAL_DURATION_DAYS * DAY_MS
      );
      existing = {
        id: data.nextUserId++,
        telegramId,
        username: cleanUsername,
        firstName: cleanFirstName,
        trialEndsAt: trialEndsAt.toISOString(),
        subscriptionEndsAt: null,
        isUnlimited: false,
        createdAt: now.toISOString(),
      };
      data.users.push(existing);
      writeLocalUsersDb(data);
      return existing;
    }

    let changed = false;
    if (cleanUsername && existing.username !== cleanUsername) {
      existing.username = cleanUsername;
      changed = true;
    }
    if (cleanFirstName && existing.firstName !== cleanFirstName) {
      existing.firstName = cleanFirstName;
      changed = true;
    }
    if (changed) {
      writeLocalUsersDb(data);
    }
    return existing;
  }

  const db = getDb();
  const existingRows = await db
    .select()
    .from(users)
    .where(eq(users.telegramId, telegramId))
    .limit(1);

  if (existingRows.length === 0) {
    const trialEndsAt = new Date(Date.now() + TRIAL_DURATION_DAYS * DAY_MS);
    await db
      .insert(users)
      .values({
        telegramId,
        username: cleanUsername,
        firstName: cleanFirstName,
        trialEndsAt,
        isUnlimited: false,
      })
      .onConflictDoNothing({ target: users.telegramId });

    const [created] = await db
      .select()
      .from(users)
      .where(eq(users.telegramId, telegramId))
      .limit(1);
    return mapDbUser(created);
  }

  const existing = existingRows[0];
  const needsUpdate =
    (cleanUsername && existing.username !== cleanUsername) ||
    (cleanFirstName && existing.firstName !== cleanFirstName);

  if (needsUpdate) {
    const [updated] = await db
      .update(users)
      .set({
        ...(cleanUsername ? { username: cleanUsername } : {}),
        ...(cleanFirstName ? { firstName: cleanFirstName } : {}),
      })
      .where(eq(users.id, existing.id))
      .returning();
    if (updated) return mapDbUser(updated);
  }

  return mapDbUser(existing);
}

export async function ensureUserAndGetAccess(input: {
  telegramId: string;
  username?: string | null;
  firstName?: string | null;
}): Promise<UserAccessInfo> {
  const user = await ensureUserRecord(input);
  return computeUserAccess(user);
}

export async function recordStarsPaymentAndExtendSubscription(input: {
  telegramId: string;
  amountStars: number;
  daysAdded: number;
  telegramPaymentChargeId: string;
  username?: string | null;
  firstName?: string | null;
}): Promise<{ duplicate: boolean; user: UserRecord }> {
  const telegramId = input.telegramId.trim().replace(/^tg_/, "");
  const days = Math.max(1, Math.round(input.daysAdded));
  const amountStars = Math.max(1, Math.round(input.amountStars));
  const chargeId = input.telegramPaymentChargeId.trim();

  const user = await ensureUserRecord({
    telegramId,
    username: input.username,
    firstName: input.firstName,
  });

  if (!hasValidDatabaseUrl()) {
    const data = readLocalUsersDb();
    if (data.payments.some((p) => p.telegramPaymentChargeId === chargeId)) {
      return { duplicate: true, user };
    }

    data.payments.push({
      id: data.nextPaymentId++,
      telegramId,
      amountStars,
      daysAdded: days,
      telegramPaymentChargeId: chargeId,
      createdAt: new Date().toISOString(),
    });

    const target = data.users.find((u) => u.telegramId === telegramId)!;
    const now = Date.now();
    const currentEnd = target.subscriptionEndsAt
      ? new Date(target.subscriptionEndsAt).getTime()
      : 0;
    const baseMs = currentEnd > now ? currentEnd : now;
    target.subscriptionEndsAt = new Date(baseMs + days * DAY_MS).toISOString();
    writeLocalUsersDb(data);
    return { duplicate: false, user: target };
  }

  const db = getDb();

  // Insert payment idempotently via UNIQUE constraint on telegram_payment_charge_id
  const inserted = await db
    .insert(payments)
    .values({
      telegramId,
      amountStars,
      daysAdded: days,
      telegramPaymentChargeId: chargeId,
    })
    .onConflictDoNothing({ target: payments.telegramPaymentChargeId })
    .returning();

  if (inserted.length === 0) {
    return { duplicate: true, user };
  }

  const now = Date.now();
  const currentEnd = user.subscriptionEndsAt
    ? new Date(user.subscriptionEndsAt).getTime()
    : 0;
  const baseMs = currentEnd > now ? currentEnd : now;
  const newEndsAt = new Date(baseMs + days * DAY_MS);

  const [updated] = await db
    .update(users)
    .set({
      subscriptionEndsAt: newEndsAt,
      ...(input.username ? { username: input.username.trim() } : {}),
      ...(input.firstName ? { firstName: input.firstName.trim() } : {}),
    })
    .where(eq(users.telegramId, telegramId))
    .returning();

  return {
    duplicate: false,
    user: updated ? mapDbUser(updated) : user,
  };
}

export type AdminUserAction = "add_30" | "add_90" | "unlimited" | "revoke";

export async function adminUpdateUserAccess(
  telegramIdRaw: string,
  action: AdminUserAction
): Promise<AdminUserView | null> {
  const telegramId = telegramIdRaw.trim().replace(/^tg_/, "");

  if (!hasValidDatabaseUrl()) {
    const data = readLocalUsersDb();
    const target = data.users.find((u) => u.telegramId === telegramId);
    if (!target) return null;
    const now = Date.now();

    if (action === "add_30" || action === "add_90") {
      const days = action === "add_30" ? 30 : 90;
      const currentEnd = target.subscriptionEndsAt
        ? new Date(target.subscriptionEndsAt).getTime()
        : 0;
      const baseMs = currentEnd > now ? currentEnd : now;
      target.subscriptionEndsAt = new Date(
        baseMs + days * DAY_MS
      ).toISOString();
    } else if (action === "unlimited") {
      target.isUnlimited = true;
    } else if (action === "revoke") {
      target.isUnlimited = false;
      target.subscriptionEndsAt = null;
      target.trialEndsAt = new Date(now - 1000).toISOString();
    }

    writeLocalUsersDb(data);
    const access = computeUserAccess(target);
    return {
      ...target,
      isAdmin: access.isAdmin,
      hasAccess: access.hasAccess,
      status: access.status,
    };
  }

  const db = getDb();
  const [existing] = await db
    .select()
    .from(users)
    .where(eq(users.telegramId, telegramId))
    .limit(1);

  if (!existing) return null;

  const now = Date.now();
  let patch: Partial<typeof users.$inferInsert> = {};

  if (action === "add_30" || action === "add_90") {
    const days = action === "add_30" ? 30 : 90;
    const currentEnd = existing.subscriptionEndsAt
      ? existing.subscriptionEndsAt.getTime()
      : 0;
    const baseMs = currentEnd > now ? currentEnd : now;
    patch = {
      subscriptionEndsAt: new Date(baseMs + days * DAY_MS),
    };
  } else if (action === "unlimited") {
    patch = { isUnlimited: true };
  } else if (action === "revoke") {
    patch = {
      isUnlimited: false,
      subscriptionEndsAt: null,
      trialEndsAt: new Date(now - 1000),
    };
  }

  const [updated] = await db
    .update(users)
    .set(patch)
    .where(eq(users.id, existing.id))
    .returning();

  if (!updated) return null;
  const mapped = mapDbUser(updated);
  const access = computeUserAccess(mapped);
  return {
    ...mapped,
    isAdmin: access.isAdmin,
    hasAccess: access.hasAccess,
    status: access.status,
  };
}

export async function getAdminOverview(): Promise<{
  users: AdminUserView[];
  payments: PaymentRecord[];
}> {
  if (!hasValidDatabaseUrl()) {
    const data = readLocalUsersDb();
    const userMap = new Map(data.users.map((u) => [u.telegramId, u]));
    const usersList: AdminUserView[] = data.users
      .slice()
      .sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      )
      .map((u) => {
        const access = computeUserAccess(u);
        return {
          ...u,
          isAdmin: access.isAdmin,
          hasAccess: access.hasAccess,
          status: access.status,
        };
      });

    const paymentsList: PaymentRecord[] = data.payments
      .slice()
      .sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      )
      .slice(0, 50)
      .map((p) => {
        const u = userMap.get(p.telegramId);
        return {
          ...p,
          username: u?.username ?? null,
          firstName: u?.firstName ?? null,
        };
      });

    return { users: usersList, payments: paymentsList };
  }

  const db = getDb();
  const [userRows, paymentRows] = await Promise.all([
    db.select().from(users).orderBy(desc(users.createdAt)),
    db.select().from(payments).orderBy(desc(payments.createdAt)).limit(50),
  ]);

  const mappedUsers = userRows.map(mapDbUser);
  const userMap = new Map(mappedUsers.map((u) => [u.telegramId, u]));

  const usersList: AdminUserView[] = mappedUsers.map((u) => {
    const access = computeUserAccess(u);
    return {
      ...u,
      isAdmin: access.isAdmin,
      hasAccess: access.hasAccess,
      status: access.status,
    };
  });

  const paymentsList: PaymentRecord[] = paymentRows.map((p) => {
    const u = userMap.get(p.telegramId);
    return {
      id: p.id,
      telegramId: p.telegramId,
      amountStars: p.amountStars,
      daysAdded: p.daysAdded,
      telegramPaymentChargeId: p.telegramPaymentChargeId,
      createdAt: p.createdAt.toISOString(),
      username: u?.username ?? null,
      firstName: u?.firstName ?? null,
    };
  });

  return { users: usersList, payments: paymentsList };
}

// ==================== API GUARDS ====================

export async function requireActiveAccess(
  request: Request
): Promise<
  | {
      ok: true;
      userId: string;
      telegramId: string;
      access: UserAccessInfo;
    }
  | { ok: false; response: NextResponse }
> {
  const auth = resolveRequestUserId(request);
  if (!auth.ok) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: auth.error },
        { status: auth.status }
      ),
    };
  }

  const access = await ensureUserAndGetAccess({
    telegramId: auth.telegramId,
    username: auth.username,
    firstName: auth.firstName,
  });

  if (!access.hasAccess) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          error: "Пробний період завершився. Оформіть підписку для продовження.",
          code: "SUBSCRIPTION_REQUIRED",
        },
        { status: 403 }
      ),
    };
  }

  return {
    ok: true,
    userId: auth.userId,
    telegramId: auth.telegramId,
    access,
  };
}

export async function requireAdminAccess(
  request: Request
): Promise<
  | { ok: true; userId: string; telegramId: string }
  | { ok: false; response: NextResponse }
> {
  const auth = resolveRequestUserId(request);
  if (!auth.ok) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: auth.error },
        { status: auth.status }
      ),
    };
  }

  if (!auth.isAdmin) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Доступ заборонено. Потрібні права адміністратора." },
        { status: 403 }
      ),
    };
  }

  // Ensure admin user record exists too
  await ensureUserRecord({
    telegramId: auth.telegramId,
    username: auth.username,
    firstName: auth.firstName,
  });

  return {
    ok: true,
    userId: auth.userId,
    telegramId: auth.telegramId,
  };
}
