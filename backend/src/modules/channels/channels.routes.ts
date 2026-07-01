import { Router } from "express";
import { requireAuth, requireAdmin } from "../../middlewares/auth";
import { asyncHandler } from "../../lib/asyncHandler";
import { connectWhatsappQr, getWhatsappQr, listChannels, upsertWhatsapp, removeWhatsapp } from "./channels.controller";

const router = Router();

router.use(requireAuth);
router.get("/", asyncHandler(listChannels));
router.get("/whatsapp/qr", requireAdmin, asyncHandler(getWhatsappQr));
router.post("/whatsapp/qr", requireAdmin, asyncHandler(connectWhatsappQr));
router.put("/whatsapp", requireAdmin, asyncHandler(upsertWhatsapp));
router.delete("/whatsapp", requireAdmin, asyncHandler(removeWhatsapp));

export default router;
