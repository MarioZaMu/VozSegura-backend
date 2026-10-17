export function GET(): Response {
  return Response.json({ status: "ok", service: "voz-segura-backend" });
}
