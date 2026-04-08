import { requireAuth } from "@/lib/auth";
import { getConnectionState } from "@/lib/evolution";

export async function GET() {
  await requireAuth();
  try {
    const state = await getConnectionState();
    return Response.json(state);
  } catch (error) {
    return Response.json(
      { error: "Falha ao verificar conexão", details: String(error) },
      { status: 500 }
    );
  }
}
