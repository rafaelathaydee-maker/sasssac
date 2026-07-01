import { Router } from "express";
import { requireAuth } from "../../middlewares/auth";
import { asyncHandler } from "../../lib/asyncHandler";
import { listPipeline, updateStage } from "./crm.controller";

const router = Router();
router.use(requireAuth);
router.get("/pipeline", asyncHandler(listPipeline));
router.patch("/contacts/:id/stage", asyncHandler(updateStage));

export default router;
