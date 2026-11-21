/**
 * HTTP Basic auth for the admin area. Set ADMIN_PASSWORD (and optionally
 * ADMIN_USER, default "admin"). With no password set, the admin area is disabled.
 * Uses only Web APIs so it works in both the proxy and route handlers.
 */

export const ADMIN_REALM = 'Basic realm="Liquor admin", charset="UTF-8"';

function safeEqual(a: string, b: string): boolean {
  // Constant-time compare so response timing doesn't leak the password.
  let diff = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i++) diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return diff === 0;
}

export function adminEnabled(): boolean {
  return (process.env.ADMIN_PASSWORD ?? "").length >= 8;
}

export function isAdminRequest(authorization: string | null): boolean {
  if (!adminEnabled() || !authorization?.startsWith("Basic ")) return false;
  let decoded = "";
  try {
    decoded = new TextDecoder().decode(Uint8Array.from(atob(authorization.slice(6)), (c) => c.charCodeAt(0)));
  } catch {
    return false;
  }
  const sep = decoded.indexOf(":");
  if (sep < 0) return false;
  const user = decoded.slice(0, sep);
  const pass = decoded.slice(sep + 1);
  const okUser = safeEqual(user, process.env.ADMIN_USER || "admin");
  const okPass = safeEqual(pass, process.env.ADMIN_PASSWORD!);
  return okUser && okPass;
}

/** Response for unauthenticated requests: makes the browser show its login prompt. */
export function adminChallenge(): Response {
  if (!adminEnabled()) {
    return new Response("Admin is disabled. Set ADMIN_PASSWORD (at least 8 characters) to enable it.", { status: 503 });
  }
  return new Response("Authentication required", { status: 401, headers: { "WWW-Authenticate": ADMIN_REALM } });
}
