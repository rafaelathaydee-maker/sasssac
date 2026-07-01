import { Router } from "express";
import { requireAuth, requireAdmin } from "../../middlewares/auth";
import { asyncHandler } from "../../lib/asyncHandler";
import {
  listDepartments, createDepartment, updateDepartment, setDepartmentAgents,
  listDepartmentAgents, addDepartmentAgent, removeDepartmentAgent, deleteDepartment,
} from "./departments.controller";

const router = Router();
router.use(requireAuth);
router.get("/", asyncHandler(listDepartments));
router.post("/", requireAdmin, asyncHandler(createDepartment));
router.patch("/:id", requireAdmin, asyncHandler(updateDepartment));
router.delete("/:id", requireAdmin, asyncHandler(deleteDepartment));
router.post("/:id/agents", requireAdmin, asyncHandler(setDepartmentAgents));
router.get("/:id/agents", asyncHandler(listDepartmentAgents));
router.post("/:id/agents/:agentId", requireAdmin, asyncHandler(addDepartmentAgent));
router.delete("/:id/agents/:agentId", requireAdmin, asyncHandler(removeDepartmentAgent));

export default router;
