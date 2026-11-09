import { body, param, query } from "express-validator";
import {
  isAllowedAccountEmail,
  isStrongPassword,
  normalizeEmailAddress,
  PASSWORD_POLICY_MESSAGE,
} from "../utils/authSecurity.js";
import { PREFERRED_JOB_TYPES } from "../constants/preferredJobTypes.js";
import { ACCESS_ROLES, PLAN_IDS } from "../constants/accessPlans.js";
import {
  DATE_POSTED_NA_VALUE,
  DATE_POSTED_OPTIONS,
  EXPERIENCE_BUCKET_VALUES,
  ROLE_DOMAIN_OPTIONS,
  SENIORITY_LEVELS,
  SKILL_MATCH_MODE_OPTIONS,
  SKILL_SCOPE_OPTIONS,
  WORK_ARRANGEMENT_OPTIONS,
} from "../constants/jobFilterTaxonomy.js";
import {
  countSuggestionCharacters,
  MAX_SUGGESTION_CHARACTERS,
} from "../utils/userSuggestion.js";

const MAX_TEXT_LENGTH = 80;
const MAX_QUERY_LENGTH = 200;
const MAX_PROFILE_ITEMS = 20;
// The public listing currently contains more than 500 pages at its smallest
// supported card count, so this must cover every page the UI can expose.
const MAX_PAGE = 2000;
const MAX_JOB_LIMIT = 1000;
const MAX_ADMIN_LIMIT = 50;
const MAX_EXPERIENCE_FILTER_YEAR = 15;
const EXPERIENCE_UNSPECIFIED_VALUE = "unspecified";
const VALID_JOB_SORTS = ["all", "latest", "oldest", "popularity", "recommended"];
const VALID_USER_ROLES = ["user", "admin"];
const VALID_JOB_STATUSES = ["active", "hidden", "expired"];

const trimIfString = (value) =>
  (typeof value === "string" ? value.trim() : value);

const allowedAccountEmailRule = (chain) =>
  chain
    .customSanitizer(normalizeEmailAddress)
    .isEmail()
    .withMessage("Please include a valid email.")
    .bail()
    .custom((value) => {
      if (!isAllowedAccountEmail(value)) {
        throw new Error("Use a Gmail or educational email address.");
      }
      return true;
    });

const boundedStringRule = (chain, label, maxLength = MAX_TEXT_LENGTH) =>
  chain
    .customSanitizer(trimIfString)
    .isLength({ min: 1, max: maxLength })
    .withMessage(`${label} must be between 1 and ${maxLength} characters.`);

const optionalBoundedStringRule = (
  chain,
  label,
  maxLength = MAX_TEXT_LENGTH,
) =>
  chain
    .optional()
    .customSanitizer(trimIfString)
    .isLength({ min: 1, max: maxLength })
    .withMessage(`${label} must be between 1 and ${maxLength} characters.`);

const optionalBoundedQueryValueRule = (
  chain,
  label,
  maxLength = MAX_TEXT_LENGTH,
) =>
  chain
    .optional()
    .custom((value) => {
      const list = Array.isArray(value) ? value : [value];

      for (const item of list) {
        const normalized = String(item ?? "").trim();
        if (!normalized || normalized.length > maxLength) {
          throw new Error(`${label} must be between 1 and ${maxLength} characters.`);
        }
      }

      return true;
    });

const optionalChoiceListRule = (
  chain,
  options,
  message,
) =>
  chain
    .optional()
    .custom((value) => {
      const list = Array.isArray(value) ? value : String(value ?? "").split(",");

      for (const item of list) {
        const normalized = String(item ?? "").trim();
        if (!normalized || !options.includes(normalized)) {
          throw new Error(message);
        }
      }

      return true;
    });

