import { Router } from "express";
import { requireAuth, requireAdmin } from "../../middlewares/auth";
import { asyncHandler } from "../../lib/asyncHandler";
import { listCampaigns, getCampaign, createCampaign, cancelCampaign } from "./campaigns.controller";

const router = Router();
router.use(requireAuth, requireAdmin);
router.get("/", asyncHandler(listCampaigns));
router.post("/", asyncHandler(createCampaign));
router.get("/:id", asyncHandler(getCampaign));
router.post("/:id/cancel", asyncHandler(cancelCampaign));

export default router;
