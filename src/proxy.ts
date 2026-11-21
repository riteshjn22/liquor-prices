import { NextResponse, type NextRequest } from "next/server";
import { adminChallenge, isAdminRequest } from "@/lib/admin-auth";

/**
 * Password-protects the admin page and admin API with HTTP Basic auth.
 * The API routes check the password again themselves (defence in depth).
 */
export function proxy(request: NextRequest) {
  if (!isAdminRequest(request.headers.get("authorization"))) return adminChallenge();
  const res = NextResponse.next();
  res.headers.set("X-Robots-Tag", "noindex, nofollow");
  res.headers.set("Cache-Control", "private, no-store");
  return res;
}

export const config = {
  matcher: ["/admin", "/admin/:path*", "/api/admin/:path*"],
};
