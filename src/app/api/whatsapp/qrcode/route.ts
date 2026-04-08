import { requireAuth } from "@/lib/auth";
import { getQrCode } from "@/lib/evolution";

export async function GET() {
  await requireAuth();
  try {
    const qr = await getQrCode();
    return Response.json(qr);
  } catch (error) {
    return Response.json(
      { error: "Falha ao gerar QR Code", details: String(error) },
      { status: 500 }
    );
  }
}
