import { PrismaClient } from "@/generated/prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import path from "path";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

function getDbPath(): string {
  const dbUrl = process.env.DATABASE_URL;
  if (dbUrl) {
    return dbUrl.replace(/^file:/, "");
  }
  return path.join(process.cwd(), "dev.db");
}

function createPrismaClient() {
  const dbPath = getDbPath();
  const adapter = new PrismaBetterSqlite3({ url: dbPath });
  return new PrismaClient({ adapter });
}

export const prisma = globalForPrisma.prisma || createPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
