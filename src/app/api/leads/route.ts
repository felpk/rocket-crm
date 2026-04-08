import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";

export async function GET(req: Request) {
  const session = await requireAuth();
  const url = new URL(req.url);
  const targetUserId = url.searchParams.get("userId");

  const userId =
    session.role === "admin" && targetUserId ? targetUserId : session.id;

  const leads = await prisma.lead.findMany({
    where: session.role === "admin" && !targetUserId ? {} : { userId },
    orderBy: { createdAt: "desc" },
  });

  return Response.json(leads);
}

export async function POST(req: Request) {
  const session = await requireAuth();
  const data = await req.json();

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

  return Response.json(lead, { status: 201 });
}
