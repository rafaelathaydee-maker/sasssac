import { Response } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma";
import { AuthenticatedRequest } from "../../middlewares/auth";
import { AppError, NotFoundError } from "../../lib/errors";
import { logAudit } from "../../lib/audit";

// GET /api/departments -> lista (todo agente pode ver, pra UI de filtro)
export async function listDepartments(req: AuthenticatedRequest, res: Response) {
  const { companyId } = req.auth!;
  const departments = await prisma.department.findMany({
    where: { companyId },
    include: { agents: { select: { id: true, name: true } } },
    orderBy: { name: "asc" },
  });
  return res.json(departments);
}

const createSchema = z.object({ name: z.string().min(2), description: z.string().optional(), keywords: z.array(z.string()).optional() });

// POST /api/departments -> admin cria
export async function createDepartment(req: AuthenticatedRequest, res: Response) {
  const { companyId } = req.auth!;
  const { name, description, keywords } = createSchema.parse(req.body);
  const dept = await prisma.department.create({ data: { companyId, name, description, keywords: keywords || [] } });
  await logAudit({ actorUserId: req.auth!.userId, actorRole: "ADMIN", companyId, action: "department.create", targetType: "department", targetId: dept.id, metadata: { name } });
  return res.status(201).json(dept);
}

const updateSchema = z.object({ name: z.string().min(2).optional(), description: z.string().optional(), active: z.boolean().optional(), keywords: z.array(z.string()).optional() });

// PATCH /api/departments/:id -> admin edita/ativa/desativa
export async function updateDepartment(req: AuthenticatedRequest, res: Response) {
  const { companyId } = req.auth!;
  const { id } = req.params;
  const data = updateSchema.parse(req.body);

  const dept = await prisma.department.findFirst({ where: { id, companyId } });
  if (!dept) throw new NotFoundError("Departamento não encontrado");

  const updated = await prisma.department.update({ where: { id }, data });
  await logAudit({ actorUserId: req.auth!.userId, actorRole: "ADMIN", companyId, action: "department.update", targetType: "department", targetId: id, metadata: data });
  return res.json(updated);
}

// POST /api/departments/:id/agents -> admin define quais agentes pertencem ao departamento
const setAgentsSchema = z.object({ agentIds: z.array(z.string()) });
export async function setDepartmentAgents(req: AuthenticatedRequest, res: Response) {
  const { companyId } = req.auth!;
  const { id } = req.params;
  const { agentIds } = setAgentsSchema.parse(req.body);

  const dept = await prisma.department.findFirst({ where: { id, companyId } });
  if (!dept) throw new NotFoundError("Departamento não encontrado");

  const validAgents = await prisma.user.findMany({ where: { id: { in: agentIds }, companyId } });
  if (validAgents.length !== agentIds.length) throw new AppError("Algum agente informado não pertence a esta empresa", 400);

  const updated = await prisma.department.update({
    where: { id },
    data: { agents: { set: agentIds.map((agentId) => ({ id: agentId })) } },
    include: { agents: { select: { id: true, name: true } } },
  });
  await logAudit({ actorUserId: req.auth!.userId, actorRole: "ADMIN", companyId, action: "department.set_agents", targetType: "department", targetId: id, metadata: { agentIds } });
  return res.json(updated);
}

// GET /api/departments/:id/agents -> lista agentes do departamento
export async function listDepartmentAgents(req: AuthenticatedRequest, res: Response) {
  const { companyId } = req.auth!;
  const { id } = req.params;
  const dept = await prisma.department.findFirst({
    where: { id, companyId },
    include: { agents: { select: { id: true, name: true, email: true, role: true, isOnline: true } } },
  });
  if (!dept) throw new NotFoundError("Departamento não encontrado");
  return res.json(dept.agents);
}

// POST /api/departments/:id/agents/:agentId -> adiciona 1 agente
export async function addDepartmentAgent(req: AuthenticatedRequest, res: Response) {
  const { companyId } = req.auth!;
  const { id, agentId } = req.params;

  const dept = await prisma.department.findFirst({ where: { id, companyId } });
  if (!dept) throw new NotFoundError("Departamento não encontrado");
  const agent = await prisma.user.findFirst({ where: { id: agentId, companyId } });
  if (!agent) throw new NotFoundError("Agente não encontrado nesta empresa");

  const updated = await prisma.department.update({
    where: { id },
    data: { agents: { connect: { id: agentId } } },
    include: { agents: { select: { id: true, name: true } } },
  });
  await logAudit({ actorUserId: req.auth!.userId, actorRole: "ADMIN", companyId, action: "department.agent.add", targetType: "department", targetId: id, metadata: { agentId } });
  return res.json(updated);
}

// DELETE /api/departments/:id/agents/:agentId -> remove 1 agente
export async function removeDepartmentAgent(req: AuthenticatedRequest, res: Response) {
  const { companyId } = req.auth!;
  const { id, agentId } = req.params;

  const dept = await prisma.department.findFirst({ where: { id, companyId } });
  if (!dept) throw new NotFoundError("Departamento não encontrado");

  const updated = await prisma.department.update({
    where: { id },
    data: { agents: { disconnect: { id: agentId } } },
    include: { agents: { select: { id: true, name: true } } },
  });
  await logAudit({ actorUserId: req.auth!.userId, actorRole: "ADMIN", companyId, action: "department.agent.remove", targetType: "department", targetId: id, metadata: { agentId } });
  return res.json(updated);
}

// DELETE /api/departments/:id -> remove o departamento (conversas ficam sem departamento, não some nada)
export async function deleteDepartment(req: AuthenticatedRequest, res: Response) {
  const { companyId } = req.auth!;
  const { id } = req.params;
  const dept = await prisma.department.findFirst({ where: { id, companyId } });
  if (!dept) throw new NotFoundError("Departamento não encontrado");

  await prisma.conversation.updateMany({ where: { departmentId: id }, data: { departmentId: null } });
  await prisma.channelConfig.updateMany({ where: { departmentId: id }, data: { departmentId: null } });
  await prisma.department.delete({ where: { id } });

  await logAudit({ actorUserId: req.auth!.userId, actorRole: "ADMIN", companyId, action: "department.delete", targetType: "department", targetId: id });
  return res.status(204).send();
}
