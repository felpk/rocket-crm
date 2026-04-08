import { prisma } from "@/lib/db";
import { hashPassword, createToken, type SessionUser } from "@/lib/auth";
import { cookies } from "next/headers";
import { createLogger } from "@/lib/logger";

const log = createLogger("auth/register");

export async function POST(req: Request) {
  log.info("POST /api/auth/register — tentativa de cadastro");
  try {
    const { name, email, password } = await req.json();

    if (!name || !email || !password) {
      log.warn("Campos obrigatórios ausentes");
      return Response.json({ error: "Campos obrigatórios" }, { status: 400 });
    }

    log.debug("Verificando email existente", { email });
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      log.warn("Email já cadastrado", { email });
      return Response.json({ error: "Email já cadastrado" }, { status: 409 });
    }

    const hashed = await hashPassword(password);
    const isAdmin = email === "rocketmidia09@gmail.com";

    log.debug("Criando usuário", { email, role: isAdmin ? "admin" : "client" });
    const user = await prisma.user.create({
      data: {
        name,
        email,
        password: hashed,
        role: isAdmin ? "admin" : "client",
        emailVerified: true,
      },
    });

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

    log.info("Cadastro bem-sucedido", { userId: user.id, role: user.role });
    return Response.json(sessionUser);
  } catch (err) {
    log.error("Erro no cadastro", { error: String(err) });
    return Response.json({ error: "Erro interno" }, { status: 500 });
  }
}
