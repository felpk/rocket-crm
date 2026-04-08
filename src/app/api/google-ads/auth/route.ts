import { requireAuth } from "@/lib/auth";
import { getAuthUrl } from "@/lib/google-ads";
import jwt from "jsonwebtoken";
import { createLogger } from "@/lib/logger";

const log = createLogger("google-ads/auth");

export async function GET() {
  log.info("GET /api/google-ads/auth — gerando URL OAuth");
  try {
    const session = await requireAuth();

    const state = jwt.sign(
      { userId: session.id },
      process.env.NEXTAUTH_SECRET!,
      { expiresIn: "10m" }
    );

    const url = getAuthUrl(state);
    log.info("URL OAuth gerada", { userId: session.id });
    return Response.json({ url });
  } catch (err) {
    log.error("Erro ao gerar URL OAuth", { error: String(err) });
    return Response.json({ error: "Erro interno" }, { status: 500 });
  }
}