const optionalDatePostedListRule = (chain) =>
  chain
    .optional()
    .custom((value) => {
      const list = Array.isArray(value) ? value : String(value ?? "").split(",");

      for (const item of list) {
        const rawValue = String(item ?? "").trim().toLowerCase();
        const numericValue = /^\d+$/u.test(rawValue) ? Number(rawValue) : null;
        const normalized = rawValue === DATE_POSTED_NA_VALUE || rawValue === "older-than-30"
          ? rawValue
          : numericValue;
        if (!DATE_POSTED_OPTIONS.includes(normalized)) {
          throw new Error("Date posted filter is invalid.");
        }
      }

      return true;
    });

const optionalExperienceYearListRule = (chain) =>
  chain
    .optional()
    .custom((value) => {
      const list = Array.isArray(value) ? value : String(value ?? "").split(",");

      for (const item of list) {
        const normalized = String(item ?? "").trim();
        if (normalized === EXPERIENCE_UNSPECIFIED_VALUE) continue;

        const year = Number.parseInt(normalized, 10);
        if (
          !/^\d+$/.test(normalized)
          || !Number.isFinite(year)
          || year < 0
          || year > MAX_EXPERIENCE_FILTER_YEAR
        ) {
          throw new Error(
            `Experience year must be between 0 and ${MAX_EXPERIENCE_FILTER_YEAR}, or unspecified.`,
          );
        }
      }

      return true;
    });

const validateStringList = (value, label) => {
  const list = Array.isArray(value) ? value : String(value ?? "").split(",");

  if (list.length > MAX_PROFILE_ITEMS) {
    throw new Error(`${label} can contain at most ${MAX_PROFILE_ITEMS} items.`);
  }

  for (const item of list) {
    const normalized = String(item ?? "").trim();
    if (!normalized || normalized.length > MAX_TEXT_LENGTH) {
      throw new Error(
        `${label} items must be between 1 and ${MAX_TEXT_LENGTH} characters.`,
      );
    }
  }

  return true;
};

const validatePreferredJobTypeList = (value) => {
  const list = Array.isArray(value) ? value : String(value ?? "").split(",");

  if (list.length > MAX_PROFILE_ITEMS) {
    throw new Error(`Preferred job types can contain at most ${MAX_PROFILE_ITEMS} items.`);
  }

  for (const item of list) {
    const normalized = String(item ?? "").trim();
    if (!PREFERRED_JOB_TYPES.includes(normalized)) {
      throw new Error("Preferred job types must use the supported values.");
    }
  }

  return true;
};

const validateProfilePreferenceChoiceList = (value, options, message) => {
  const list = Array.isArray(value) ? value : String(value ?? "").split(",");

  for (const item of list) {
    const normalized = String(item ?? "").trim();
    if (!normalized || !options.includes(normalized)) {
      throw new Error(message);
    }
  }

  return true;
};

const validateProfilePreferenceDatePostedList = (value) => {
  const list = Array.isArray(value) ? value : String(value ?? "").split(",");

  for (const item of list) {
    const rawValue = String(item ?? "").trim().toLowerCase();
    const numericValue = /^\d+$/u.test(rawValue) ? Number(rawValue) : null;
    const normalized = rawValue === DATE_POSTED_NA_VALUE || rawValue === "older-than-30"
      ? rawValue
      : numericValue;
    if (!DATE_POSTED_OPTIONS.includes(normalized)) {
      throw new Error("Profile preference date posted is invalid.");
    }
  }

  return true;
};

const validateOptionalProfilePreferenceExperienceYear = (value) => {
  const normalized = String(value ?? "").trim();

  if (!normalized) {
    return true;
  }

  if (!/^\d+$/u.test(normalized)) {
    throw new Error(
      `Profile preference experience year must be between 0 and ${MAX_EXPERIENCE_FILTER_YEAR}.`,
    );
  }

  const parsedYear = Number.parseInt(normalized, 10);

  if (parsedYear < 0 || parsedYear > MAX_EXPERIENCE_FILTER_YEAR) {
    throw new Error(
      `Profile preference experience year must be between 0 and ${MAX_EXPERIENCE_FILTER_YEAR}.`,
    );
  }

  return true;
};

