import { prisma } from "./prisma";
import { AppError } from "./errors";

export async function getCompanyUsage(companyId: string) {
  const [company, agents, conversationsThisMonth] = await Promise.all([
    prisma.company.findUnique({ where: { id: companyId }, include: { plan: true } }),
    prisma.user.count({ where: { companyId, role: "AGENT", isActive: true } }),
    prisma.conversation.count({
      where: {
        companyId,
        createdAt: { gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1) },
      },
    }),
  ]);

  return {
    plan: company?.plan || null,
    usage: { agents, conversationsThisMonth },
  };
}

export async function assertAgentLimit(companyId: string) {
  const usage = await getCompanyUsage(companyId);
  const limit = Number((usage.plan as any)?.maxAgents ?? Infinity);
  if (usage.usage.agents >= limit) throw new AppError("Limite de agentes atingido", 403);
}

export async function assertChannelAllowed(companyId: string, channel: string) {
  const company = await prisma.company.findUnique({ where: { id: companyId }, include: { plan: true } });
  const channels = ((company?.plan as any)?.channels || []) as string[];
  if (channels.length && !channels.includes(channel)) throw new AppError("Canal nao permitido no plano atual", 403);
}

