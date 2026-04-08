import { prisma } from "@/lib/db";
import { verifyPassword, createToken, type SessionUser } from "@/lib/auth";
import { cookies } from "next/headers";
import { createLogger } from "@/lib/logger";

const log = createLogger("auth/login");

export async function POST(req: Request) {
  log.info("POST /api/auth/login — tentativa de login");
  try {
    const { email, password } = await req.json();

    if (!email || !password) {
      log.warn("Campos obrigatórios ausentes");
      return Response.json({ error: "Campos obrigatórios" }, { status: 400 });
    }

    log.debug("Buscando usuário", { email });
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      log.warn("Usuário não encontrado", { email });
      return Response.json({ error: "Credenciais inválidas" }, { status: 401 });
    }

    const valid = await verifyPassword(password, user.password);
    if (!valid) {
      log.warn("Senha inválida", { email });
      return Response.json({ error: "Credenciais inválidas" }, { status: 401 });
    }

    const sessionUser: SessionUser = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
    };

    const token = createToken(sessionUser);
    const cookieStore = await cookies();
    cookieStore.set("auth-token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7,
      path: "/",
    });

    log.info("Login bem-sucedido", { userId: user.id, role: user.role });
    return Response.json(sessionUser);
  } catch (err) {
    log.error("Erro no login", { error: String(err) });
    return Response.json({ error: "Erro interno" }, { status: 500 });
  }
}
