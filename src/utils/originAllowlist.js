const LOOPBACK_HOSTNAMES = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);

const parseOrigin = (value) => {
  const raw = String(value ?? "").trim();
  if (!raw) return null;

  try {
    const parsed = new URL(raw);
    if (!["http:", "https:"].includes(parsed.protocol)) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
};

export const normalizeOrigin = (value) => {
  const parsed = parseOrigin(value);
  return parsed?.origin ?? "";
};

const isLoopbackHostname = (hostname) =>
  LOOPBACK_HOSTNAMES.has(String(hostname || "").trim().toLowerCase());

export const isLoopbackOrigin = (value) => {
  const parsed = parseOrigin(value);
  return Boolean(parsed && isLoopbackHostname(parsed.hostname));
};

export const createOriginAllowlist = (
  allowedOrigins = [],
  { allowDevLoopback = false } = {},
) => {
  const exactOrigins = new Set();
  const loopbackProtocols = new Set();

  for (const origin of allowedOrigins) {
    const normalizedOrigin = normalizeOrigin(origin);
    if (!normalizedOrigin) continue;

    if (isLoopbackOrigin(normalizedOrigin) && !allowDevLoopback) {
      continue;
    }

    exactOrigins.add(normalizedOrigin);

    const parsed = parseOrigin(normalizedOrigin);
    if (parsed && isLoopbackHostname(parsed.hostname)) {
      loopbackProtocols.add(parsed.protocol);
    }
  }

  return {
    has(origin) {
      const normalizedOrigin = normalizeOrigin(origin);
      if (!normalizedOrigin) {
        return false;
      }

      if (exactOrigins.has(normalizedOrigin)) {
        return true;
      }

      if (!allowDevLoopback) {
        return false;
      }

      const parsed = parseOrigin(normalizedOrigin);
      return Boolean(
        parsed &&
          isLoopbackHostname(parsed.hostname) &&
          loopbackProtocols.has(parsed.protocol),
      );
    },
  };
};
