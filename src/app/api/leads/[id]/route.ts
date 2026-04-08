import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireAuth();
  const { id } = await params;
  const data = await req.json();

  const lead = await prisma.lead.findUnique({ where: { id } });
  if (!lead) {
    return Response.json({ error: "Lead não encontrado" }, { status: 404 });
  }
  if (session.role !== "admin" && lead.userId !== session.id) {
    return Response.json({ error: "Sem permissão" }, { status: 403 });
  }

  const updated = await prisma.lead.update({
    where: { id },
    data: {
      ...(data.name !== undefined && { name: data.name }),
      ...(data.email !== undefined && { email: data.email }),
      ...(data.phone !== undefined && { phone: data.phone }),
      ...(data.company !== undefined && { company: data.company }),
      ...(data.value !== undefined && { value: parseFloat(data.value) }),
      ...(data.origin !== undefined && { origin: data.origin }),
      ...(data.notes !== undefined && { notes: data.notes }),
      ...(data.stage !== undefined && { stage: data.stage }),
    },
  });

  return Response.json(updated);
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireAuth();
  const { id } = await params;

  const lead = await prisma.lead.findUnique({ where: { id } });
  if (!lead) {
    return Response.json({ error: "Lead não encontrado" }, { status: 404 });
  }
  if (session.role !== "admin" && lead.userId !== session.id) {
    return Response.json({ error: "Sem permissão" }, { status: 403 });
  }

  await prisma.lead.delete({ where: { id } });
  return Response.json({ ok: true });
}
