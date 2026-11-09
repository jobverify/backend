/**
 * HTTP process configuration. Numeric values must match completely: a CIDR
 * such as 10.0.0.0/8 is a trusted network, never a ten-hop proxy policy.
 */
export const parseTrustProxy = (value) => {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (!normalized || ["false", "0", "off"].includes(normalized)) return false;
  if (["true", "1"].includes(normalized)) return 1;
  if (/^\d+$/.test(normalized)) {
    const hops = Number(normalized);
    if (!Number.isSafeInteger(hops)) throw new Error("TRUST_PROXY hop count is invalid.");
    return hops;
  }
  return String(value).trim();
};

export const parseOriginList = (value) => String(value ?? "")
  .split(",")
  .map((entry) => entry.trim())
  .filter(Boolean);

export const parsePort = (value) => {
  const normalized = String(value ?? "").trim();
  const port = Number(normalized);
  if (!/^\d+$/.test(normalized) || !Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error("PORT must be an integer from 1 to 65535.");
  }
  return port;
};
