import { prisma } from "@/lib/db";
import { hashPassword, createToken, type SessionUser } from "@/lib/auth";
import { cookies } from "next/headers";

export async function POST(req: Request) {
  const { name, email, password } = await req.json();

  if (!name || !email || !password) {
    return Response.json({ error: "Campos obrigatórios" }, { status: 400 });
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return Response.json({ error: "Email já cadastrado" }, { status: 409 });
  }

  const hashed = await hashPassword(password);
  const isAdmin = email === "rocketmidia09@gmail.com";

  const user = await prisma.user.create({
    data: {
      name,
      email,
      password: hashed,
      role: isAdmin ? "admin" : "client",
      emailVerified: true, // MVP: skip email verification
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

  return Response.json(sessionUser);
}
