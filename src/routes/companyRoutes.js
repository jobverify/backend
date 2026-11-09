import express from "express";

import {
  getCompanies,
  getCompanyByKey,
} from "../controllers/companyController.js";
import { loadSiteSettings } from "../middleware/siteSettings.js";
import { validateRequest } from "../middleware/validateRequest.js";
import {
  companyDirectoryQueryValidation,
  companyKeyParamValidation,
} from "../validation/requestValidators.js";

const router = express.Router();

router.get(
  "/",
  companyDirectoryQueryValidation,
  validateRequest,
  loadSiteSettings,
  getCompanies,
);
router.get(
  "/:companyKey",
  companyKeyParamValidation,
  validateRequest,
  loadSiteSettings,
  getCompanyByKey,
);

export default router;
