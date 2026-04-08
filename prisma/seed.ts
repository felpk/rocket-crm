import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import bcrypt from "bcryptjs";
import path from "path";

const dbPath = path.join(process.cwd(), "dev.db");
console.log("DB path:", dbPath);

const adapter = new PrismaBetterSqlite3({ url: dbPath });
const prisma = new PrismaClient({ adapter });

async function main() {
  const adminEmail = "rocketmidia09@gmail.com";

  const existing = await prisma.user.findUnique({
    where: { email: adminEmail },
  });

  if (!existing) {
    const hashedPassword = await bcrypt.hash("admin123", 12);
    await prisma.user.create({
      data: {
        name: "Rocket Mídia",
        email: adminEmail,
        password: hashedPassword,
        role: "admin",
        emailVerified: true,
        company: "Rocket Mídia",
      },
    });
    console.log("Admin criado: rocketmidia09@gmail.com / admin123");
  } else {
    console.log("Admin já existe");
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
