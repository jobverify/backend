import { validationResult } from "express-validator";

const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);
const SENSITIVE_VALIDATION_MARKERS = [
  "password",
  "token",
  "secret",
  "apikey",
  "api_key",
  "csrf",
  "jwt",
  "cookie",
];

const isSensitiveValidationPath = (path) =>
  String(path ?? "")
    .toLowerCase()
    .split(/[\[\].]+/)
    .filter(Boolean)
    .some((segment) =>
      SENSITIVE_VALIDATION_MARKERS.some((marker) => segment.includes(marker)),
    );

export const formatValidationErrors = (entries) =>
  entries.map(({ msg, path, value }) => {
    const error = { msg, path };

    if (value !== undefined && !isSensitiveValidationPath(path)) {
      error.value = value;
    }

    return error;
  });

export const sendValidationError = (res, errors) =>
  res.status(400).json({
    code: 400,
    success: false,
    message: "Validation failed",
    errors: formatValidationErrors(errors.array()),
  });

const hasDeclaredRequestBody = (req) => {
  const transferEncoding = String(
    req.headers?.["transfer-encoding"] ?? "",
  ).trim();

  if (transferEncoding) {
    return true;
  }

  const contentLength = String(req.headers?.["content-length"] ?? "").trim();
  if (!contentLength) {
    return false;
  }

  const parsedLength = Number(contentLength);
  return Number.isNaN(parsedLength) ? true : parsedLength > 0;
};

const hasJsonContentType = (req) =>
  String(req.headers?.["content-type"] ?? "")
    .trim()
    .toLowerCase()
    .split(";", 1)[0].trim() === "application/json";

export const validateRequest = (req, res, next) => {
  const errors = validationResult(req);

  if (errors.isEmpty()) {
    next();
    return;
  }

  return sendValidationError(res, errors);
};

export const requireJsonMutation = (req, res, next) => {
  if (!MUTATING_METHODS.has(req.method)) {
    next();
    return;
  }

  if (!hasDeclaredRequestBody(req)) {
    next();
    return;
  }

  if (req.is("application/json") || hasJsonContentType(req)) {
    next();
    return;
  }

  return res.status(415).json({
    code: 415,
    success: false,
    message: "This endpoint requires application/json requests.",
  });
};
