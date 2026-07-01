import { Router } from "express";
import { requireAuth, requireSuperAdmin } from "../../middlewares/auth";
import { asyncHandler } from "../../lib/asyncHandler";
import {
  listCompanies, createCompany, updateCompany, getCompanyDetail,
  setSuspended, createUserInCompany, resetPassword, listAuditLogs, exportCompanyData,
} from "./admin.controller";

const router = Router();

router.use(requireAuth, requireSuperAdmin);

router.get("/companies", asyncHandler(listCompanies));
router.post("/companies", asyncHandler(createCompany));
router.get("/companies/:id", asyncHandler(getCompanyDetail));
router.get("/companies/:id/export", asyncHandler(exportCompanyData));
router.patch("/companies/:id", asyncHandler(updateCompany));
router.post("/companies/:id/suspend", asyncHandler((req, res) => setSuspended(req as any, res, true)));
router.post("/companies/:id/activate", asyncHandler((req, res) => setSuspended(req as any, res, false)));
router.post("/companies/:id/users", asyncHandler(createUserInCompany));
router.post("/users/:id/reset-password", asyncHandler(resetPassword));
router.get("/audit-logs", asyncHandler(listAuditLogs));

export default router;
