import { Response } from "express";
import { prisma } from "../../lib/prisma";
import { AuthenticatedRequest } from "../../middlewares/auth";
import { getIO } from "../../realtime/socket";
import { logAudit } from "../../lib/audit";

const VALID_STATUSES = ["OPEN", "IN_PROGRESS", "RESOLVED"] as const;
type Status = (typeof VALID_STATUSES)[number];

function companyRoom(companyId: string | null) {
  return `company:${companyId}`;
}

// GET /api/conversations?filter=unassigned|mine|all&status=&agentId=&search=
export async function listConversations(req: AuthenticatedRequest, res: Response) {
  const { companyId, userId, role } = req.auth!;
  let filter = (req.query.filter as string) || "all";
  const status = req.query.status as Status | undefined;
  let agentId = req.query.agentId as string | undefined;
  const search = (req.query.search as string | undefined)?.trim();

  // Permissão: AGENT só vê o que é dele ou o que está sem responsável (fila pra pegar).
  // "Todas as conversas" e "filtrar por outro agente" são exclusivos de ADMIN/SUPER_ADMIN.
  if (role === "AGENT") {
    if (filter === "all") filter = "mine";
    agentId = undefined;
  }
  const departmentId = req.query.departmentId as string | undefined;

  const where: Record<string, any> = { companyId };
  if (filter === "unassigned") where.assignedUserId = null;
  if (filter === "mine") where.assignedUserId = userId;
  if (agentId) where.assignedUserId = agentId; // filtro explícito por agente (tela "Todas")
  if (status && VALID_STATUSES.includes(status)) where.status = status;
  if (departmentId === "mine") {
    const me = await prisma.user.findUnique({ where: { id: userId! }, include: { departments: { select: { id: true } } } });
    where.departmentId = { in: me?.departments.map((d: any) => d.id) || [] };
  } else if (departmentId) {
    where.departmentId = departmentId;
  }

  // AGENT só vê, na fila "sem responsável", conversas sem departamento ou do(s) seu(s) departamento(s)
  if (role === "AGENT" && filter === "unassigned") {
    const me = await prisma.user.findUnique({ where: { id: userId! }, include: { departments: { select: { id: true } } } });
    const myDeptIds = me?.departments.map((d: any) => d.id) || [];
    where.OR = [{ departmentId: null }, ...(myDeptIds.length ? [{ departmentId: { in: myDeptIds } }] : [])];
  }

  if (search) {
    where.OR = [
      { contact: { name: { contains: search, mode: "insensitive" } } },
      { contact: { email: { contains: search, mode: "insensitive" } } },
      { contact: { phone: { contains: search, mode: "insensitive" } } },
      { messages: { some: { content: { contains: search, mode: "insensitive" } } } },
    ];
  }

  const conversations = await prisma.conversation.findMany({
    where,
    include: {
      contact: true,
      assignedUser: { select: { id: true, name: true } },
      department: { select: { id: true, name: true } },
      messages: { orderBy: { createdAt: "desc" }, take: 1 },
    },
    orderBy: [{ isPinned: "desc" }, { lastMessageAt: "desc" }, { createdAt: "desc" }],
  });

  return res.json(
    conversations.map((c: any) => ({
      id: c.id,
      status: c.status,
      contact: c.contact,
      assignedUser: c.assignedUser,
      lastMessage: c.messages[0] || null,
      updatedAt: c.updatedAt,
      isPinned: c.isPinned,
      isFavorite: c.isFavorite,
      priority: c.priority,
      department: c.department,
    }))
  );
}

// GET /api/conversations/summary -> contadores pra badges da inbox (não-resolvidas)
export async function getSummary(req: AuthenticatedRequest, res: Response) {
  const { companyId, userId } = req.auth!;

  const [unassigned, mine, open] = await Promise.all([
    prisma.conversation.count({ where: { companyId, assignedUserId: null, status: { not: "RESOLVED" } } }),
    prisma.conversation.count({ where: { companyId, assignedUserId: userId, status: { not: "RESOLVED" } } }),
    prisma.conversation.count({ where: { companyId, status: "OPEN" } }),
  ]);

  return res.json({ unassigned, mine, pending: open });
}

// GET /api/conversations/:id
export async function getConversation(req: AuthenticatedRequest, res: Response) {
  const { companyId, userId, role } = req.auth!;
  const { id } = req.params;

  const conversation = await prisma.conversation.findFirst({
    where: { id, companyId },
    include: { contact: true, assignedUser: { select: { id: true, name: true } }, department: { select: { id: true, name: true } } },
  });

  if (!conversation) return res.status(404).json({ error: "Conversa não encontrada" });
  if (role === "AGENT" && conversation.assignedUserId && conversation.assignedUserId !== userId) {
    return res.status(403).json({ error: "Essa conversa está atribuída a outro agente" });
  }
  return res.json(conversation);
}

async function broadcastMetaUpdate(companyId: string | null, conversationId: string) {
  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    include: { assignedUser: { select: { id: true, name: true } } },
  });
  if (!conversation) return;
  const payload = {
    conversationId,
    status: conversation.status,
    assignedUser: conversation.assignedUser,
    isPinned: conversation.isPinned,
    isFavorite: conversation.isFavorite,
    priority: conversation.priority,
  };
  getIO().to(companyRoom(companyId)).emit("conversation:meta_updated", payload);
  getIO().to(`conversation:${conversationId}`).emit("conversation:meta_updated", payload);
  return conversation;
}

