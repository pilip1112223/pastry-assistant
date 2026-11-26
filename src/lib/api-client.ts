"use client";

import { getClientUserId, getTelegramInitData } from "@/lib/telegram";

/**
 * Wrapper around fetch() that automatically attaches the active Telegram user ID
 * (or persisted browser guest ID) and Telegram WebApp initData for server validation.
 */
export function apiFetch(
  input: RequestInfo | URL,
  init: RequestInit = {}
): Promise<Response> {
  const headers = new Headers(init.headers);
  headers.set("x-user-id", getClientUserId());

  const initData = getTelegramInitData();
  if (initData) {
    headers.set("x-telegram-init-data", initData);
  }

  return fetch(input, {
    ...init,
    headers,
  });
}
