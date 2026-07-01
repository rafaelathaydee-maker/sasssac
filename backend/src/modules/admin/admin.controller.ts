import { Response } from "express";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { z } from "zod";
import { prisma } from "../../lib/prisma";
import { AuthenticatedRequest } from "../../middlewares/auth";
import { AppError, NotFoundError } from "../../lib/errors";
import { getCompanyUsage } from "../../lib/planLimits";
import { logger } from "../../lib/logger";
import { logAudit } from "../../lib/audit";

function slugify(name: string): string {
  return name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

// GET /api/admin/companies -> visão geral de todas as empresas da plataforma
export async function listCompanies(_req: AuthenticatedRequest, res: Response) {
  const companies = await prisma.company.findMany({
    include: { plan: true, _count: { select: { users: true, conversations: true } } },
    orderBy: { createdAt: "desc" },
  });

  return res.json(
    companies.map((c: any) => ({
      id: c.id,
      name: c.name,
      slug: c.slug,
      isSuspended: c.isSuspended,
      createdAt: c.createdAt,
      plan: { id: c.plan.id, name: c.plan.name },
      agentCount: c._count.users,
      conversationCount: c._count.conversations,
    }))
  );
}

const createCompanySchema = z.object({
  name: z.string().min(2),
  slug: z.string().min(2).optional(), // se não vier, é derivado do nome
  planId: z.enum(["FREE", "BASIC", "PRO"]).optional(),
  adminName: z.string().min(2),
  adminEmail: z.string().email(),
  adminPassword: z.string().min(6),
});

// POST /api/admin/companies -> super admin cria a empresa e o admin dela manualmente
export async function createCompany(req: AuthenticatedRequest, res: Response) {
  const data = createCompanySchema.parse(req.body);

  const baseSlug = slugify(data.slug || data.name) || "empresa";
  let slug = baseSlug;
  let suffix = 1;
  while (await prisma.company.findUnique({ where: { slug } })) {
    slug = `${baseSlug}-${suffix++}`;
  }

  const existingUser = await prisma.user.findUnique({ where: { email: data.adminEmail } });
  if (existingUser) throw new AppError("E-mail já cadastrado", 409);

  const passwordHash = await bcrypt.hash(data.adminPassword, 10);
  const company = await prisma.company.create({
    data: {
      name: data.name,
      slug,
      planId: data.planId || "FREE",
      users: { create: { name: data.adminName, email: data.adminEmail, passwordHash, role: "ADMIN" } },
    },
    include: { users: true, plan: true },
  });

  logger.info({ companyId: company.id, slug }, "Empresa criada pelo super admin");
  await logAudit({ actorUserId: req.auth!.userId, actorRole: "SUPER_ADMIN", companyId: company.id, action: "company.create", targetType: "company", targetId: company.id, metadata: { slug } });

  return res.status(201).json({
    id: company.id,
    name: company.name,
    slug: company.slug,
    plan: { id: company.plan.id, name: company.plan.name },
    admin: { id: company.users[0].id, email: company.users[0].email },
  });
}

const updateCompanySchema = z.object({
  name: z.string().min(2).optional(),
  planId: z.enum(["FREE", "BASIC", "PRO"]).optional(),
});

// PATCH /api/admin/companies/:id
export async function updateCompany(req: AuthenticatedRequest, res: Response) {
  const { id } = req.params;
  const data = updateCompanySchema.parse(req.body);

  const company = await prisma.company.findUnique({ where: { id } });
  if (!company) throw new NotFoundError("Empresa não encontrada");

  const updated = await prisma.company.update({ where: { id }, data });
  await logAudit({ actorUserId: req.auth!.userId, actorRole: "SUPER_ADMIN", companyId: id, action: "company.update", targetType: "company", targetId: id, metadata: data });
  return res.json({ id: updated.id, name: updated.name, slug: updated.slug, planId: updated.planId });
}

// POST /api/admin/companies/:id/suspend | /activate
export async function setSuspended(req: AuthenticatedRequest, res: Response, suspended: boolean) {
  const { id } = req.params;
  const company = await prisma.company.findUnique({ where: { id } });
  if (!company) throw new NotFoundError("Empresa não encontrada");

  await prisma.company.update({ where: { id }, data: { isSuspended: suspended } });
  logger.info({ companyId: id, suspended }, "Status de suspensão alterado");
  await logAudit({ actorUserId: req.auth!.userId, actorRole: "SUPER_ADMIN", companyId: id, action: suspended ? "company.suspend" : "company.activate", targetType: "company", targetId: id });
  return res.json({ id, isSuspended: suspended });
}

// GET /api/admin/companies/:id -> detalhe completo (uso, canais, agentes) pro painel master
export async function getCompanyDetail(req: AuthenticatedRequest, res: Response) {
  const { id } = req.params;
  const company = await prisma.company.findUnique({ where: { id }, include: { plan: true } });
  if (!company) throw new NotFoundError("Empresa não encontrada");

  const [users, channels, usage] = await Promise.all([
    prisma.user.findMany({
      where: { companyId: id },
      select: { id: true, name: true, email: true, role: true, isActive: true, isOnline: true },
    }),
    prisma.channelConfig.findMany({ where: { companyId: id } }),
    getCompanyUsage(id),
  ]);

  return res.json({
    id: company.id,
    name: company.name,
    slug: company.slug,
    isSuspended: company.isSuspended,
    users,
    channels: channels.map((c: any) => ({ channel: c.channel, externalAccountId: c.externalAccountId, isActive: c.isActive })),
    usage,
  });
}

// GET /api/admin/audit-logs?companyId=&action=
export async function listAuditLogs(req: AuthenticatedRequest, res: Response) {
  const { companyId, action } = req.query as { companyId?: string; action?: string };
  const logs = await prisma.auditLog.findMany({
    where: { ...(companyId ? { companyId } : {}), ...(action ? { action } : {}) },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  return res.json(logs);
}

const createUserSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(6),
  role: z.enum(["ADMIN", "AGENT"]).default("AGENT"),
});

// POST /api/admin/companies/:id/users -> super admin cria usuário em qualquer empresa
export async function createUserInCompany(req: AuthenticatedRequest, res: Response) {
  const { id: companyId } = req.params;
  const data = createUserSchema.parse(req.body);

  const company = await prisma.company.findUnique({ where: { id: companyId } });
  if (!company) throw new NotFoundError("Empresa não encontrada");

  const existing = await prisma.user.findUnique({ where: { email: data.email } });
  if (existing) throw new AppError("E-mail já cadastrado", 409);

  const passwordHash = await bcrypt.hash(data.password, 10);
  const user = await prisma.user.create({ data: { companyId, name: data.name, email: data.email, passwordHash, role: data.role } });
  await logAudit({ actorUserId: req.auth!.userId, actorRole: "SUPER_ADMIN", companyId, action: "user.create", targetType: "user", targetId: user.id, metadata: { role: data.role } });

  return res.status(201).json({ id: user.id, name: user.name, email: user.email, role: user.role });
}

// POST /api/admin/users/:id/reset-password -> super admin reseta senha de qualquer usuário
// Sem senha no corpo, gera uma temporária aleatória e devolve (só essa vez) pro super admin passar pro cliente.
export async function resetPassword(req: AuthenticatedRequest, res: Response) {
  const { id } = req.params;
  const { password } = z.object({ password: z.string().min(6).optional() }).parse(req.body || {});

  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) throw new NotFoundError("Usuário não encontrado");

  const newPassword = password || crypto.randomBytes(6).toString("base64url");
  const passwordHash = await bcrypt.hash(newPassword, 10);
  await prisma.user.update({ where: { id }, data: { passwordHash } });

  logger.info({ userId: id }, "Senha resetada pelo super admin");
  await logAudit({ actorUserId: req.auth!.userId, actorRole: "SUPER_ADMIN", companyId: user.companyId, action: "user.reset_password", targetType: "user", targetId: id });
  return res.json({ id, temporaryPassword: newPassword });
}

// GET /api/admin/companies/:id/export -> dump completo (contatos, conversas, mensagens) pra backup
export async function exportCompanyData(req: AuthenticatedRequest, res: Response) {
  const { id: companyId } = req.params;
  const company = await prisma.company.findUnique({ where: { id: companyId } });
  if (!company) throw new NotFoundError("Empresa não encontrada");

  const [contacts, conversations, messages] = await Promise.all([
    prisma.contact.findMany({ where: { companyId } }),
    prisma.conversation.findMany({ where: { companyId } }),
    prisma.message.findMany({ where: { conversation: { companyId } } }),
  ]);

  await logAudit({ actorUserId: req.auth!.userId, actorRole: "SUPER_ADMIN", companyId, action: "company.export" });

  res.setHeader("Content-Disposition", `attachment; filename="${company.slug}-export.json"`);
  return res.json({ exportedAt: new Date().toISOString(), company, contacts, conversations, messages });
}
