import { parse as parseCookieHeader } from "cookie";
import type { Request } from "express";
import { SignJWT, jwtVerify } from "jose";
import { ENV } from "./env";

const COOKIE_NAME = "credtent_session";
const ONE_YEAR_MS = 1000 * 60 * 60 * 24 * 365;

export { COOKIE_NAME, ONE_YEAR_MS };

export type SessionPayload = {
  email: string;
  role: "admin";
};

function getSecret() {
  return new TextEncoder().encode(ENV.jwtSecret);
}

export async function createSessionToken(email: string): Promise<string> {
  const expirationSeconds = Math.floor((Date.now() + ONE_YEAR_MS) / 1000);
  return new SignJWT({ email, role: "admin" })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setExpirationTime(expirationSeconds)
    .sign(getSecret());
}

export async function verifySession(
  cookieValue: string | undefined | null
): Promise<SessionPayload | null> {
  if (!cookieValue) return null;
  try {
    const { payload } = await jwtVerify(cookieValue, getSecret(), {
      algorithms: ["HS256"],
    });
    const { email, role } = payload as Record<string, unknown>;
    if (typeof email !== "string" || role !== "admin") return null;
    return { email: email as string, role: "admin" };
  } catch {
    return null;
  }
}

export function getSessionCookie(req: Request): string | undefined {
  const cookieHeader = req.headers.cookie;
  if (!cookieHeader) return undefined;
  const parsed = parseCookieHeader(cookieHeader);
  return parsed[COOKIE_NAME];
}

export function verifyAdminCredentials(email: string, password: string): boolean {
  return (
    email === ENV.adminEmail &&
    password === ENV.adminPassword &&
    email.length > 0 &&
    password.length > 0
  );
}