const alertFiltersValidationRules = (field, label) => [
  body(field).optional().isObject(),
  body(`${field}.company`)
    .optional()
    .custom((value) => validateStringList(value, `${label} company`)),
  body(`${field}.jobType`)
    .optional()
    .custom((value) => validateStringList(value, `${label} job type`)),
  body(`${field}.location`)
    .optional()
    .custom((value) => validateStringList(value, `${label} location`)),
  body(`${field}.experienceYear`)
    .optional()
    .custom((value) => validateOptionalProfilePreferenceExperienceYear(value)),
  body(`${field}.roleDomain`)
    .optional()
    .custom((value) => validateProfilePreferenceChoiceList(value, ROLE_DOMAIN_OPTIONS, "Role domain is invalid.")),
  body(`${field}.workArrangement`)
    .optional()
    .custom((value) => validateProfilePreferenceChoiceList(value, WORK_ARRANGEMENT_OPTIONS, "Work arrangement is invalid.")),
  body(`${field}.datePostedDays`)
    .optional()
    .custom((value) => validateProfilePreferenceDatePostedList(value)),
  body(`${field}.sortBy`)
    .optional()
    .isIn(["all", "popularity", "latest", "oldest"])
    .withMessage(`${label} sort must be one of: all, popularity, latest, oldest.`),
];

const telegramAlertFiltersValidationRules = () =>
  alertFiltersValidationRules("telegramAlertFilters", "Telegram alert");

export const registerValidation = [
  boundedStringRule(body("name"), "Name"),
  allowedAccountEmailRule(body("email")),
  // Older clients may submit a password; it is validated but never persisted.
  body("password").optional().custom((value) => {
    if (typeof value !== "string" || value.length === 0) {
      throw new Error("Password is required.");
    }
    if (!isStrongPassword(value)) {
      throw new Error(
        PASSWORD_POLICY_MESSAGE,
      );
    }
    return true;
  }),
];

export const loginValidation = [
  allowedAccountEmailRule(body("email")),
  body("password")
    .isString()
    .isLength({ min: 1 })
    .withMessage("Password is required."),
];

export const googleAuthValidation = [
  body("credential")
    .customSanitizer(trimIfString)
    .isString()
    .isLength({ min: 1, max: 5000 })
    .withMessage("Google credential is required."),
];

export const resendValidation = [
  body("email")
    .customSanitizer(normalizeEmailAddress)
    .isEmail()
    .withMessage("Please include a valid email."),
];

export const forgotPasswordValidation = [
  body("email")
    .customSanitizer(normalizeEmailAddress)
    .isEmail()
    .withMessage("Please include a valid email."),
];

export const verifyEmailValidation = [
  body("token")
    .customSanitizer(trimIfString)
    .isString()
    .isLength({ min: 1, max: 500 })
    .withMessage("Verification token is required."),
  body("password").custom((value) => {
    if (typeof value !== "string" || value.length === 0) {
      throw new Error("Password is required.");
    }
    if (!isStrongPassword(value)) {
      throw new Error(
        PASSWORD_POLICY_MESSAGE,
      );
    }
    return true;
  }),
];

export const resetPasswordValidation = [
  body("token")
    .customSanitizer(trimIfString)
    .isString()
    .isLength({ min: 1, max: 500 })
    .withMessage("Reset token is required."),
  body("password").custom((value) => {
    if (typeof value !== "string" || value.length === 0) {
      throw new Error("Password is required.");
    }
    if (!isStrongPassword(value)) {
      throw new Error(
        PASSWORD_POLICY_MESSAGE,
      );
    }
    return true;
  }),
];

