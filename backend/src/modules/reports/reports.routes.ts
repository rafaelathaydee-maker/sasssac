import { Router } from "express";
import { requireAuth, requireAdmin } from "../../middlewares/auth";
import { asyncHandler } from "../../lib/asyncHandler";
import { agentReport, channelReport, peakHoursReport } from "./reports.controller";

const router = Router();
router.use(requireAuth, requireAdmin);
router.get("/agents", asyncHandler(agentReport));
router.get("/channels", asyncHandler(channelReport));
router.get("/peak-hours", asyncHandler(peakHoursReport));

export default router;
