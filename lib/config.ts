/** Reads a required environment variable; secrets never live in the apps or the repo. */
export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing environment variable: ${name}`);
  }
  return value;
}

export function optionalEnv(name: string, fallback = ""): string {
  return process.env[name] || fallback;
}

/**
 * Demo mode simulates Telegram and Groq so a presentation works with no internet or keys.
 * Enabled server-wide with DEMO_MODE=true, or per request with the `X-Demo-Mode: true` header.
 */
export function isDemoMode(request?: Request): boolean {
  return process.env.DEMO_MODE === "true" || request?.headers.get("x-demo-mode") === "true";
}

/** Time zone used to print the alert time for contacts. */
export function alertTimeZone(): string {
  return optionalEnv("TIME_ZONE", "America/Bogota");
}
