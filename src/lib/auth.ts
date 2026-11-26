import crypto from "node:crypto";

const SAFE_USER_ID_RE = /^[a-zA-Z0-9._:-]{1,128}$/;

interface TelegramUserPayload {
  id?: number | string;
  first_name?: string;
  username?: string;
}

function validateTelegramInitData(
  initData: string,
  botToken: string
): { valid: boolean; userId?: string } {
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
    return { valid: true, userId: `tg_${String(parsed.id)}` };
  } catch {
    return { valid: false };
  }
}

function extractUnverifiedTelegramUserId(initData: string): string | null {
  try {
    const params = new URLSearchParams(initData);
    const userJson = params.get("user");
    if (!userJson) return null;
    const parsed = JSON.parse(userJson) as TelegramUserPayload;
    if (parsed.id === undefined || parsed.id === null) return null;
    const candidate = `tg_${String(parsed.id)}`;
    return SAFE_USER_ID_RE.test(candidate) ? candidate : null;
  } catch {
    return null;
  }
}

export type AuthResolution =
  | { ok: true; userId: string }
  | { ok: false; error: string; status: number };

export function resolveRequestUserId(request: Request): AuthResolution {
  const botToken = process.env.TELEGRAM_BOT_TOKEN?.trim() ?? "";
  const initData = request.headers.get("x-telegram-init-data")?.trim() ?? "";
  const headerUserId = request.headers.get("x-user-id")?.trim() ?? "";

  if (botToken && initData) {
    const check = validateTelegramInitData(initData, botToken);
    if (!check.valid || !check.userId) {
      return {
        ok: false,
        error: "Недійсний підпис авторизації Telegram",
        status: 401,
      };
    }
    return { ok: true, userId: check.userId };
  }

  if (botToken && headerUserId.startsWith("tg_")) {
    return {
      ok: false,
      error: "Потрібна підтверджена сесія Telegram WebApp",
      status: 401,
    };
  }

  if (headerUserId && SAFE_USER_ID_RE.test(headerUserId)) {
    return { ok: true, userId: headerUserId };
  }

  if (initData) {
    const fallbackTgId = extractUnverifiedTelegramUserId(initData);
    if (fallbackTgId) {
      return { ok: true, userId: fallbackTgId };
    }
  }

  return {
    ok: false,
    error: "Не вдалося визначити користувача",
    status: 401,
  };
}
