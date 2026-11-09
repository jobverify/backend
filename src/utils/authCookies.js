import { isProductionEnvironment } from "./runtimeConfig.js";

export const AUTH_COOKIE_NAME = "jobverify_token";
export const PENDING_REGISTRATION_COOKIE_NAME = "jobverify_pending_registration";

const COOKIE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const PENDING_REGISTRATION_COOKIE_MAX_AGE_MS = 24 * 60 * 60 * 1000;

export const getCookieSecurityOptions = () => {
  const isProduction = isProductionEnvironment();
  const configuredSameSite = String(
    process.env.AUTH_COOKIE_SAME_SITE ?? "",
  ).trim().toLowerCase();
  const sameSite = ["strict", "lax", "none"].includes(configuredSameSite)
    ? configuredSameSite
    : (isProduction ? "none" : "lax");

  return {
    secure: isProduction,
    sameSite,
    path: "/",
  };
};

export const getAuthCookieOptions = () => ({
  ...getCookieSecurityOptions(),
  httpOnly: true,
  maxAge: COOKIE_MAX_AGE_MS,
});

export const getPendingRegistrationCookieOptions = () => ({
  ...getCookieSecurityOptions(),
  httpOnly: true,
  maxAge: PENDING_REGISTRATION_COOKIE_MAX_AGE_MS,
});

export const setAuthCookie = (res, token) => {
  res.cookie(AUTH_COOKIE_NAME, token, getAuthCookieOptions());
};

export const setPendingRegistrationCookie = (res, token) => {
  res.cookie(
    PENDING_REGISTRATION_COOKIE_NAME,
    token,
    getPendingRegistrationCookieOptions(),
  );
};

export const clearAuthCookie = (res) => {
  const { maxAge, ...clearOptions } = getAuthCookieOptions();
  void maxAge;
  res.clearCookie(AUTH_COOKIE_NAME, clearOptions);
};

export const clearPendingRegistrationCookie = (res) => {
  const { maxAge, ...clearOptions } = getPendingRegistrationCookieOptions();
  void maxAge;
  res.clearCookie(PENDING_REGISTRATION_COOKIE_NAME, clearOptions);
};

export const getRequestCookie = (req, name) => {
  const cookieHeader = req.headers?.cookie;
  if (!cookieHeader) return null;

  const cookies = cookieHeader.split(";").map((entry) => entry.trim());
  const prefix = `${name}=`;
  const cookie = cookies.find((entry) => entry.startsWith(prefix));
  if (!cookie) return null;

  try {
    return decodeURIComponent(cookie.slice(prefix.length));
  } catch {
    return cookie.slice(prefix.length);
  }
};

export const getRequestAuthToken = (req) => {
  const authorization = req.headers?.authorization;
  if (authorization?.startsWith("Bearer ")) {
    return authorization.split(" ")[1];
  }

  return getRequestCookie(req, AUTH_COOKIE_NAME);
};
