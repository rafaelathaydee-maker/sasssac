import { Response } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma";
import { AuthenticatedRequest } from "../../middlewares/auth";
import { AppError, NotFoundError } from "../../lib/errors";

export async function listQuickReplies(req: AuthenticatedRequest, res: Response) {
  const { companyId } = req.auth!;
  const items = await prisma.quickReply.findMany({ where: { companyId }, orderBy: { shortcut: "asc" } });
  return res.json(items);
}

const createSchema = z.object({
  title: z.string().min(1),
  shortcut: z.string().min(1).regex(/^[a-z0-9_-]+$/i, "Use apenas letras, números, - ou _"),
  message: z.string().min(1),
});

export async function createQuickReply(req: AuthenticatedRequest, res: Response) {
  const { companyId } = req.auth!;
  const data = createSchema.parse(req.body);

  const existing = await prisma.quickReply.findFirst({ where: { companyId, shortcut: data.shortcut } });
  if (existing) throw new AppError("Já existe uma resposta rápida com esse atalho", 409);

  const item = await prisma.quickReply.create({ data: { companyId, ...data } });
  return res.status(201).json(item);
}

const updateSchema = z.object({
  title: z.string().min(1).optional(),
  shortcut: z.string().min(1).regex(/^[a-z0-9_-]+$/i).optional(),
  message: z.string().min(1).optional(),
});

export async function updateQuickReply(req: AuthenticatedRequest, res: Response) {
  const { companyId } = req.auth!;
  const { id } = req.params;
  const data = updateSchema.parse(req.body);

  const item = await prisma.quickReply.findFirst({ where: { id, companyId } });
  if (!item) throw new NotFoundError("Resposta rápida não encontrada");

  const updated = await prisma.quickReply.update({ where: { id }, data });
  return res.json(updated);
}

export async function deleteQuickReply(req: AuthenticatedRequest, res: Response) {
  const { companyId } = req.auth!;
  const { id } = req.params;
  const item = await prisma.quickReply.findFirst({ where: { id, companyId } });
  if (!item) throw new NotFoundError("Resposta rápida não encontrada");
  await prisma.quickReply.delete({ where: { id } });
  return res.status(204).send();
}
