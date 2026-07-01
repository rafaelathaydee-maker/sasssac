import { Router } from "express";
import { requireAuth, requireAdmin } from "../../middlewares/auth";
import { asyncHandler } from "../../lib/asyncHandler";
import { listFlows, getFlow, createFlow, updateFlow, deleteFlow } from "./chatbot.controller";

const router = Router();
router.use(requireAuth, requireAdmin);
router.get("/", asyncHandler(listFlows));
router.post("/", asyncHandler(createFlow));
router.get("/:id", asyncHandler(getFlow));
router.patch("/:id", asyncHandler(updateFlow));
router.delete("/:id", asyncHandler(deleteFlow));

export default router;
