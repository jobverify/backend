const DEFAULT_PAGE_WALK_WINDOW_MS = 60_000;
const DEFAULT_PAGE_WALK_LIMIT = 30;
const DEFAULT_DETAIL_WINDOW_MS = 60_000;
const DEFAULT_DETAIL_LIMIT = 90;
const DEFAULT_VIOLATION_WINDOW_MS = 15 * 60_000;
const DEFAULT_VIOLATION_LIMIT = 5;
const DEFAULT_BLOCK_MS = 15 * 60_000;
const DEFAULT_MAX_RECORDS = 5_000;
const LEGACY_WINDOW_ENV = "PUBLIC_JOB_ABUSE_WINDOW_MS";
const PAGINATION_KEYS = ["page", "start", "offset", "skip", "cursor"];
const PUBLIC_JOB_IGNORED_PATHS = new Set([
  "/meta",
  "/meta/companies",
  "/stats",
  "/live-companies",
  "/seo-feed",
]);

const RATE_LIMIT_RESPONSE = {
  code: 429,
  error: "rate_limited",
  success: false,
  message: "Too many requests. Please try again later.",
};

const ACCESS_DENIED_RESPONSE = {
  code: 403,
  error: "access_denied",
  success: false,
  message: "Access temporarily restricted. Please try again later.",
};

const parsePositiveInt = (value, fallback) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const normalizeMethod = (value) => String(value ?? "").trim().toUpperCase();

const coercePath = (req = {}) => {
  const rawPath = String(req.path ?? req.originalUrl ?? req.url ?? "").split("?")[0]
    .toLowerCase().replace(/\/+$/, '') || '/';

  if (rawPath !== '/api/jobs' && !rawPath.startsWith("/api/jobs/")) {
    return rawPath || "/";
  }

  const relativePath = rawPath.slice("/api/jobs".length);
  return relativePath || "/";
};

const getClientKey = (req = {}) => String(req.ip ?? req.headers?.["x-forwarded-for"] ?? "unknown");

const getRequestPayload = (req = {}) => ({
  ...(req.query ?? {}),
  ...(req.body && typeof req.body === "object" && !Array.isArray(req.body) ? req.body : {}),
});

const normalizeSignalValue = (value) => {
  if (Array.isArray(value)) {
    return value.map((entry) => normalizeSignalValue(entry)).join(",");
  }

  if (value == null) return "";
  return String(value).trim();
};

const getPaginationSignal = (req = {}) => {
  const payload = getRequestPayload(req);
  const parts = PAGINATION_KEYS
    .filter((key) => Object.hasOwn(payload, key))
    .map((key) => [key, normalizeSignalValue(payload[key])])
    .filter(([, value]) => value);

  if (parts.length === 0) {
    return null;
  }

  return parts.map(([key, value]) => `${key}:${value}`).join("|");
};

const getDetailSignal = (req = {}) => {
  const path = coercePath(req);
  if (path.endsWith("/click")) return null;

  const paramId = normalizeSignalValue(req.params?.id);
  if (paramId) return paramId;

  const segment = path.split("/").filter(Boolean)[0];
  return segment && !["search", "meta", "stats", "live-companies", "seo-feed"].includes(segment)
    ? segment
    : null;
};

const pruneEntries = (entries = [], now) => entries.filter((entry) => entry.expiresAt > now);

const pruneRecord = (record, now) => {
  const nextRecord = {
    pageSignals: pruneEntries(record?.pageSignals, now),
    detailSignals: pruneEntries(record?.detailSignals, now),
    violations: pruneEntries(record?.violations, now),
    blockedUntil: Number(record?.blockedUntil ?? 0),
    lastSeenAt: Number(record?.lastSeenAt ?? 0),
  };

  if (nextRecord.blockedUntil <= now) {
    nextRecord.blockedUntil = 0;
  }

  return nextRecord;
};

const isRecordEmpty = (record = {}) =>
  (record.pageSignals?.length ?? 0) === 0
  && (record.detailSignals?.length ?? 0) === 0
  && (record.violations?.length ?? 0) === 0
  && Number(record.blockedUntil ?? 0) === 0;

