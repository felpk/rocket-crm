import { getSession } from "@/lib/auth";
import { createLogger } from "@/lib/logger";

const log = createLogger("auth/me");

export async function GET() {
  log.debug("GET /api/auth/me");
  const session = await getSession();
  if (!session) {
    log.debug("Sem sessão ativa");
    return Response.json({ user: null }, { status: 401 });
  }
  log.debug("Sessão encontrada", { userId: session.id });
  return Response.json({ user: session });
}
