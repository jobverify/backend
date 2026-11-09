import { CSRF_HEADER_NAME, getRequestCsrfToken } from "../utils/csrf.js";
import {
  createOriginAllowlist,
  normalizeOrigin,
} from "../utils/originAllowlist.js";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

export const createCsrfProtection = ({
  allowedOrigins = [],
  allowDevLoopback = false,
  exemptPaths = [],
} = {}) => {
  const allowlist = createOriginAllowlist(allowedOrigins, { allowDevLoopback });
  const normalizedExemptPaths = exemptPaths.map((path) => String(path).trim()).filter(Boolean);

  return (req, res, next) => {
    if (SAFE_METHODS.has(req.method)) {
      next();
      return;
    }

    const requestPath = String(req.originalUrl || "").split("?")[0];
    if (normalizedExemptPaths.includes(requestPath)) {
      next();
      return;
    }

    const requestOrigin = normalizeOrigin(
      req.headers.origin || req.headers.referer,
    );

    if (!requestOrigin || !allowlist.has(requestOrigin)) {
      return res.status(403).json({
        code: 403,
        success: false,
        message: "Request origin is not allowed for this action.",
      });
    }

    const cookieToken = getRequestCsrfToken(req);
    const headerToken = String(req.headers[CSRF_HEADER_NAME] ?? "").trim();

    if (!cookieToken || !headerToken || cookieToken !== headerToken) {
      return res.status(403).json({
        code: 403,
        success: false,
        message: "A valid CSRF token is required for this action.",
      });
    }

    next();
  };
};
