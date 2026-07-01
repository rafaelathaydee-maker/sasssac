import { Router } from "express";
import { requireAuth } from "../../middlewares/auth";
import { listMessages } from "./messages.controller";

const router = Router({ mergeParams: true });

router.use(requireAuth);
router.get("/", listMessages);

export default router;
