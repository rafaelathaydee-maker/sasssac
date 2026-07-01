import { NextFunction, Response } from "express";
import { verifyToken, AuthTokenPayload } from "../lib/jwt";
import { prisma } from "../lib/prisma";
import { TenantRequest } from "./tenant";

export interface AuthenticatedRequest extends TenantRequest {
  auth?: AuthTokenPayload;
}

export async function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Token não informado" });
  }
  const token = header.replace("Bearer ", "");

  try {
    const payload = verifyToken(token);

    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: { isActive: true, companyId: true, company: { select: { isSuspended: true } } },
    });
    if (!user || !user.isActive) {
      return res.status(401).json({ error: "Sessão inválida. Faça login novamente." });
    }
    if (user.company?.isSuspended) {
      return res.status(403).json({ error: "Esta empresa está suspensa. Fale com o administrador da plataforma." });
    }

    // Isolamento por subdomínio: se a requisição chegou por um subdomínio de empresa,
    // o usuário logado PRECISA pertencer a essa empresa (token de uma empresa não serve
    // pra navegar no painel de outra, mesmo que seja válido).
    if (payload.role !== "SUPER_ADMIN" && req.tenant && req.tenant.id !== payload.companyId) {
      return res.status(403).json({ error: "Esse usuário não pertence a esta empresa" });
    }

    req.auth = payload;
    next();
  } catch (err) {
    return res.status(401).json({ error: "Token inválido ou expirado" });
  }
}

// Dono/gestor da própria empresa (não confundir com o super admin da plataforma).
export function requireAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  if (req.auth?.role !== "ADMIN") {
    return res.status(403).json({ error: "Apenas administradores podem acessar essa rota" });
  }
  next();
}

// Eu — administra a plataforma inteira, fora do escopo de qualquer empresa.
export function requireSuperAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  if (req.auth?.role !== "SUPER_ADMIN") {
    return res.status(403).json({ error: "Apenas o administrador da plataforma pode acessar essa rota" });
  }
  next();
}

// Tenta autenticar, mas NUNCA bloqueia se não houver token — usado em rotas que
// precisam de regra extra só quando logado (ex: servir upload), mas também são
// acessadas sem login (cliente do widget vendo mídia que o agente mandou).
export async function optionalAuth(req: AuthenticatedRequest, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) return next();
  try {
    req.auth = verifyToken(header.replace("Bearer ", ""));
  } catch {
    // token inválido em rota opcional: ignora e segue sem auth, não bloqueia
  }
  next();
}
