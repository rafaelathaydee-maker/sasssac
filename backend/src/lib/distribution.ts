import { prisma } from "./prisma";

export async function pickNextAgentForDistribution(companyId: string) {
  return prisma.user.findFirst({
    where: { companyId, role: "AGENT", isActive: true },
    orderBy: { updatedAt: "asc" },
    select: { id: true, name: true, email: true, isOnline: true },
  });
}

