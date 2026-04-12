import { requireAuth } from "@/lib/auth";
import { createLogger } from "@/lib/logger";
import { runFollowupScan } from "@/lib/automations/engine";

const log = createLogger("automations/tick");

export async function POST() {
  log.info("POST /api/automations/tick");
  try {
    const session = await requireAuth();

    log.debug("Executando followup scan", { userId: session.id });
    await runFollowupScan(session.id);

    log.info("Followup scan concluido", { userId: session.id });
    return Response.json({ ok: true });
  } catch (err) {
    log.error("Erro no followup scan", { error: String(err) });
    return Response.json({ error: "Erro interno" }, { status: 500 });
  }
}
