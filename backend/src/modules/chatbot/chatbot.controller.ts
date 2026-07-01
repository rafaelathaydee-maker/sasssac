import { Response } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma";
import { AuthenticatedRequest } from "../../middlewares/auth";
import { NotFoundError } from "../../lib/errors";
import { logAudit } from "../../lib/audit";

export async function listFlows(req: AuthenticatedRequest, res: Response) {
  const { companyId } = req.auth!;
  const flows = await prisma.chatbotFlow.findMany({ where: { companyId }, orderBy: { updatedAt: "desc" } });
  return res.json(flows);
}

export async function getFlow(req: AuthenticatedRequest, res: Response) {
  const { companyId } = req.auth!;
  const flow = await prisma.chatbotFlow.findFirst({ where: { id: req.params.id, companyId } });
  if (!flow) throw new NotFoundError("Fluxo não encontrado");
  return res.json(flow);
}

const nodeSchema = z.object({
  id: z.string(),
  type: z.enum(["START", "MESSAGE", "QUESTION", "OPTIONS", "ROUTE_DEPARTMENT", "TRANSFER_HUMAN"]),
  data: z.record(z.any()),
  position: z.object({ x: z.number(), y: z.number() }).optional(),
});
const edgeSchema = z.object({ id: z.string(), source: z.string(), target: z.string(), sourceHandle: z.string().optional() });

const saveSchema = z.object({
  name: z.string().min(1),
  channels: z.array(z.enum(["WEBCHAT", "WHATSAPP", "INSTAGRAM"])).default([]),
  nodes: z.array(nodeSchema).default([]),
  edges: z.array(edgeSchema).default([]),
  isActive: z.boolean().optional(),
});

export async function createFlow(req: AuthenticatedRequest, res: Response) {
  const { companyId } = req.auth!;
  const data = saveSchema.parse(req.body);
  const flow = await prisma.chatbotFlow.create({ data: { companyId, ...data } });
  await logAudit({ actorUserId: req.auth!.userId, actorRole: "ADMIN", companyId, action: "chatbot.flow.create", targetType: "chatbotFlow", targetId: flow.id, metadata: { name: data.name } });
  return res.status(201).json(flow);
}

export async function updateFlow(req: AuthenticatedRequest, res: Response) {
  const { companyId } = req.auth!;
  const { id } = req.params;
  const data = saveSchema.partial().parse(req.body);

  const flow = await prisma.chatbotFlow.findFirst({ where: { id, companyId } });
  if (!flow) throw new NotFoundError("Fluxo não encontrado");

  const updated = await prisma.chatbotFlow.update({ where: { id }, data });
  await logAudit({ actorUserId: req.auth!.userId, actorRole: "ADMIN", companyId, action: "chatbot.flow.update", targetType: "chatbotFlow", targetId: id });
  return res.json(updated);
}

export async function deleteFlow(req: AuthenticatedRequest, res: Response) {
  const { companyId } = req.auth!;
  const { id } = req.params;
  const flow = await prisma.chatbotFlow.findFirst({ where: { id, companyId } });
  if (!flow) throw new NotFoundError("Fluxo não encontrado");
  await prisma.chatbotFlow.delete({ where: { id } });
  await logAudit({ actorUserId: req.auth!.userId, actorRole: "ADMIN", companyId, action: "chatbot.flow.delete", targetType: "chatbotFlow", targetId: id });
  return res.status(204).send();
}
