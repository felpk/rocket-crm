import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";

export async function GET() {
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

  return Response.json(clients);
}
