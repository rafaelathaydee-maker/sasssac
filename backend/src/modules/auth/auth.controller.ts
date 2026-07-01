import { Response } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "../../lib/prisma";
import { signToken } from "../../lib/jwt";
import { AuthenticatedRequest } from "../../middlewares/auth";
import { TenantRequest } from "../../middlewares/tenant";
import { AppError } from "../../lib/errors";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

// POST /api/auth/login
// Não existe mais cadastro público de empresa — login é o único jeito de entrar,
// e respeita o subdomínio: se a requisição veio de empresa.saaschat.com, só um
// usuário daquela empresa específica consegue logar ali, mesmo com senha certa.
export async function login(req: TenantRequest & AuthenticatedRequest, res: Response) {
  const { email, password } = loginSchema.parse(req.body);

  const user = await prisma.user.findUnique({ where: { email }, include: { company: true } });
  if (!user) throw new AppError("Credenciais inválidas", 401);

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) throw new AppError("Credenciais inválidas", 401);

  if (!user.isActive) {
    throw new AppError("Este usuário foi desativado. Fale com o administrador da sua empresa.", 403);
  }
  if (user.company?.isSuspended) {
    throw new AppError("Esta empresa está suspensa. Fale com o administrador da plataforma.", 403);
  }

  // SUPER_ADMIN só loga fora de qualquer subdomínio de empresa (domínio raiz).
  // Usuário de empresa só loga no subdomínio da própria empresa.
  if (req.tenant) {
    if (user.companyId !== req.tenant.id) {
      throw new AppError("Esse usuário não pertence a esta empresa", 403);
    }
  } else if (user.role !== "SUPER_ADMIN") {
    throw new AppError("Acesse pelo endereço da sua empresa (empresa.saaschat.com) para entrar.", 403);
  }

  const token = signToken({ userId: user.id, companyId: user.companyId, role: user.role });

  return res.json({
    token,
    user: { id: user.id, name: user.name, email: user.email, role: user.role },
    company: user.company ? { id: user.company.id, name: user.company.name, slug: user.company.slug } : null,
  });
}

export async function me(req: AuthenticatedRequest, res: Response) {
  const user = await prisma.user.findUnique({
    where: { id: req.auth!.userId },
    include: { company: true },
  });
  if (!user) throw new AppError("Usuário não encontrado", 404);

  return res.json({
    user: { id: user.id, name: user.name, email: user.email, role: user.role },
    company: user.company ? { id: user.company.id, name: user.company.name, slug: user.company.slug } : null,
  });
}
