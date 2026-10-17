import { optionalEnv } from "./config.js";

const CHAT_ID = /^-?\d{1,20}$/;

/**
 * Contacts to notify: the ones sent by the watch plus DEFAULT_CHAT_IDS (comma separated),
 * which lets the demo work before the phone app syncs contacts. Invalid ids are dropped.
 */
export function resolveChatIds(requested: string[] = []): string[] {
  const defaults = optionalEnv("DEFAULT_CHAT_IDS")
    .split(",")
    .map((id) => id.trim());
  return [...new Set([...requested, ...defaults])].filter((id) => CHAT_ID.test(id));
}
