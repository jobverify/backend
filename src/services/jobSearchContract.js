/**
 * Canonical, transport-independent validation for job-search inputs.
 * Normalization is O(F + V): each filter and supplied value is visited once,
 * while Maps/Sets provide average O(1) metadata lookup and de-duplication.
 */
import crypto from "node:crypto";

export const JOB_SEARCH_LIMITS = Object.freeze({
  maxFilterGroups: 12,
  maxValuesPerFilter: 50,
  maxTotalValues: 150,
  maxSearchLength: 200,
  maxPageSize: 1000,
  defaultPageSize: 12,
});

const FILTER_DEFINITIONS = new Map([
  ["query", { type: "string", maxLength: JOB_SEARCH_LIMITS.maxSearchLength }],
  ["company", { type: "list" }],
  ["city", { type: "list" }],
  ["location", { type: "list" }],
  ["jobType", { type: "list" }],
  ["experienceYear", { type: "list" }],
  ["experienceBucket", { type: "list" }],
  ["batch", { type: "list" }],
  ["branch", { type: "list" }],
  ["skills", { type: "list" }],
  ["skillMatchMode", { type: "string", maxLength: 16 }],
  ["skillScope", { type: "string", maxLength: 16 }],
  ["roleDomain", { type: "list" }],
  ["seniority", { type: "string", maxLength: 80 }],
  ["workArrangement", { type: "list" }],
  ["datePostedDays", { type: "list" }],
]);
const CONTROL_FIELDS = new Set(["limit", "sort", "cursor"]);
const VALID_SORTS = new Set(["latest", "oldest", "popularity"]);
const OBJECT_ID = /^[a-f\d]{24}$/iu;
const DEFAULT_CURSOR_SECRET = "jobverify-job-search-cursor-dev-secret";

export class SearchInputError extends Error {
  constructor(code, message, { limit = null, actual = null, maximum = null } = {}) {
    super(message);
    this.name = "SearchInputError";
    this.code = code;
    this.limit = limit;
    this.actual = actual;
    this.maximum = maximum;
  }

  toResponse() {
    return {
      code: this.code,
      limit: this.limit,
      actual: this.actual,
      maximum: this.maximum,
      message: this.message,
    };
  }
}

const throwLimit = (limit, actual, maximum) => {
  throw new SearchInputError(
    "FILTER_VALUE_LIMIT_EXCEEDED",
    `The ${limit} limit was exceeded. Select fewer values and try again.`,
    { limit, actual, maximum },
  );
};

const asInputValues = (value) => (
  Array.isArray(value) ? value : typeof value === "string" ? value.split(",") : [value]
);

const normalizeScalar = (value, maxLength = 80) => {
  if (typeof value !== "string" && typeof value !== "number") {
    throw new SearchInputError("INVALID_FILTER_VALUE", "Filter values must be strings or numbers.");
  }
  const normalized = String(value).trim().replace(/\s+/gu, " ");
  if (!normalized) return null;
  if (normalized.length > maxLength) {
    throw new SearchInputError("INVALID_FILTER_VALUE", `Filter values must be at most ${maxLength} characters.`);
  }
  return normalized;
};

const canonicalize = (value) => JSON.stringify(value);
const getCursorSecret = () => (
  String(process.env.JOB_SEARCH_CURSOR_SECRET || process.env.JWT_SECRET || DEFAULT_CURSOR_SECRET)
);

