import { Router } from "express";
import { requireAuth } from "../../middlewares/auth";
import {
  listConversations,
  getSummary,
  getConversation,
  claimConversation,
  releaseConversation,
  assignConversation,
  updateStatus,
  setPinned,
  setFavorite,
  updatePriority,
} from "./conversations.controller";

const router = Router();

router.use(requireAuth);
router.get("/", listConversations);
router.get("/summary", getSummary); // precisa vir antes de "/:id" pra não ser capturada como id
router.get("/:id", getConversation);
router.post("/:id/claim", claimConversation);
router.post("/:id/release", releaseConversation);
router.post("/:id/assign", assignConversation);
router.patch("/:id/status", updateStatus);
router.post("/:id/pin", (req, res) => setPinned(req as any, res, true));
router.post("/:id/unpin", (req, res) => setPinned(req as any, res, false));
router.post("/:id/favorite", (req, res) => setFavorite(req as any, res, true));
router.post("/:id/unfavorite", (req, res) => setFavorite(req as any, res, false));
router.patch("/:id/priority", updatePriority);

export default router;
