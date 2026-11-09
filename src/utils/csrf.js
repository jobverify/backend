import crypto from "node:crypto";
import {
  getCookieSecurityOptions,
  getRequestCookie,
} from "./authCookies.js";

export const CSRF_COOKIE_NAME = "jobverify_csrf";
export const CSRF_HEADER_NAME = "x-csrf-token";

export const createCsrfToken = () => crypto.randomBytes(32).toString("hex");

export const getCsrfCookieOptions = () => ({
  ...getCookieSecurityOptions(),
  httpOnly: false,
});

export const getRequestCsrfToken = (req) =>
  getRequestCookie(req, CSRF_COOKIE_NAME);

export const issueCsrfToken = (req, res) => {
  const existingToken = getRequestCsrfToken(req);
  const token = existingToken || createCsrfToken();

  res.cookie(CSRF_COOKIE_NAME, token, getCsrfCookieOptions());
  return token;
};
