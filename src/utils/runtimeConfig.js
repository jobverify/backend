import {
  isLoopbackOrigin,
  normalizeOrigin,
} from "./originAllowlist.js";

export const isProductionEnvironment = (env = process.env) =>
  String(env.NODE_ENV ?? "").trim().toLowerCase() === "production";

export const requireEnv = (name, env = process.env) => {
  const value = String(env[name] ?? "").trim();
  if (!value) {
    console.error(
      `[Config Error] ${name} is not defined or cannot be accessed in the environment.`,
    );
    throw new Error(`${name} environment variable is not defined.`);
  }
  return value;
};

export const requireOneOf = (names, env = process.env) => {
  const found = names.find((name) => String(env[name] ?? "").trim());
  if (!found) {
    const joined = names.join(", ");
    console.error(
      `[Config Error] One of ${joined} must be defined or cannot be accessed in the environment.`,
    );
    throw new Error(`One of ${joined} environment variables is required.`);
  }
  return found;
};

const normalizeConfiguredOrigin = (value) => {
  const primaryOrigin = String(value ?? "")
    .split(",")[0]
    ?.trim();

  if (!primaryOrigin) {
    return "";
  }

  return normalizeOrigin(primaryOrigin);
};

export const resolvePublicApiOrigin = (env = process.env) => {
  for (const name of [
    "PUBLIC_API_ORIGIN",
    "API_PUBLIC_ORIGIN",
    "BACKEND_PUBLIC_ORIGIN",
  ]) {
    const raw = String(env[name] ?? "").trim();
    if (!raw) {
      continue;
    }

    const normalizedOrigin = normalizeConfiguredOrigin(raw);
    if (!normalizedOrigin) {
      throw new Error(`${name} must be an http(s) origin.`);
    }

    return normalizedOrigin;
  }

  return "";
};

const splitConfiguredOrigins = (value) =>
  String(value ?? "")
    .split(",")
    .map((entry) => normalizeOrigin(entry))
    .filter(Boolean);

export const resolveFrontendOrigin = (env = process.env) => {
  const configuredOrigins = [
    ...splitConfiguredOrigins(env.FRONTEND_ORIGIN),
    ...splitConfiguredOrigins(env.CORS_ORIGIN),
  ];

  const uniqueOrigins = [...new Set(configuredOrigins)];
  const isProduction = isProductionEnvironment(env);
  const allowedOrigins = isProduction
    ? uniqueOrigins.filter((origin) => !isLoopbackOrigin(origin))
    : uniqueOrigins;
  const selectedOrigin = allowedOrigins[0] ?? uniqueOrigins[0] ?? "";

  if (!selectedOrigin) {
    throw new Error("FRONTEND_ORIGIN or CORS_ORIGIN environment variable is not defined.");
  }

  return selectedOrigin;
};
