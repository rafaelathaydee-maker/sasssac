import { Router } from "express";
import { requireAuth } from "../../middlewares/auth";
import { updateContact } from "./contacts.controller";

const router = Router();

router.use(requireAuth);
router.patch("/:id", updateContact);

export default router;
