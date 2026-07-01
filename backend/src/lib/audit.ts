import { prisma } from "./prisma";

type AuditInput = {
  actorUserId?: string;
  actorRole?: string;
  companyId?: string;
  action: string;
  targetType?: string;
  targetId?: string;
  metadata?: unknown;
};

export async function logAudit(input: AuditInput) {
  return prisma.auditLog.create({
    data: {
      actorUserId: input.actorUserId,
      actorRole: input.actorRole,
      companyId: input.companyId,
      action: input.action,
      targetType: input.targetType,
      targetId: input.targetId,
      metadata: input.metadata as any,
    },
  }).catch(() => null);
}

