import { prisma } from "./prisma";

export async function pickNextAgentForDistribution(companyId: string, departmentId?: string | null) {
  return prisma.user.findFirst({
    where: {
      companyId,
      role: "AGENT",
      isActive: true,
      ...(departmentId ? { departments: { some: { id: departmentId } } } : {}),
    },
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true, email: true, isOnline: true },
  });
}
