import crypto from "node:crypto";

const SAFE_USER_ID_RE = /^[a-zA-Z0-9._:-]{1,128}$/;

interface TelegramUserPayload {
  id?: number | string;
  first_name?: string;
  last_name?: string;
  username?: string;
}

export function extractRawTelegramId(userId: string): string {
  return userId.startsWith("tg_") ? userId.slice(3) : userId;
}

export function getAdminTelegramIds(): Set<string> {
  const raw = process.env.ADMIN_TELEGRAM_ID ?? "";
  return new Set(
    raw
      .split(",")
      .map((s) => s.trim().replace(/^tg_/, ""))
      .filter(Boolean)
  );
}

export function isAdminTelegramId(telegramId: string): boolean {
  if (!telegramId) return false;
  const normalized = telegramId.trim().replace(/^tg_/, "");
  return getAdminTelegramIds().has(normalized);
}

function decodeHeaderValue(value: string | null): string | null {
  if (!value) return null;
  try {
    const decoded = decodeURIComponent(value).trim();
    return decoded.length > 0 ? decoded.slice(0, 128) : null;
  } catch {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed.slice(0, 128) : null;
  }
}

function validateTelegramInitData(
  initData: string,
  botToken: string
): {
  valid: boolean;
  userId?: string;
  telegramId?: string;
  username?: string | null;
  firstName?: string | null;
} {
  try {
    const params = new URLSearchParams(initData);
    const receivedHash = params.get("hash");
    if (!receivedHash || !/^[0-9a-f]{64}$/i.test(receivedHash)) {
      return { valid: false };
    }

    const entries: string[] = [];
    params.forEach((value, key) => {
      if (key !== "hash") {
        entries.push(`${key}=${value}`);
      }
    });
    entries.sort((a, b) => a.localeCompare(b));
    const dataCheckString = entries.join("\n");

    const secretKey = crypto
      .createHmac("sha256", "WebAppData")
      .update(botToken)
      .digest();
    const expectedHash = crypto
      .createHmac("sha256", secretKey)
      .update(dataCheckString)
      .digest("hex");

    const receivedBuf = Buffer.from(receivedHash.toLowerCase(), "hex");
    const expectedBuf = Buffer.from(expectedHash.toLowerCase(), "hex");
    if (
      receivedBuf.length !== expectedBuf.length ||
      !crypto.timingSafeEqual(receivedBuf, expectedBuf)
    ) {
      return { valid: false };
    }

    const userJson = params.get("user");
    if (!userJson) return { valid: false };
    const parsed = JSON.parse(userJson) as TelegramUserPayload;
    if (parsed.id === undefined || parsed.id === null) {
      return { valid: false };
    }
    const rawId = String(parsed.id);
    return {
      valid: true,
      userId: `tg_${rawId}`,
      telegramId: rawId,
      username: parsed.username?.trim() || null,
      firstName: parsed.first_name?.trim() || null,
    };
  } catch {
    return { valid: false };
  }
}

function extractUnverifiedTelegramUser(initData: string): {
  userId: string;
  telegramId: string;
  username: string | null;
  firstName: string | null;
} | null {
  try {
    const params = new URLSearchParams(initData);
    const userJson = params.get("user");
    if (!userJson) return null;
    const parsed = JSON.parse(userJson) as TelegramUserPayload;
    if (parsed.id === undefined || parsed.id === null) return null;
    const rawId = String(parsed.id);
    const candidate = `tg_${rawId}`;
    if (!SAFE_USER_ID_RE.test(candidate)) return null;
    return {
      userId: candidate,
      telegramId: rawId,
      username: parsed.username?.trim() || null,
      firstName: parsed.first_name?.trim() || null,
    };
  } catch {
    return null;
  }
}

export type AuthResolution =
  | {
      ok: true;
      userId: string;
      telegramId: string;
      username: string | null;
      firstName: string | null;
      isAdmin: boolean;
    }
  | { ok: false; error: string; status: number };

export function resolveRequestUserId(request: Request): AuthResolution {
  const botToken = process.env.TELEGRAM_BOT_TOKEN?.trim() ?? "";
  const initData = request.headers.get("x-telegram-init-data")?.trim() ?? "";
  const headerUserId = request.headers.get("x-user-id")?.trim() ?? "";
  const headerUsername = decodeHeaderValue(
    request.headers.get("x-telegram-username")
  );
  const headerFirstName = decodeHeaderValue(
    request.headers.get("x-telegram-first-name")
  );

  if (botToken && initData) {
    const check = validateTelegramInitData(initData, botToken);
    if (!check.valid || !check.userId || !check.telegramId) {
      return {
        ok: false,
        error: "Недійсний підпис авторизації Telegram",
        status: 401,
      };
    }
    return {
      ok: true,
      userId: check.userId,
      telegramId: check.telegramId,
      username: check.username ?? headerUsername,
      firstName: check.firstName ?? headerFirstName,
      isAdmin: isAdminTelegramId(check.telegramId),
    };
  }

  if (botToken && headerUserId.startsWith("tg_")) {
    return {
      ok: false,
      error: "Потрібна підтверджена сесія Telegram WebApp",
      status: 401,
    };
  }

  if (initData) {
    const parsed = extractUnverifiedTelegramUser(initData);
    if (parsed) {
      return {
        ok: true,
        userId: parsed.userId,
        telegramId: parsed.telegramId,
        username: parsed.username ?? headerUsername,
        firstName: parsed.firstName ?? headerFirstName,
        isAdmin: isAdminTelegramId(parsed.telegramId),
      };
    }
  }

  if (headerUserId && SAFE_USER_ID_RE.test(headerUserId)) {
    const telegramId = extractRawTelegramId(headerUserId);
    return {
      ok: true,
      userId: headerUserId,
      telegramId,
      username: headerUsername,
      firstName: headerFirstName,
      isAdmin: isAdminTelegramId(telegramId),
    };
  }

  return {
    ok: false,
    error: "Не вдалося визначити користувача",
    status: 401,
  };
}
