import { Response } from "express";
import { prisma } from "../../lib/prisma";
import { AuthenticatedRequest } from "../../middlewares/auth";

// GET /api/reports/agents -> atendimentos, tempo médio de resolução e nota por agente
export async function agentReport(req: AuthenticatedRequest, res: Response) {
  const { companyId } = req.auth!;
  const agents = await prisma.user.findMany({
    where: { companyId, role: { in: ["ADMIN", "AGENT"] } },
    select: { id: true, name: true },
  });

  const result = await Promise.all(
    agents.map(async (a: any) => {
      const totalConversations = await prisma.conversation.count({ where: { companyId, assignedUserId: a.id } });

      const resolved = await prisma.conversation.findMany({
        where: { companyId, assignedUserId: a.id, status: "RESOLVED", resolvedAt: { not: null } },
        select: { createdAt: true, resolvedAt: true },
      });
      const avgMs = resolved.length
        ? resolved.reduce((sum: number, c: any) => sum + (c.resolvedAt.getTime() - c.createdAt.getTime()), 0) / resolved.length
        : null;

      const ratingAgg = await prisma.conversation.aggregate({
        where: { companyId, assignedUserId: a.id, rating: { not: null } },
        _avg: { rating: true },
        _count: { rating: true },
      });

      return {
        agentId: a.id,
        agentName: a.name,
        totalConversations,
        resolvedCount: resolved.length,
        avgResolutionMinutes: avgMs !== null ? Math.round(avgMs / 60000) : null,
        avgRating: ratingAgg._avg.rating !== null ? Math.round((ratingAgg._avg.rating as number) * 10) / 10 : null,
        ratingCount: ratingAgg._count.rating,
      };
    })
  );

  return res.json(result);
}

// GET /api/reports/channels -> volume de conversas/mensagens por canal (WhatsApp x Webchat x Instagram)
export async function channelReport(req: AuthenticatedRequest, res: Response) {
  const { companyId } = req.auth!;
  const channels = ["WEBCHAT", "WHATSAPP", "INSTAGRAM"];

  const result = await Promise.all(
    channels.map(async (channel) => {
      const conversations = await prisma.conversation.count({ where: { companyId, channel: channel as any } });
      const messages = await prisma.message.count({ where: { conversation: { companyId, channel: channel as any } } });
      return { channel, conversations, messages };
    })
  );

  return res.json(result);
}

// GET /api/reports/peak-hours -> distribuição de mensagens por hora do dia (últimos 30 dias) pra achar o pico
export async function peakHoursReport(req: AuthenticatedRequest, res: Response) {
  const { companyId } = req.auth!;
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const messages = await prisma.message.findMany({
    where: { conversation: { companyId }, createdAt: { gte: since } },
    select: { createdAt: true },
  });

  const byHour = Array.from({ length: 24 }, () => 0);
  messages.forEach((m: any) => {
    byHour[new Date(m.createdAt).getHours()]++;
  });
  const peakHour = byHour.indexOf(Math.max(...byHour));

  return res.json({ byHour, peakHour, totalMessages: messages.length, sinceDate: since });
}
