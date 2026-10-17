import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { DEMO_SUMMARY, POST as audio } from "../api/audio.js";
import { NO_SPEECH_SUMMARY } from "../lib/groq.js";
import { TOKEN, authedRequest, okJson, useEnv, useFakeFetch } from "./helpers.js";

const clip = new Uint8Array([0, 0, 0, 24, 102, 116, 121, 112]); // "ftyp" header bytes

function audioRequest(query = "?alertId=a1&chatIds=111") {
  return authedRequest(`/api/audio${query}`, { body: clip, headers: { "content-type": "audio/mp4" } });
}

function groqResponder(transcription: unknown, summary = "Se escucha a una persona pedir ayuda.") {
  return (url: string) => {
    if (url.endsWith("/audio/transcriptions")) return okJson(transcription);
    if (url.endsWith("/chat/completions")) return okJson({ choices: [{ message: { content: summary } }] });
    return okJson({ ok: true });
  };
}

describe("POST /api/audio", () => {
  useEnv({
    ALERT_API_TOKEN: TOKEN,
    TELEGRAM_BOT_TOKEN: "bot-secret",
    GROQ_API_KEY: "groq-secret",
    DEFAULT_CHAT_IDS: "",
    DEMO_MODE: "false",
  });
  const fake = useFakeFetch(groqResponder({ segments: [{ text: " ¡Déjame en paz! ", no_speech_prob: 0.05 }] }));

  it("transcribes, summarizes, and sends summary then audio", async () => {
    const response = await audio(audioRequest());
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.summaryStatus, "ok");
    assert.equal(body.summary, "Se escucha a una persona pedir ayuda.");

    const steps = fake.calls.map((call) => call.url.split("/").pop());
    assert.deepEqual(steps, ["transcriptions", "completions", "sendMessage", "sendAudio"]);

    const chat = fake.calls[1].body as { messages: { role: string; content: string }[] };
    assert.match(chat.messages[1].content, /Déjame en paz/);
    assert.match((fake.calls[2].body as { text: string }).text, /Resumen automático/);
  });

  it("skips the language model when Whisper hears no speech", async () => {
    fake.setResponder(groqResponder({ segments: [{ text: "Gracias por ver el video.", no_speech_prob: 0.92 }] }));
    const body = await (await audio(audioRequest())).json();
    assert.equal(body.summary, NO_SPEECH_SUMMARY);
    assert.ok(!fake.calls.some((call) => call.url.endsWith("/chat/completions")));
  });

  it("still delivers the audio when the AI fails", async () => {
    fake.setResponder((url) =>
      url.includes("groq.com") ? new Response("overloaded", { status: 503 }) : okJson({ ok: true }),
    );
    const response = await audio(audioRequest());
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.summaryStatus, "failed");
    assert.equal(body.summary, null);

    const telegram = fake.calls.filter((call) => call.url.includes("telegram.org")).map((call) => call.url.split("/").pop());
    assert.deepEqual(telegram, ["sendMessage", "sendAudio"]);
    assert.match((fake.calls.find((call) => call.url.endsWith("sendMessage"))!.body as { text: string }).text, /No se pudo generar/);
  });

  it("rejects an empty clip", async () => {
    const request = authedRequest("/api/audio?alertId=a1&chatIds=111", { body: new Uint8Array() });
    assert.equal((await audio(request)).status, 400);
  });

  it("requires an alert id", async () => {
    assert.equal((await audio(audioRequest("?chatIds=111"))).status, 400);
  });

  it("demo mode returns a canned summary without calling anything", async () => {
    const request = audioRequest();
    request.headers.set("x-demo-mode", "true");
    const body = await (await audio(request)).json();
    assert.equal(body.summary, DEMO_SUMMARY);
    assert.equal(fake.calls.length, 0);
  });
});
