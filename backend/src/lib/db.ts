import { PrismaClient } from "@prisma/client";

// Single Prisma client per process (modular monolith).
export const prisma = new PrismaClient({
  log: process.env.NODE_ENV === "production" ? ["error"] : ["warn", "error"],
});