// POST /api/conversations/:id/claim -> agente "pega" a conversa pra si
export async function claimConversation(req: AuthenticatedRequest, res: Response) {
  const { companyId, userId } = req.auth!;
  const { id } = req.params;

  const conversation = await prisma.conversation.findFirst({ where: { id, companyId } });
  if (!conversation) return res.status(404).json({ error: "Conversa não encontrada" });

  if (req.auth!.role === "AGENT" && conversation.departmentId) {
    const me = await prisma.user.findFirst({ where: { id: userId!, departments: { some: { id: conversation.departmentId } } } });
    if (!me) return res.status(403).json({ error: "Essa conversa é de um departamento que você não pertence" });
  }

  await prisma.conversation.update({
    where: { id },
    data: { assignedUserId: userId, status: "IN_PROGRESS" },
  });
  await logAudit({ actorUserId: userId, actorRole: req.auth!.role, companyId, action: "conversation.claim", targetType: "conversation", targetId: id });

  const updated = await broadcastMetaUpdate(companyId, id);
  return res.json(updated);
}

// POST /api/conversations/:id/release -> agente "solta" a conversa (volta pra fila sem responsável)
export async function releaseConversation(req: AuthenticatedRequest, res: Response) {
  const { companyId } = req.auth!;
  const { id } = req.params;

  const conversation = await prisma.conversation.findFirst({ where: { id, companyId } });
  if (!conversation) return res.status(404).json({ error: "Conversa não encontrada" });

  await prisma.conversation.update({
    where: { id },
    data: { assignedUserId: null, status: "OPEN" },
  });
  await logAudit({ actorUserId: req.auth!.userId, actorRole: req.auth!.role, companyId, action: "conversation.release", targetType: "conversation", targetId: id });

  const updated = await broadcastMetaUpdate(companyId, id);
  return res.json(updated);
}

// POST /api/conversations/:id/assign  { userId } -> atribui a um colega específico (transferência)
export async function assignConversation(req: AuthenticatedRequest, res: Response) {
  const { companyId } = req.auth!;
  const { id } = req.params;
  const { userId: targetUserId } = req.body as { userId?: string };

  if (!targetUserId) return res.status(400).json({ error: "userId é obrigatório" });

  const conversation = await prisma.conversation.findFirst({ where: { id, companyId } });
  if (!conversation) return res.status(404).json({ error: "Conversa não encontrada" });

  const targetUser = await prisma.user.findFirst({ where: { id: targetUserId, companyId }, include: { departments: { select: { id: true } } } });
  if (!targetUser) return res.status(404).json({ error: "Agente não encontrado nesta empresa" });
  if (conversation.departmentId && !targetUser.departments.some((d: any) => d.id === conversation.departmentId)) {
    return res.status(400).json({ error: "Esse agente não pertence ao departamento desta conversa" });
  }

  await prisma.conversation.update({
    where: { id },
    data: { assignedUserId: targetUserId, status: "IN_PROGRESS" },
  });
  await logAudit({ actorUserId: req.auth!.userId, actorRole: req.auth!.role, companyId, action: "conversation.assign", targetType: "conversation", targetId: id, metadata: { targetUserId } });

  const updated = await broadcastMetaUpdate(companyId, id);
  return res.json(updated);
}

// PATCH /api/conversations/:id/status  { status }
export async function updateStatus(req: AuthenticatedRequest, res: Response) {
  const { companyId } = req.auth!;
  const { id } = req.params;
  const { status } = req.body as { status?: Status };

  if (!status || !VALID_STATUSES.includes(status)) {
    return res.status(400).json({ error: `status deve ser um de: ${VALID_STATUSES.join(", ")}` });
  }

  const conversation = await prisma.conversation.findFirst({ where: { id, companyId } });
  if (!conversation) return res.status(404).json({ error: "Conversa não encontrada" });

  await prisma.conversation.update({
    where: { id },
    data: { status, ...(status === "RESOLVED" ? { resolvedAt: new Date() } : {}) },
  });

  const updated = await broadcastMetaUpdate(companyId, id);
  return res.json(updated);
}

// POST /api/conversations/:id/pin | /unpin
export async function setPinned(req: AuthenticatedRequest, res: Response, pinned: boolean) {
  const { companyId } = req.auth!;
  const { id } = req.params;
  const conversation = await prisma.conversation.findFirst({ where: { id, companyId } });
  if (!conversation) return res.status(404).json({ error: "Conversa não encontrada" });

  await prisma.conversation.update({ where: { id }, data: { isPinned: pinned } });
  const updated = await broadcastMetaUpdate(companyId, id);
  return res.json(updated);
}

// POST /api/conversations/:id/favorite | /unfavorite
export async function setFavorite(req: AuthenticatedRequest, res: Response, favorite: boolean) {
  const { companyId } = req.auth!;
  const { id } = req.params;
  const conversation = await prisma.conversation.findFirst({ where: { id, companyId } });
  if (!conversation) return res.status(404).json({ error: "Conversa não encontrada" });

  await prisma.conversation.update({ where: { id }, data: { isFavorite: favorite } });
  const updated = await broadcastMetaUpdate(companyId, id);
  return res.json(updated);
}

const VALID_PRIORITIES = ["LOW", "NORMAL", "HIGH", "URGENT"] as const;

// PATCH /api/conversations/:id/priority { priority }
export async function updatePriority(req: AuthenticatedRequest, res: Response) {
  const { companyId } = req.auth!;
  const { id } = req.params;
  const { priority } = req.body as { priority?: string };

  if (!priority || !VALID_PRIORITIES.includes(priority as any)) {
    return res.status(400).json({ error: `priority deve ser um de: ${VALID_PRIORITIES.join(", ")}` });
  }

  const conversation = await prisma.conversation.findFirst({ where: { id, companyId } });
  if (!conversation) return res.status(404).json({ error: "Conversa não encontrada" });

  await prisma.conversation.update({ where: { id }, data: { priority: priority as any } });
  const updated = await broadcastMetaUpdate(companyId, id);
  return res.json(updated);
}
