import { Router } from "express";
import { login, me } from "./auth.controller";
import { requireAuth } from "../../middlewares/auth";
import { asyncHandler } from "../../lib/asyncHandler";

const router = Router();

// Sem rota de cadastro público — empresas só são criadas pelo super admin (/api/admin).
router.post("/login", asyncHandler(login));
router.get("/me", requireAuth, asyncHandler(me));

export default router;