const pushDistinctSignal = (entries, value, expiresAt) => {
  if (!value) {
    return entries;
  }

  if (entries.some((entry) => entry.value === value)) {
    return entries;
  }

  return [...entries, { value, expiresAt }];
};

const setHeader = (res, name, value) => {
  if (typeof res?.set === "function") {
    res.set(name, value);
    return;
  }

  if (typeof res?.setHeader === "function") {
    res.setHeader(name, value);
  }
};

const setRetryHeaders = (res, retryAfterSeconds) => {
  setHeader(res, "Retry-After", String(retryAfterSeconds));
  setHeader(res, "Cache-Control", "no-store");
};

const sendRateLimited = (res, retryAfterSeconds) => {
  setRetryHeaders(res, retryAfterSeconds);
  return res.status(429).json(RATE_LIMIT_RESPONSE);
};

const sendBlocked = (res, retryAfterSeconds) => {
  setRetryHeaders(res, retryAfterSeconds);
  return res.status(403).json(ACCESS_DENIED_RESPONSE);
};

const getWindowRetryAfter = (entries, now) => {
  const nextExpiry = entries.reduce(
    (minimum, entry) => Math.min(minimum, entry.expiresAt),
    Number.POSITIVE_INFINITY,
  );

  if (!Number.isFinite(nextExpiry)) {
    return 1;
  }

  return Math.max(1, Math.ceil((nextExpiry - now) / 1000));
};

const classifyRequest = (req = {}) => {
  const requestMethod = normalizeMethod(req.method);
  const method = requestMethod === 'HEAD' ? 'GET' : requestMethod;
  const path = coercePath(req);

  if (path.endsWith("/click")) return { type: "ignore" };

  if (path === "/" && method === "GET") {
    return { type: "page", signal: getPaginationSignal(req) };
  }

  if (path === "/search" && (method === "GET" || method === "POST")) {
    return { type: "page", signal: getPaginationSignal(req) };
  }

  if (method === "GET" && !PUBLIC_JOB_IGNORED_PATHS.has(path)) {
    const detailSignal = getDetailSignal(req);
    if (detailSignal) {
      return { type: "detail", signal: detailSignal };
    }
  }

  return { type: "ignore" };
};

export const getPublicJobAbuseConfig = (env = process.env, overrides = {}) => ({
  pageWalkWindowMs: parsePositiveInt(
    overrides.pageWalkWindowMs
      ?? env.PUBLIC_JOB_ABUSE_PAGE_WALK_WINDOW_MS
      ?? env[LEGACY_WINDOW_ENV],
    DEFAULT_PAGE_WALK_WINDOW_MS,
  ),
  pageWalkLimit: parsePositiveInt(
    overrides.pageWalkLimit ?? env.PUBLIC_JOB_ABUSE_PAGE_WALK_LIMIT,
    DEFAULT_PAGE_WALK_LIMIT,
  ),
  detailWindowMs: parsePositiveInt(
    overrides.detailWindowMs
      ?? env.PUBLIC_JOB_ABUSE_DETAIL_WINDOW_MS
      ?? env[LEGACY_WINDOW_ENV],
    DEFAULT_DETAIL_WINDOW_MS,
  ),
  detailLimit: parsePositiveInt(
    overrides.detailLimit ?? env.PUBLIC_JOB_ABUSE_DETAIL_LIMIT,
    DEFAULT_DETAIL_LIMIT,
  ),
  violationWindowMs: parsePositiveInt(
    overrides.violationWindowMs ?? env.PUBLIC_JOB_ABUSE_VIOLATION_WINDOW_MS,
    DEFAULT_VIOLATION_WINDOW_MS,
  ),
  violationLimit: parsePositiveInt(
    overrides.violationLimit ?? env.PUBLIC_JOB_ABUSE_VIOLATION_LIMIT,
    DEFAULT_VIOLATION_LIMIT,
  ),
  blockMs: parsePositiveInt(
    overrides.blockMs ?? env.PUBLIC_JOB_ABUSE_BLOCK_MS,
    DEFAULT_BLOCK_MS,
  ),
  maxRecords: parsePositiveInt(
    overrides.maxRecords ?? env.PUBLIC_JOB_ABUSE_MAX_RECORDS,
    DEFAULT_MAX_RECORDS,
  ),
});

