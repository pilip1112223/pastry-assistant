"use client";

import {
  getClientUserId,
  getTelegramInitData,
  getTelegramUser,
} from "@/lib/telegram";

/**
 * Wrapper around fetch() that automatically attaches the active Telegram user ID
 * (or persisted browser guest ID), Telegram WebApp initData, and basic profile info.
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

  const tgUser = getTelegramUser();
  if (tgUser?.username) {
    headers.set("x-telegram-username", encodeURIComponent(tgUser.username));
  }
  if (tgUser?.first_name) {
    headers.set("x-telegram-first-name", encodeURIComponent(tgUser.first_name));
  }

  return fetch(input, {
    ...init,
    headers,
  });
}
