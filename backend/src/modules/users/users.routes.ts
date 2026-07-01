import { Router } from "express";
import { requireAuth, requireAdmin } from "../../middlewares/auth";
import { asyncHandler } from "../../lib/asyncHandler";
import { listCompanyUsers, createUser, updateUser, deleteUser } from "./users.controller";

const router = Router();

router.use(requireAuth);
router.get("/", asyncHandler(listCompanyUsers));
router.post("/", requireAdmin, asyncHandler(createUser));
router.patch("/:id", requireAdmin, asyncHandler(updateUser));
router.delete("/:id", requireAdmin, asyncHandler(deleteUser));

export default router;
