import { Router } from "express";
import { startConversation, getBranding, listPublicDepartments, rateConversation } from "./contacts.controller";

const router = Router();

// Rotas públicas, sem auth — usadas pelo widget de webchat.
// Acessando via subdomínio (empresa.saaschat.com) nem precisa do slug na URL;
// o :companySlug continua existindo como fallback (embed fora do subdomínio).
router.get("/branding", getBranding);
router.get("/departments", listPublicDepartments);
router.get("/:companySlug/departments", listPublicDepartments);
router.post("/conversations/:conversationId/rating", rateConversation);
router.get("/:companySlug/branding", getBranding);
router.post("/conversations", startConversation);
router.post("/:companySlug/conversations", startConversation);

export default router;