export const createInMemoryAbuseStore = ({
  now = Date.now,
  maxRecords = DEFAULT_MAX_RECORDS,
} = {}) => {
  const records = new Map();

  const trimToMaxRecords = () => {
    if (records.size <= maxRecords) {
      return;
    }

    const oldestRecords = [...records.entries()]
      .sort(([, left], [, right]) => left.lastSeenAt - right.lastSeenAt)
      .slice(0, records.size - maxRecords);

    for (const [key] of oldestRecords) {
      records.delete(key);
    }
  };

  return {
    get(key) {
      const record = records.get(key);
      if (!record) {
        return null;
      }

      const nextRecord = pruneRecord(record, now());
      if (isRecordEmpty(nextRecord)) {
        records.delete(key);
        return null;
      }

      records.set(key, nextRecord);
      return nextRecord;
    },
    set(key, value) {
      const nextRecord = {
        ...value,
        lastSeenAt: Number(value?.lastSeenAt ?? now()),
      };

      if (isRecordEmpty(nextRecord)) {
        records.delete(key);
        return null;
      }

      records.set(key, nextRecord);
      trimToMaxRecords();
      return nextRecord;
    },
    sweepExpired(expireBeforeMs) {
      const currentTime = now();

      for (const [key, value] of records.entries()) {
        const nextRecord = pruneRecord(value, currentTime);
        if (nextRecord.lastSeenAt < expireBeforeMs || isRecordEmpty(nextRecord)) {
          records.delete(key);
        } else {
          records.set(key, nextRecord);
        }
      }

      trimToMaxRecords();
    },
    entries() {
      return [...records.entries()];
    },
  };
};

export const createPublicJobAbuseGuard = (options = {}) => {
  const now = options.now ?? Date.now;
  const config = getPublicJobAbuseConfig(process.env, options);
  const store = options.store ?? createInMemoryAbuseStore({
    now,
    maxRecords: config.maxRecords,
  });
  const longestStateWindowMs = Math.max(
    config.pageWalkWindowMs,
    config.detailWindowMs,
    config.violationWindowMs,
    config.blockMs,
  );

  return function publicJobAbuseGuard(req, res, next) {
    const currentTime = now();
    store.sweepExpired(currentTime - longestStateWindowMs);

    const clientKey = getClientKey(req);
    const record = pruneRecord(store.get(clientKey), currentTime);

    if (record.blockedUntil > currentTime) {
      store.set(clientKey, { ...record, lastSeenAt: currentTime });
      sendBlocked(res, Math.max(1, Math.ceil((record.blockedUntil - currentTime) / 1000)));
      return;
    }

    const classification = classifyRequest(req);
    if (classification.type === "ignore") {
      next();
      return;
    }

    const limit = classification.type === "detail" ? config.detailLimit : config.pageWalkLimit;
    const signalKey = classification.signal;

    if (!signalKey) {
      store.set(clientKey, { ...record, lastSeenAt: currentTime });
      next();
      return;
    }

    const keyName = classification.type === "detail" ? "detailSignals" : "pageSignals";
    const windowMs = classification.type === "detail"
      ? config.detailWindowMs
      : config.pageWalkWindowMs;
    const nextSignals = pushDistinctSignal(
      record[keyName],
      signalKey,
      currentTime + windowMs,
    );

    const nextRecord = {
      ...record,
      [keyName]: nextSignals,
      lastSeenAt: currentTime,
    };

    if (nextSignals.length <= limit) {
      store.set(clientKey, nextRecord);
      next();
      return;
    }

    const prunedViolations = pruneEntries(
      [
        ...record.violations,
        { value: `violation:${currentTime}`, expiresAt: currentTime + config.violationWindowMs },
      ],
      currentTime,
    );
    const blockedUntil = prunedViolations.length >= config.violationLimit
      ? currentTime + config.blockMs
      : 0;
    const finalRecord = {
      ...nextRecord,
      violations: prunedViolations,
      blockedUntil,
      lastSeenAt: currentTime,
    };

    store.set(clientKey, finalRecord);

    if (blockedUntil > currentTime) {
      sendBlocked(res, Math.max(1, Math.ceil((blockedUntil - currentTime) / 1000)));
      return;
    }

    sendRateLimited(res, getWindowRetryAfter(nextSignals, currentTime));
  };
};
