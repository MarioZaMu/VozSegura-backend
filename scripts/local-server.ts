/**
 * Runs the Vercel handlers on a plain Node HTTP server, without the Vercel CLI or an account.
 * Handy for local demos: the Android emulator reaches it at http://10.0.2.2:3000.
 *
 *   ALERT_API_TOKEN=dev DEMO_MODE=true npm run serve
 */
import { createServer, type IncomingMessage } from "node:http";
import { POST as alert } from "../api/alert.js";
import { POST as audio } from "../api/audio.js";
import { POST as cancel } from "../api/cancel.js";
import { GET as health } from "../api/health.js";
import { POST as telegram } from "../api/telegram.js";

type Handler = (request: Request) => Response | Promise<Response>;

const routes: Record<string, Partial<Record<string, Handler>>> = {
  "/api/health": { GET: () => health() },
  "/api/alert": { POST: alert },
  "/api/audio": { POST: audio },
  "/api/cancel": { POST: cancel },
  "/api/telegram": { POST: telegram },
};

async function toRequest(incoming: IncomingMessage, port: number): Promise<Request> {
  const chunks: Buffer[] = [];
  for await (const chunk of incoming) chunks.push(chunk as Buffer);
  const body = chunks.length > 0 ? Buffer.concat(chunks) : undefined;
  const headers = new Headers();
  for (const [key, value] of Object.entries(incoming.headers)) {
    if (typeof value === "string") headers.set(key, value);
  }
  return new Request(`http://localhost:${port}${incoming.url ?? "/"}`, {
    method: incoming.method,
    headers,
    body: incoming.method === "GET" ? undefined : body,
  });
}

const port = Number(process.env.PORT ?? 3000);

createServer(async (incoming, outgoing) => {
  const path = (incoming.url ?? "/").split("?")[0];
  const handler = routes[path]?.[incoming.method ?? "GET"];
  const response = handler ? await handler(await toRequest(incoming, port)) : new Response("not found", { status: 404 });
  console.log(`${incoming.method} ${path} -> ${response.status}`);
  outgoing.writeHead(response.status, Object.fromEntries(response.headers));
  outgoing.end(Buffer.from(await response.arrayBuffer()));
}).listen(port, () => {
  console.log(`voz-segura-backend local server on http://localhost:${port} (demo=${process.env.DEMO_MODE === "true"})`);
});
