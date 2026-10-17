import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { POST as alert } from "../api/alert.js";
import { POST as cancel } from "../api/cancel.js";
import { TOKEN, authedRequest, jsonBody, samplePayload, useEnv, useFakeFetch } from "./helpers.js";

describe("POST /api/alert", () => {
  useEnv({ ALERT_API_TOKEN: TOKEN, TELEGRAM_BOT_TOKEN: "bot-secret", DEFAULT_CHAT_IDS: "", DEMO_MODE: "false" });
  const fake = useFakeFetch();

  it("rejects requests without the shared token", async () => {
    const response = await alert(new Request("https://example.test/api/alert", { method: "POST" }));
    assert.equal(response.status, 401);
    assert.equal(fake.calls.length, 0);
  });

  it("rejects a malformed payload", async () => {
    const response = await alert(authedRequest("/api/alert", jsonBody({ hello: "world" })));
    assert.equal(response.status, 400);
  });

  it("sends the message and the location to every contact", async () => {
    const payload = { ...samplePayload, contactChatIds: ["111", "222"] };
    const response = await alert(authedRequest("/api/alert", jsonBody(payload)));

    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { alertId: payload.alertId, delivered: 2, failed: 0 });
    const methods = fake.calls.map((call) => call.url.split("/").pop());
    assert.deepEqual(methods.sort(), ["sendLocation", "sendLocation", "sendMessage", "sendMessage"]);

    const message = fake.calls.find((call) => call.url.endsWith("sendMessage"))!.body as { text: string };
    assert.match(message.text, /Alerta de Voz Segura/);
    assert.match(message.text, /google\.com\/maps\?q=4\.711,-74\.0721/);
  });

  it("still alerts when there is no location", async () => {
    const payload = { ...samplePayload, location: null };
    const response = await alert(authedRequest("/api/alert", jsonBody(payload)));

    assert.equal(response.status, 200);
    assert.deepEqual(fake.calls.map((call) => call.url.split("/").pop()), ["sendMessage"]);
    assert.match((fake.calls[0].body as { text: string }).text, /Ubicación no disponible/);
  });

  it("escapes HTML in the user message", async () => {
    const payload = { ...samplePayload, message: "<b>hola</b> & adiós" };
    await alert(authedRequest("/api/alert", jsonBody(payload)));
    const text = (fake.calls[0].body as { text: string }).text;
    assert.match(text, /&lt;b&gt;hola&lt;\/b&gt; &amp; adiós/);
  });

  it("reports 502 when no contact could be reached, so the watch retries", async () => {
    fake.setResponder(() => new Response("down", { status: 500 }));
    const response = await alert(authedRequest("/api/alert", jsonBody(samplePayload)));
    assert.equal(response.status, 502);
  });

  it("returns 422 when there is nobody to notify", async () => {
    const payload = { ...samplePayload, contactChatIds: [] };
    const response = await alert(authedRequest("/api/alert", jsonBody(payload)));
    assert.equal(response.status, 422);
  });

  it("demo mode answers without calling Telegram", async () => {
    const request = authedRequest("/api/alert", jsonBody(samplePayload));
    request.headers.set("x-demo-mode", "true");
    const response = await alert(request);
    assert.equal(response.status, 200);
    assert.equal((await response.json()).demo, true);
    assert.equal(fake.calls.length, 0);
  });
});

describe("POST /api/cancel", () => {
  useEnv({ ALERT_API_TOKEN: TOKEN, TELEGRAM_BOT_TOKEN: "bot-secret", DEFAULT_CHAT_IDS: "333", DEMO_MODE: "false" });
  const fake = useFakeFetch();

  it("notifies requested and default contacts that the person is fine", async () => {
    const response = await cancel(authedRequest("/api/cancel", jsonBody({ alertId: "a1", contactChatIds: ["111"] })));
    assert.equal(response.status, 200);
    const chats = fake.calls.map((call) => (call.body as { chat_id: string }).chat_id).sort();
    assert.deepEqual(chats, ["111", "333"]);
    assert.match((fake.calls[0].body as { text: string }).text, /Alerta cancelada/);
  });
});
