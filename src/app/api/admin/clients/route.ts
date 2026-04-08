import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { createLogger } from "@/lib/logger";

const log = createLogger("admin/clients");

export async function GET() {
  log.info("GET /api/admin/clients");
  try {
    await requireAdmin();

    const clients = await prisma.user.findMany({
      where: { role: "client" },
      select: {
        id: true,
        name: true,
        email: true,
        company: true,
        createdAt: true,
        _count: { select: { leads: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    log.info("Clientes carregados", { count: clients.length });
    return Response.json(clients);
  } catch (err) {
    log.error("Erro ao carregar clientes", { error: String(err) });
    return Response.json({ error: "Erro interno" }, { status: 500 });
  }
}
