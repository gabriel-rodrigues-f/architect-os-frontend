import { messageCodeOf } from "./api-client";
import type { MessageKey } from "./i18n";
import { baseMessages } from "./i18n/registry";

export function successMessageOf(result: unknown, fallback: MessageKey): MessageKey {
  const code = messageCodeOf(result);
  if (code === undefined) return fallback;
  const key = `msg.${code}`;
  return key in baseMessages ? (key as MessageKey) : fallback;
}
