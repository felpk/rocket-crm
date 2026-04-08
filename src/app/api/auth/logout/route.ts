import { cookies } from "next/headers";
import { createLogger } from "@/lib/logger";

const log = createLogger("auth/logout");

export async function POST() {
  log.info("POST /api/auth/logout");
  const cookieStore = await cookies();
  cookieStore.delete("auth-token");
  log.info("Logout realizado");
  return Response.json({ ok: true });
}
