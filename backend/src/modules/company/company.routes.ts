import { Router } from "express";
import { requireAuth, requireAdmin } from "../../middlewares/auth";
import { asyncHandler } from "../../lib/asyncHandler";
import { getCompany, updateCompany, getUsage, changePlan, exportOwnData, updateBranding, getOwnAuditLogs } from "./company.controller";

const router = Router();

router.use(requireAuth);
router.get("/", asyncHandler(getCompany));
router.patch("/", requireAdmin, asyncHandler(updateCompany));
router.get("/usage", asyncHandler(getUsage));
router.patch("/plan", requireAdmin, asyncHandler(changePlan));
router.get("/export", requireAdmin, asyncHandler(exportOwnData));
router.patch("/branding", requireAdmin, asyncHandler(updateBranding));
router.get("/audit-logs", requireAdmin, asyncHandler(getOwnAuditLogs));

export default router;
