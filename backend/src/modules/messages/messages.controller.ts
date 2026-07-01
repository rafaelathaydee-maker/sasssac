import { Response } from "express";
import { prisma } from "../../lib/prisma";
import { AuthenticatedRequest } from "../../middlewares/auth";

const DEFAULT_PAGE_SIZE = 30;
const MAX_PAGE_SIZE = 100;

// GET /api/conversations/:conversationId/messages?before=<messageId>&limit=30
// Sem "before": retorna a página mais recente. Com "before": retorna mensagens
// mais antigas que aquela mensagem (pra paginação ao rolar pra cima).
export async function listMessages(req: AuthenticatedRequest, res: Response) {
  const { companyId } = req.auth!;
  const { conversationId } = req.params;
  const { before } = req.query as { before?: string };
  const limit = Math.min(Number(req.query.limit) || DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE);

  const conversation = await prisma.conversation.findFirst({
    where: { id: conversationId, companyId },
  });
  if (!conversation) return res.status(404).json({ error: "Conversa não encontrada" });

  let cursorDate: Date | undefined;
  if (before) {
    const cursorMessage = await prisma.message.findUnique({ where: { id: before } });
    cursorDate = cursorMessage?.createdAt;
  }

  const page = await prisma.message.findMany({
    where: {
      conversationId,
      ...(cursorDate ? { createdAt: { lt: cursorDate } } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: limit + 1, // +1 só pra saber se tem mais página depois dessa
  });

  const hasMore = page.length > limit;
  const messages = page.slice(0, limit).reverse(); // devolve em ordem cronológica

  return res.json({ messages, hasMore });
}
