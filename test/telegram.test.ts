import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { POST as webhook } from "../api/telegram.js";
import { resolveChatIds } from "../lib/recipients.js";
import { useEnv, useFakeFetch } from "./helpers.js";

function update(text: string, secret = "hook-secret") {
  return new Request("https://example.test/api/telegram", {
    method: "POST",
    headers: { "x-telegram-bot-api-secret-token": secret, "content-type": "application/json" },
    body: JSON.stringify({ message: { chat: { id: 987654321 }, text } }),
  });
}

describe("POST /api/telegram (webhook)", () => {
  useEnv({ TELEGRAM_BOT_TOKEN: "bot-secret", TELEGRAM_WEBHOOK_SECRET: "hook-secret" });
  const fake = useFakeFetch();

  it("answers /start with the contact's chat id", async () => {
    const response = await webhook(update("/start"));
    assert.equal(response.status, 200);
    const reply = fake.calls[0].body as { chat_id: string; text: string };
    assert.equal(reply.chat_id, "987654321");
    assert.match(reply.text, /<code>987654321<\/code>/);
  });

  it("ignores other messages", async () => {
    await webhook(update("hola"));
    assert.equal(fake.calls.length, 0);
  });

  it("rejects calls without Telegram's secret header", async () => {
    const response = await webhook(update("/start", "wrong"));
    assert.equal(response.status, 403);
    assert.equal(fake.calls.length, 0);
  });
});

describe("resolveChatIds", () => {
  useEnv({ DEFAULT_CHAT_IDS: " 333 , 111,abc" });

  it("merges defaults, removes duplicates and drops invalid ids", () => {
    assert.deepEqual(resolveChatIds(["111", "-100200", "x1"]), ["111", "-100200", "333"]);
  });
});
