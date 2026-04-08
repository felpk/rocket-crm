import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { createLogger } from "@/lib/logger";

const log = createLogger("leads");

export async function GET(req: Request) {
  log.info("GET /api/leads");
  try {
    const session = await requireAuth();
    const url = new URL(req.url);
    const targetUserId = url.searchParams.get("userId");

    const userId =
      session.role === "admin" && targetUserId ? targetUserId : session.id;

    log.debug("Buscando leads", { userId, isAdmin: session.role === "admin", targetUserId });
    const leads = await prisma.lead.findMany({
      where: session.role === "admin" && !targetUserId ? {} : { userId },
      orderBy: { createdAt: "desc" },
    });

    log.info("Leads encontrados", { count: leads.length });
    return Response.json(leads);
  } catch (err) {
    log.error("Erro ao buscar leads", { error: String(err) });
    return Response.json({ error: "Erro interno" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  log.info("POST /api/leads — criando lead");
  try {
    const session = await requireAuth();
    const data = await req.json();

    log.debug("Dados do lead", { name: data.name, stage: data.stage || "lead" });
    const lead = await prisma.lead.create({
      data: {
        name: data.name,
        email: data.email || null,
        phone: data.phone || null,
        company: data.company || null,
        value: data.value ? parseFloat(data.value) : 0,
        origin: data.origin || null,
        notes: data.notes || null,
        stage: data.stage || "lead",
        userId: session.id,
      },
    });

    log.info("Lead criado", { leadId: lead.id, name: lead.name });
    return Response.json(lead, { status: 201 });
  } catch (err) {
    log.error("Erro ao criar lead", { error: String(err) });
    return Response.json({ error: "Erro interno" }, { status: 500 });
  }
}
