import { Request, Response } from "express";
import { isWithinBusinessHours } from "../../lib/businessHours";
import { matchDepartmentByKeywords } from "../../lib/departmentRouting";
import { maybeStartBot } from "../../lib/chatbotRuntime";
import { z } from "zod";
import { prisma } from "../../lib/prisma";
import { getIO } from "../../realtime/socket";
import { pickNextAgentForDistribution } from "../../lib/distribution";
import { AuthenticatedRequest } from "../../middlewares/auth";
import { logAudit } from "../../lib/audit";

const startConversationSchema = z.object({
  name: z.string().min(1),
  email: z.string().email().optional(),
  phone: z.string().min(6).optional(),
  message: z.string().min(1),
  departmentId: z.string().optional(),
});

// POST /api/public/:companySlug/conversations (ou direto em empresa.saaschat.com/api/public/conversations)
// Usado pelo widget de webchat (cliente final, sem autenticação)
export async function startConversation(req: Request & { tenant?: { id: string } | null }, res: Response) {
  const { companySlug } = req.params;
  const parsed = startConversationSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }
  const { name, email, phone, message, departmentId } = parsed.data;

  // O subdomínio é a fonte de verdade; o slug na URL existe só pra quando o widget
  // é embutido num site de fora e não há subdomínio próprio acessível (ex: iframe).
  const company = req.tenant
    ? await prisma.company.findUnique({ where: { id: req.tenant.id } })
    : await prisma.company.findUnique({ where: { slug: companySlug } });
  if (!company) return res.status(404).json({ error: "Empresa não encontrada" });
  if (company.isSuspended) return res.status(403).json({ error: "Esta empresa está suspensa" });

  const contact = await prisma.contact.create({
    data: { companyId: company.id, name, email, phone },
  });

  let validDepartmentId: string | null = null;
  if (departmentId) {
    const dept = await prisma.department.findFirst({ where: { id: departmentId, companyId: company.id, active: true } });
    if (dept) validDepartmentId = dept.id;
  }
  if (!validDepartmentId) {
    validDepartmentId = await matchDepartmentByKeywords(company.id, message);
  }

  const conversation = await prisma.conversation.create({
    data: { companyId: company.id, contactId: contact.id, status: "OPEN", departmentId: validDepartmentId },
  });

  const firstMessage = await prisma.message.create({
    data: {
      conversationId: conversation.id,
      senderType: "CONTACT",
      contactId: contact.id,
      content: message,
    },
  });

  // Se a empresa tem um chatbot ativo pro webchat, ele que cuida da conversa primeiro —
  // a distribuição automática só entra quando o bot transferir pra humano.
  const hasBotFlow = await prisma.chatbotFlow.findFirst({ where: { companyId: company.id, isActive: true, channels: { has: "WEBCHAT" } } });
  const chosenAgent = hasBotFlow ? null : await pickNextAgentForDistribution(company.id, validDepartmentId);

  const updatedConversation = await prisma.conversation.update({
    where: { id: conversation.id },
    data: {
      lastMessageAt: firstMessage.createdAt,
      ...(chosenAgent ? { assignedUserId: chosenAgent.id, status: "IN_PROGRESS" } : {}),
    },
  });

  // Avisa em tempo real os agentes da empresa que uma nova conversa chegou
  getIO().to(`company:${company.id}`).emit("conversation:new", {
    id: conversation.id,
    status: updatedConversation.status,
    contact: { id: contact.id, name: contact.name, email: contact.email, phone: contact.phone, tags: contact.tags },
    assignedUser: chosenAgent,
    lastMessage: firstMessage,
  });

  if (hasBotFlow) {
    await maybeStartBot(conversation.id);
  }

  return res.status(201).json({
    conversationId: conversation.id,
    contactId: contact.id,
    companyId: company.id,
    message: firstMessage,
  });
}

const updateContactSchema = z.object({
  name: z.string().min(1).optional(),
  email: z.string().email().nullable().optional(),
  phone: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  tags: z.array(z.string().min(1)).optional(),
});

// PATCH /api/contacts/:id -> agente atualiza dados do cliente (telefone, observações, tags...)
export async function updateContact(req: AuthenticatedRequest, res: Response) {
  const { companyId } = req.auth!;
  const { id } = req.params;

  const parsed = updateContactSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const contact = await prisma.contact.findFirst({ where: { id, companyId } });
  if (!contact) return res.status(404).json({ error: "Cliente não encontrado" });

  const updated = await prisma.contact.update({ where: { id }, data: parsed.data });
  await logAudit({ actorUserId: req.auth!.userId, actorRole: req.auth!.role, companyId, action: "contact.update", targetType: "contact", targetId: id, metadata: parsed.data });
  return res.json(updated);
}

// GET /api/public/branding -> dados pro widget (logo, cor, mensagens, se está no horário)
export async function getBranding(req: Request & { tenant?: { id: string } | null }, res: Response) {
  const { companySlug } = req.params;
  const company = req.tenant
    ? await prisma.company.findUnique({ where: { id: req.tenant.id } })
    : await prisma.company.findUnique({ where: { slug: companySlug } });
  if (!company) return res.status(404).json({ error: "Empresa não encontrada" });

  return res.json({
    name: company.name,
    logoUrl: company.logoUrl,
    primaryColor: company.primaryColor,
    welcomeMessage: company.welcomeMessage,
    offlineMessage: company.offlineMessage,
    isOnline: isWithinBusinessHours(company.businessHours as any),
  });
}

// GET /api/public/departments -> lista departamentos ativos pro widget mostrar um seletor
export async function listPublicDepartments(req: Request & { tenant?: { id: string } | null }, res: Response) {
  const { companySlug } = req.params;
  const company = req.tenant
    ? await prisma.company.findUnique({ where: { id: req.tenant.id } })
    : await prisma.company.findUnique({ where: { slug: companySlug } });
  if (!company) return res.status(404).json({ error: "Empresa não encontrada" });

  const departments = await prisma.department.findMany({
    where: { companyId: company.id, active: true },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
  return res.json(departments);
}

const ratingSchema = z.object({ rating: z.number().int().min(1).max(5) });

// POST /api/public/conversations/:conversationId/rating -> cliente avalia o atendimento
export async function rateConversation(req: Request, res: Response) {
  const { conversationId } = req.params;
  const { rating } = ratingSchema.parse(req.body);

  const conversation = await prisma.conversation.findUnique({ where: { id: conversationId } });
  if (!conversation) return res.status(404).json({ error: "Conversa não encontrada" });

  await prisma.conversation.update({ where: { id: conversationId }, data: { rating, ratedAt: new Date() } });
  return res.json({ ok: true });
}
