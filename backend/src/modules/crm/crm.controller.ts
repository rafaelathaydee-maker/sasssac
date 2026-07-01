import { Response } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma";
import { AuthenticatedRequest } from "../../middlewares/auth";
import { NotFoundError } from "../../lib/errors";
import { logAudit } from "../../lib/audit";

const STAGES = ["NEW_LEAD", "NEGOTIATION", "PROPOSAL", "WON", "LOST"] as const;

// GET /api/crm/pipeline -> todos os contatos da empresa, prontos pro board (agrupar no front)
export async function listPipeline(req: AuthenticatedRequest, res: Response) {
  const { companyId } = req.auth!;
  const contacts = await prisma.contact.findMany({
    where: { companyId },
    orderBy: { pipelineUpdatedAt: "desc" },
  });
  return res.json(contacts);
}

const updateStageSchema = z.object({ stage: z.enum(STAGES) });

// PATCH /api/crm/contacts/:id/stage -> move o contato de coluna no funil
export async function updateStage(req: AuthenticatedRequest, res: Response) {
  const { companyId } = req.auth!;
  const { id } = req.params;
  const { stage } = updateStageSchema.parse(req.body);

  const contact = await prisma.contact.findFirst({ where: { id, companyId } });
  if (!contact) throw new NotFoundError("Contato não encontrado");

  const updated = await prisma.contact.update({
    where: { id },
    data: { pipelineStage: stage, pipelineUpdatedAt: new Date() },
  });

  await logAudit({ actorUserId: req.auth!.userId, actorRole: req.auth!.role, companyId, action: "crm.stage.update", targetType: "contact", targetId: id, metadata: { stage } });
  return res.json(updated);
}
