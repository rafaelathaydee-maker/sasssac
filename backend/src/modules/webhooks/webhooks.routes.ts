import { Router } from "express";
import { getProvider } from "../../services/channels/registry";
import { handleEvolutionWebhook } from "../../services/channels/evolutionProvider";

const router = Router();

// Endpoint único (não por empresa) — a Meta manda tudo aqui, roteamos por dentro
// usando o phone_number_id de cada empresa (ver WhatsappProvider.handleWebhook).
router.get("/whatsapp", (req, res) => getProvider("WHATSAPP").handleWebhook(req, res));
router.post("/whatsapp", (req, res) => getProvider("WHATSAPP").handleWebhook(req, res));
router.post("/evolution/:companyId", handleEvolutionWebhook);

export default router;
