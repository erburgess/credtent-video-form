import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import { getSessionCookie, verifySession, type SessionPayload } from "./auth";

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  session: SessionPayload | null;
};

export async function createContext(
  opts: CreateExpressContextOptions
): Promise<TrpcContext> {
  const cookie = getSessionCookie(opts.req);
  const session = await verifySession(cookie);

  return {
    req: opts.req,
    res: opts.res,
    session,
  };
}