export const buildJobSearchRequest = (input = {}) => {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new SearchInputError("INVALID_SEARCH_REQUEST", "Search input must be a JSON object.");
  }

  const filters = {};
  let groupCount = 0;
  let totalValues = 0;

  for (const [key, rawValue] of Object.entries(input)) {
    if (CONTROL_FIELDS.has(key)) continue;
    const definition = FILTER_DEFINITIONS.get(key);
    if (!definition) {
      throw new SearchInputError("UNKNOWN_FILTER", `Unknown job-search filter: ${key}.`);
    }
    if (rawValue == null || rawValue === "") continue;

    if (definition.type === "string") {
      const value = normalizeScalar(rawValue, definition.maxLength);
      if (value) {
        filters[key] = value;
        groupCount += 1;
        totalValues += 1;
      }
      continue;
    }

    const values = asInputValues(rawValue);
    const unique = new Set();
    for (const value of values) {
      const normalized = normalizeScalar(value, 80);
      if (normalized) unique.add(normalized);
    }
    if (unique.size === 0) continue;
    if (unique.size > JOB_SEARCH_LIMITS.maxValuesPerFilter) {
      throwLimit("values_per_filter", unique.size, JOB_SEARCH_LIMITS.maxValuesPerFilter);
    }
    filters[key] = [...unique].sort((left, right) => left.localeCompare(right, "en"));
    groupCount += 1;
    totalValues += unique.size;
  }

  if (groupCount > JOB_SEARCH_LIMITS.maxFilterGroups) {
    throwLimit("filter_groups", groupCount, JOB_SEARCH_LIMITS.maxFilterGroups);
  }
  if (totalValues > JOB_SEARCH_LIMITS.maxTotalValues) {
    throwLimit("total_filter_values", totalValues, JOB_SEARCH_LIMITS.maxTotalValues);
  }

  const requestedPageSize = input.limit == null || input.limit === ""
    ? JOB_SEARCH_LIMITS.defaultPageSize
    : Number.parseInt(String(input.limit), 10);
  if (!Number.isInteger(requestedPageSize) || requestedPageSize < 1 || requestedPageSize > JOB_SEARCH_LIMITS.maxPageSize) {
    throw new SearchInputError("INVALID_PAGE_SIZE", `Page size must be between 1 and ${JOB_SEARCH_LIMITS.maxPageSize}.`, {
      limit: "page_size",
      actual: input.limit,
      maximum: JOB_SEARCH_LIMITS.maxPageSize,
    });
  }
  const sort = input.sort == null || input.sort === "" ? "latest" : String(input.sort).trim();
  if (!VALID_SORTS.has(sort)) {
    throw new SearchInputError("INVALID_SORT", "Cursor search supports latest, oldest, or popularity sorting.");
  }

  const filterHash = crypto.createHash("sha256")
    .update(canonicalize({ filters, sort }))
    .digest("hex");
  return Object.freeze({ filters: Object.freeze(filters), pageSize: requestedPageSize, sort, filterHash });
};

export const encodeJobSearchCursor = ({
  filterHash,
  sort,
  cursorDate,
  sortDate,
  postedAt,
  createdAt,
  id,
  clickCount = null,
}) => {
  const normalizedCursorDate = cursorDate ?? sortDate ?? postedAt ?? createdAt;
  const payload = {
    v: 4,
    h: filterHash,
    s: sort,
    p: new Date(normalizedCursorDate).toISOString(),
    i: id,
    k: Number.isFinite(clickCount) ? clickCount : null,
  };
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = crypto
    .createHmac("sha256", getCursorSecret())
    .update(encodedPayload)
    .digest("base64url");

  return Buffer.from(JSON.stringify({ p: encodedPayload, s: signature })).toString("base64url");
};

export const decodeJobSearchCursor = (cursor, request) => {
  let wrappedPayload;
  try {
    wrappedPayload = JSON.parse(Buffer.from(String(cursor), "base64url").toString("utf8"));
  } catch {
    throw new SearchInputError("INVALID_CURSOR", "This page cursor is invalid.");
  }

  let decoded = wrappedPayload;
  if (wrappedPayload?.p && wrappedPayload?.s) {
    const expectedSignature = crypto
      .createHmac("sha256", getCursorSecret())
      .update(String(wrappedPayload.p))
      .digest("base64url");
    const actualSignature = Buffer.from(String(wrappedPayload.s));
    const comparisonSignature = Buffer.from(expectedSignature);

    if (
      actualSignature.length !== comparisonSignature.length
      || !crypto.timingSafeEqual(actualSignature, comparisonSignature)
    ) {
      throw new SearchInputError("INVALID_CURSOR", "This page cursor is invalid.");
    }

    try {
      decoded = JSON.parse(Buffer.from(String(wrappedPayload.p), "base64url").toString("utf8"));
    } catch {
      throw new SearchInputError("INVALID_CURSOR", "This page cursor is invalid.");
    }
  }

  const cursorDate = new Date(decoded?.p);
  const clickCount = decoded?.k == null ? null : Number(decoded.k);
  if (
    ![1, 2, 3, 4].includes(decoded?.v)
    || !Number.isFinite(cursorDate.getTime())
    || !OBJECT_ID.test(decoded?.i)
  ) {
    throw new SearchInputError("INVALID_CURSOR", "This page cursor is invalid.");
  }
  if (request.sort === "popularity" && !Number.isFinite(clickCount)) {
    throw new SearchInputError("INVALID_CURSOR", "This page cursor is invalid.");
  }
  if (decoded.h !== request.filterHash || decoded.s !== request.sort) {
    throw new SearchInputError("CURSOR_FILTER_MISMATCH", "This page cursor belongs to different filters or sorting.");
  }

  if (request.sort === "popularity") {
    return { cursorDate, createdAt: null, id: decoded.i, clickCount };
  }

  return { cursorDate, createdAt: null, id: decoded.i };
};
