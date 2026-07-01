import { Response } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "../../lib/prisma";
import { AuthenticatedRequest } from "../../middlewares/auth";
import { AppError, NotFoundError } from "../../lib/errors";
import { assertAgentLimit } from "../../lib/planLimits";
import { logger } from "../../lib/logger";
import { logAudit } from "../../lib/audit";

// GET /api/users -> lista os agentes/admins da empresa logada (presença, gestão de equipe, "atribuir a")
export async function listCompanyUsers(req: AuthenticatedRequest, res: Response) {
  const { companyId } = req.auth!;

  const users = await prisma.user.findMany({
    where: { companyId },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      isOnline: true,
      isActive: true,
      lastSeenAt: true,
      departments: { select: { id: true, name: true } },
    },
    orderBy: [{ isActive: "desc" }, { isOnline: "desc" }, { name: "asc" }],
  });

  return res.json(users);
}

const createUserSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(6),
  role: z.enum(["ADMIN", "AGENT"]).optional(),
});

// POST /api/users -> admin cria um novo agente na empresa (checa limite do plano)
export async function createUser(req: AuthenticatedRequest, res: Response) {
  const { companyId } = req.auth!;
  const { name, email, password, role } = createUserSchema.parse(req.body);

  await assertAgentLimit(companyId);

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) throw new AppError("E-mail já cadastrado", 409);

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({
    data: { companyId, name, email, passwordHash, role: role || "AGENT" },
  });

  logger.info({ companyId, userId: user.id }, "Novo agente criado");
  await logAudit({ actorUserId: req.auth!.userId, actorRole: "ADMIN", companyId, action: "user.create", targetType: "user", targetId: user.id, metadata: { role: user.role } });

  return res.status(201).json({
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    isOnline: false,
    isActive: true,
  });
}

const updateUserSchema = z.object({
  name: z.string().min(2).optional(),
  email: z.string().email().optional(),
  role: z.enum(["ADMIN", "AGENT"]).optional(),
  isActive: z.boolean().optional(),
  password: z.string().min(6).optional(),
  departmentIds: z.array(z.string()).optional(),
});

// PATCH /api/users/:id -> admin edita agente (nome/email/role) e ativa/desativa
export async function updateUser(req: AuthenticatedRequest, res: Response) {
  const { companyId } = req.auth!;
  const { id } = req.params;
  const parsed = updateUserSchema.parse(req.body);

  const target = await prisma.user.findFirst({ where: { id, companyId } });
  if (!target) throw new NotFoundError("Agente não encontrado");

  // reativar alguém também precisa respeitar o limite do plano
  if (parsed.isActive === true && !target.isActive) {
    await assertAgentLimit(companyId);
  }

  const { password, departmentIds, ...rest } = parsed;
  const data: Record<string, any> = { ...rest };
  if (password) data.passwordHash = await bcrypt.hash(password, 10);
  if (departmentIds) data.departments = { set: departmentIds.map((id) => ({ id })) };

  if (rest.email && rest.email !== target.email) {
    const existing = await prisma.user.findUnique({ where: { email: rest.email } });
    if (existing) throw new AppError("E-mail já cadastrado", 409);
  }

  const updated = await prisma.user.update({ where: { id }, data });
  await logAudit({ actorUserId: req.auth!.userId, actorRole: "ADMIN", companyId, action: "user.update", targetType: "user", targetId: id, metadata: rest });

  return res.json({
    id: updated.id,
    name: updated.name,
    email: updated.email,
    role: updated.role,
    isOnline: updated.isOnline,
    isActive: updated.isActive,
  });
}

// DELETE /api/users/:id -> admin remove agente (histórico de mensagens é preservado)
export async function deleteUser(req: AuthenticatedRequest, res: Response) {
  const { companyId, userId: requesterId } = req.auth!;
  const { id } = req.params;

  if (id === requesterId) {
    throw new AppError("Você não pode remover seu próprio usuário", 400);
  }

  const target = await prisma.user.findFirst({ where: { id, companyId } });
  if (!target) throw new NotFoundError("Agente não encontrado");

  const activeAssigned = await prisma.conversation.count({
    where: { assignedUserId: id, status: { not: "RESOLVED" } },
  });
  if (activeAssigned > 0) {
    throw new AppError(`Esse agente ainda tem ${activeAssigned} conversa(s) em aberto. Transfira-as antes de remover.`, 409);
  }

  await prisma.user.delete({ where: { id } });
  logger.info({ companyId, userId: id }, "Agente removido");
  await logAudit({ actorUserId: requesterId, actorRole: "ADMIN", companyId, action: "user.delete", targetType: "user", targetId: id });
  return res.status(204).send();
}