export const changePasswordValidation = [
  body('oldPassword').isString().bail().notEmpty().withMessage('Old password is required.'),
  body('newPassword').custom((value) => {
    if (typeof value !== 'string' || !isStrongPassword(value)) {
      throw new Error(PASSWORD_POLICY_MESSAGE);
    }
    return true;
  }),
  body('confirmPassword').custom((value, { req }) => {
    if (typeof value !== 'string' || value !== req.body.newPassword) {
      throw new Error('Passwords do not match.');
    }
    return true;
  }),
];

export const jobQueryValidation = [
  query("page")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Page must be at least 1."),
  query("limit")
    .optional()
    .isInt({ min: 1, max: MAX_JOB_LIMIT })
    .withMessage(`Limit must be between 1 and ${MAX_JOB_LIMIT}.`),
  query("sort")
    .optional()
    .isIn(VALID_JOB_SORTS)
    .withMessage(`Sort must be one of: ${VALID_JOB_SORTS.join(", ")}.`),
  optionalBoundedStringRule(query("query"), "Search query", MAX_QUERY_LENGTH),
  optionalBoundedQueryValueRule(query("company"), "Company"),
  optionalBoundedQueryValueRule(query("city"), "City"),
  optionalBoundedQueryValueRule(query("location"), "Location"),
  optionalBoundedQueryValueRule(query("jobType"), "Job type"),
  optionalExperienceYearListRule(query("experienceYear")),
  optionalChoiceListRule(query("experienceBucket"), EXPERIENCE_BUCKET_VALUES, "Experience bucket is invalid."),
  optionalBoundedQueryValueRule(query("batch"), "Batch"),
  optionalBoundedQueryValueRule(query("branch"), "Branch"),
  optionalBoundedQueryValueRule(query("skills"), "Skills"),
  query("skillMatchMode")
    .optional()
    .isIn(SKILL_MATCH_MODE_OPTIONS.map(({ value }) => value))
    .withMessage("Skill match mode is invalid."),
  query("skillScope")
    .optional()
    .isIn(SKILL_SCOPE_OPTIONS.map(({ value }) => value))
    .withMessage("Skill scope is invalid."),
  optionalChoiceListRule(query("roleDomain"), ROLE_DOMAIN_OPTIONS, "Role domain is invalid."),
  query("seniority")
    .optional()
    .isIn(SENIORITY_LEVELS)
    .withMessage("Seniority filter is invalid."),
  optionalChoiceListRule(query("workArrangement"), WORK_ARRANGEMENT_OPTIONS, "Work arrangement filter is invalid."),
  optionalDatePostedListRule(query("datePostedDays")),
];

export const jobCompanyAutocompleteValidation = [
  ...jobQueryValidation,
  query("q")
    .optional()
    .customSanitizer(trimIfString)
    .isLength({ max: MAX_TEXT_LENGTH })
    .withMessage(`Company search must be ${MAX_TEXT_LENGTH} characters or fewer.`),
];

export const companyDirectoryQueryValidation = [
  query("q")
    .optional()
    .customSanitizer(trimIfString)
    .isLength({ max: 100 })
    .withMessage("Company search must be 100 characters or fewer."),
  query("page")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Page must be at least 1."),
  query("limit")
    .optional()
    .isInt({ min: 1, max: 48 })
    .withMessage("Limit must be between 1 and 48."),
];

export const companyKeyParamValidation = [
  boundedStringRule(param("companyKey"), "Company key", 100),
];

export const mongoIdParamValidation = (name, label) => [
  param(name).isMongoId().withMessage(`Invalid ${label}.`),
];

