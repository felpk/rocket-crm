import { requireAuth } from "@/lib/auth";
import { sendTextMessage } from "@/lib/evolution";
import { prisma } from "@/lib/db";

export async function POST(req: Request) {
  await requireAuth();
  const { phone, text, leadId } = await req.json();

  if (!phone || !text) {
    return Response.json(
      { error: "Telefone e texto são obrigatórios" },
      { status: 400 }
    );
  }

  try {
    const result = await sendTextMessage(phone, text);

    if (leadId) {
      await prisma.message.create({
        data: {
          content: text,
          fromMe: true,
          leadId,
        },
      });
    }

    return Response.json(result);
  } catch (error) {
    return Response.json(
      { error: "Falha ao enviar mensagem", details: String(error) },
      { status: 500 }
    );
  }
}
