import { Router } from "express";
import { getProvider } from "../../services/channels/registry";

const router = Router();

// Endpoint único (não por empresa) — a Meta manda tudo aqui, roteamos por dentro
// usando o phone_number_id de cada empresa (ver WhatsappProvider.handleWebhook).
router.get("/whatsapp", (req, res) => getProvider("WHATSAPP").handleWebhook(req, res));
router.post("/whatsapp", (req, res) => getProvider("WHATSAPP").handleWebhook(req, res));

export default router;