export const userProfileValidation = [
  body("name").optional().custom((value) => {
    if (String(value ?? "").trim().length > MAX_TEXT_LENGTH) {
      throw new Error(`Name must be ${MAX_TEXT_LENGTH} characters or fewer.`);
    }
    return true;
  }),
  body("branch").optional().custom((value) => {
    if (String(value ?? "").trim().length > MAX_TEXT_LENGTH) {
      throw new Error(`Branch must be ${MAX_TEXT_LENGTH} characters or fewer.`);
    }
    return true;
  }),
  body("passingYear")
    .optional()
    .isInt({ min: 2000, max: 2100 })
    .withMessage("Graduation Year must be a valid four-digit year."),
  body("preferredJobTypes")
    .optional()
    .custom((value) => validatePreferredJobTypeList(value)),
  body("locationPreference")
    .optional()
    .custom((value) => validateStringList(value, "Location preference")),
  body("profilePreferenceFilters").optional().isObject(),
  body("profilePreferenceFilters.company")
    .optional()
    .custom((value) => validateStringList(value, "Profile preference company")),
  body("profilePreferenceFilters.jobType")
    .optional()
    .custom((value) => validateStringList(value, "Profile preference job type")),
  body("profilePreferenceFilters.location")
    .optional()
    .custom((value) => validateStringList(value, "Profile preference location")),
  body("profilePreferenceFilters.experienceYear")
    .optional()
    .custom((value) => validateOptionalProfilePreferenceExperienceYear(value)),
  body("profilePreferenceFilters.roleDomain")
    .optional()
    .custom((value) => validateProfilePreferenceChoiceList(value, ROLE_DOMAIN_OPTIONS, "Role domain is invalid.")),
  body("profilePreferenceFilters.workArrangement")
    .optional()
    .custom((value) => validateProfilePreferenceChoiceList(value, WORK_ARRANGEMENT_OPTIONS, "Work arrangement is invalid.")),
  body("profilePreferenceFilters.datePostedDays")
    .optional()
    .custom((value) => validateProfilePreferenceDatePostedList(value)),
  body("profilePreferenceFilters.sortBy")
    .optional()
    .isIn(["all", "popularity", "latest", "oldest"])
    .withMessage("Profile preference sort must be one of: all, popularity, latest, oldest."),
];

export const suggestionSubmissionValidation = [
  body("message")
    .isString()
    .withMessage("Suggestion must be text.")
    .bail()
    .customSanitizer(trimIfString)
    .notEmpty()
    .withMessage("Suggestion is required.")
    .bail()
    .custom((value) => {
      if (countSuggestionCharacters(value) > MAX_SUGGESTION_CHARACTERS) {
        throw new Error(
          `Suggestion must be ${MAX_SUGGESTION_CHARACTERS} characters or fewer.`,
        );
      }
      return true;
    }),
];

export const adminUsersQueryValidation = [
  query("page")
    .optional()
    .isInt({ min: 1, max: MAX_PAGE })
    .withMessage(`Page must be between 1 and ${MAX_PAGE}.`),
  query("limit")
    .optional()
    .isInt({ min: 1, max: MAX_ADMIN_LIMIT })
    .withMessage(`Limit must be between 1 and ${MAX_ADMIN_LIMIT}.`),
  query("search").optional().customSanitizer(trimIfString).isLength({ max: MAX_QUERY_LENGTH })
    .withMessage(`Search must be ${MAX_QUERY_LENGTH} characters or fewer.`),
  query("role").optional().isIn(["user", "admin"])
    .withMessage("Role filter is invalid."),
  query("verified").optional().isBoolean().withMessage("Verified must be true or false."),
];

export const adminSuggestionsQueryValidation = [
  query("page")
    .optional()
    .isInt({ min: 1, max: MAX_PAGE })
    .withMessage(`Page must be between 1 and ${MAX_PAGE}.`),
  query("limit")
    .optional()
    .isInt({ min: 1, max: MAX_ADMIN_LIMIT })
    .withMessage(`Limit must be between 1 and ${MAX_ADMIN_LIMIT}.`),
];

