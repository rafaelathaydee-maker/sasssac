import { NextFunction, Request, Response } from "express";
import { prisma } from "../lib/prisma";
import { env } from "../config/env";

export interface TenantInfo {
  id: string;
  slug: string;
  name: string;
  isSuspended: boolean;
}

export interface TenantRequest extends Request {
  tenant?: TenantInfo | null;
}

/**
 * Descobre de qual empresa é essa requisição olhando o subdomínio do Host.
 * Ex: empresa.saaschat.com -> slug "empresa".
 *
 * Em desenvolvimento (sem DNS de verdade) também aceita:
 * - empresa.localhost:5173 (subdomínio funciona nativamente no navegador)
 * - header X-Company-Slug (usado pelo frontend quando não há subdomínio, ex: localhost puro)
 */
function extractSlugFromHost(host: string): string | null {
  const hostname = host.split(":")[0];

  if (hostname.endsWith(`.${env.rootDomain}`)) {
    return hostname.slice(0, -(env.rootDomain.length + 1)) || null;
  }
  if (hostname.endsWith(".localhost")) {
    const sub = hostname.slice(0, -".localhost".length);
    return sub || null;
  }
  return null;
}

export async function resolveTenant(req: TenantRequest, res: Response, next: NextFunction) {
  const host = req.headers.host || "";
  const slug = extractSlugFromHost(host) || (req.headers["x-company-slug"] as string | undefined) || null;

  if (!slug) {
    req.tenant = null;
    return next();
  }

  const company = await prisma.company.findUnique({ where: { slug } });
  req.tenant = company
    ? { id: company.id, slug: company.slug, name: company.name, isSuspended: company.isSuspended }
    : null;
  next();
}
