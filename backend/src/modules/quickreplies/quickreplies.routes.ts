import { Router } from "express";
import { requireAuth, requireAdmin } from "../../middlewares/auth";
import { asyncHandler } from "../../lib/asyncHandler";
import { listQuickReplies, createQuickReply, updateQuickReply, deleteQuickReply } from "./quickreplies.controller";

const router = Router();
router.use(requireAuth);
router.get("/", asyncHandler(listQuickReplies));
router.post("/", requireAdmin, asyncHandler(createQuickReply));
router.patch("/:id", requireAdmin, asyncHandler(updateQuickReply));
router.delete("/:id", requireAdmin, asyncHandler(deleteQuickReply));

export default router;