export const adminJobsQueryValidation = [
  query("page")
    .optional()
    .isInt({ min: 1, max: MAX_PAGE })
    .withMessage(`Page must be between 1 and ${MAX_PAGE}.`),
  query("limit")
    .optional()
    .isInt({ min: 1, max: MAX_ADMIN_LIMIT })
    .withMessage(`Limit must be between 1 and ${MAX_ADMIN_LIMIT}.`),
  query("status")
    .optional()
    .isIn(VALID_JOB_STATUSES)
    .withMessage("Status filter is invalid."),
  query("company").optional().customSanitizer(trimIfString).isLength({ max: MAX_TEXT_LENGTH })
    .withMessage(`Company must be ${MAX_TEXT_LENGTH} characters or fewer.`),
  query("city").optional().customSanitizer(trimIfString).isLength({ max: MAX_TEXT_LENGTH })
    .withMessage(`City must be ${MAX_TEXT_LENGTH} characters or fewer.`),
  query("search").optional().customSanitizer(trimIfString).isLength({ max: MAX_QUERY_LENGTH })
    .withMessage(`Search must be ${MAX_QUERY_LENGTH} characters or fewer.`),
];

export const adminRoleUpdateValidation = [
  ...mongoIdParamValidation("id", "user ID"),
  body("role")
    .isIn(VALID_USER_ROLES)
    .withMessage(`Role must be one of: ${VALID_USER_ROLES.join(", ")}.`),
];

export const adminAccessUpdateValidation = [
  ...mongoIdParamValidation("id", "user ID"),
  body("accessRole")
    .isIn(Object.values(ACCESS_ROLES))
    .withMessage("Plan role is invalid."),
  body("expiresAt")
    .optional({ nullable: true, checkFalsy: true })
    .isISO8601()
    .withMessage("Plan expiry must be a valid ISO-8601 date."),
];

export const adminUserStatusValidation = [
  ...mongoIdParamValidation("id", "user ID"),
];

export const adminJobStatusValidation = [
  ...mongoIdParamValidation("id", "job ID"),
  body("status")
    .isIn(VALID_JOB_STATUSES)
    .withMessage(`Status must be one of: ${VALID_JOB_STATUSES.join(", ")}.`),
];

export const adminScraperToggleValidation = [
  ...mongoIdParamValidation("id", "scraper ID"),
  body("isActive")
    .isBoolean()
    .withMessage("isActive must be a boolean."),
];

export const billingCheckoutValidation = [
  body("planId")
    .isIn([PLAN_IDS.MONTHLY, PLAN_IDS.SEMESTER, PLAN_IDS.YEARLY])
    .withMessage("Plan must be monthly, semester, or yearly."),
];

export const billingVerifyValidation = [
  body("purchaseId")
    .optional()
    .isMongoId()
    .withMessage("purchaseId must be a valid purchase ID."),
  body("providerOrderId")
    .customSanitizer(trimIfString)
    .notEmpty()
    .withMessage("providerOrderId is required.")
    .bail()
    .isLength({ min: 3, max: 120 })
    .withMessage("providerOrderId must be between 3 and 120 characters."),
  body("providerPaymentId")
    .customSanitizer(trimIfString)
    .notEmpty()
    .withMessage("providerPaymentId is required.")
    .bail()
    .isLength({ min: 3, max: 120 })
    .withMessage("providerPaymentId must be between 3 and 120 characters."),
  body("providerSignature")
    .customSanitizer(trimIfString)
    .notEmpty()
    .withMessage("providerSignature is required.")
    .bail()
    .isLength({ min: 3, max: 200 })
    .withMessage("providerSignature must be between 3 and 200 characters."),
  body().custom((value) => {
    if (!value.purchaseId && !value.providerOrderId) {
      throw new Error("Either purchaseId or providerOrderId is required.");
    }
    return true;
  }),
];

export const telegramAlertsValidation = [
  body("enabled")
    .optional()
    .isBoolean()
    .withMessage("enabled must be a boolean.")
    .bail()
    .toBoolean(),
  ...telegramAlertFiltersValidationRules(),
];
