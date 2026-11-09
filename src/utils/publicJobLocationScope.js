/**
 * @file Shared allowlist for the public job location scope exposed to the UI.
 * @module utils/publicJobLocationScope
 */

import { normalizeCity } from "../../scraper-support/utils/cityNormalizer.js";
import { buildAggregateHiringSignalFilter } from "./jobListingEvidence.js";
import { buildMissingSourceDescriptionFilter } from "./jobSourceContent.js";
import { CANONICAL_CITIES } from "../../scraper-support/utils/cities.js";
import {
  buildPublishableJobPostedAtCutoff,
  normalizeLifecycleDate,
} from "./jobLifecycle.js";

export const PUBLIC_JOB_ALLOWED_CITIES = Object.freeze([
  ...new Set(
    Object.values(CANONICAL_CITIES)
      .filter((city) => city && city !== "None")
      .sort((left, right) => left.localeCompare(right)),
  ),
  "Hazira",
]);

export const PUBLIC_JOB_ALLOWED_LOCATION_LABELS = Object.freeze([
  "IND-Trivandrum-Equifax Analytics-PEC",
  "India",
  "India Offsite",
  "India Offsite (ZIN99)",
]);

const INDIA_OFFSITE_REGEX = /^India Offsite(?:\s*\(.*\))?$/i;
const PLAIN_REMOTE_REGEX = /^remote$/i;
const GROUPED_LOCATION_LABEL_REGEX =
  /^(?:\d+\s+locations?|multiple locations|various locations|unknown|none)(?:\s*,\s*(?:india|in|ind))?$/i;
const LOCATION_MARKUP_OR_CODE_REGEXES = Object.freeze([
  /<\/?\s*[a-z][\w:-]*(?:\s+[^<>]*)?>?/i,
  /\$\s*\(/,
  /\.\s*(?:val|text|html)\s*\(/i,
  /\b(?:document|window|querySelector|getElementById)\s*[.(]/i,
]);
const escapeRegex = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const buildExactRegex = (value) => new RegExp(`^${escapeRegex(value)}$`, "i");
const NON_INDIA_COUNTRY_NAMES = (() => {
  const displayNames = new Intl.DisplayNames(["en"], { type: "region" });
  const names = new Set([
    "United States of America",
    "USA",
    "U.S.A.",
    "U.S.",
    "UAE",
    "Great Britain",
  ]);

  for (let first = 65; first <= 90; first += 1) {
    for (let second = 65; second <= 90; second += 1) {
      const code = String.fromCharCode(first, second);
      const name = displayNames.of(code);
      if (code !== "IN" && name && name !== code) names.add(name);
    }
  }

  return [...names].sort((left, right) => right.length - left.length);
})();
const NON_INDIA_LOCATION_MARKER_REGEX = new RegExp(
  `(?:^|[^\\p{L}])(?:${NON_INDIA_COUNTRY_NAMES.map(escapeRegex).join("|")})(?:$|[^\\p{L}])`,
  "iu",
);
const ALLOWED_CITY_SET = new Set(
  PUBLIC_JOB_ALLOWED_CITIES.map((city) => city.toLowerCase()),
);
const INDIA_COUNTRY_REGEXES = Object.freeze([
  buildExactRegex("India"),
  buildExactRegex("IN"),
  buildExactRegex("IND"),
]);
const SPECIAL_LOCATION_REGEXES = Object.freeze([
  buildExactRegex("IND-Trivandrum-Equifax Analytics-PEC"),
  buildExactRegex("India"),
  INDIA_OFFSITE_REGEX,
]);
const CANONICAL_CITY_REGEXES = Object.freeze([
  ...PUBLIC_JOB_ALLOWED_CITIES.map((city) => buildExactRegex(city)),
  ...SPECIAL_LOCATION_REGEXES,
]);
const INDIA_LOCATION_MARKER_REGEXES = Object.freeze([
  ...SPECIAL_LOCATION_REGEXES,
  /(?:^|,\s*)India(?:$|[\s,)(-])/i,
  /^IND[-\s(]/i,
]);
const ALLOWED_LOCATION_REGEXES = Object.freeze([
  ...CANONICAL_CITY_REGEXES,
  ...INDIA_LOCATION_MARKER_REGEXES,
]);

const matchesCountryValue = (value = "") => {
  const trimmed = String(value || "").trim();
  if (!trimmed) return false;
  return INDIA_COUNTRY_REGEXES.some((regex) => regex.test(trimmed));
};

const matchesSpecialLocationLabel = (value = "") => {
  const trimmed = String(value || "").trim();
  if (!trimmed) return false;
  return SPECIAL_LOCATION_REGEXES.some((regex) => regex.test(trimmed));
};

const matchesPlainRemoteLabel = (value = "") => {
  const trimmed = String(value || "").trim();
  if (!trimmed) return false;
  return PLAIN_REMOTE_REGEX.test(trimmed);
};

const matchesIndiaLocationMarker = (value = "") => {
  const trimmed = String(value || "").trim();
  if (!trimmed) return false;
  return INDIA_LOCATION_MARKER_REGEXES.some((regex) => regex.test(trimmed));
};

const matchesNonIndiaLocationMarker = (value = "") => {
  const trimmed = String(value || "").trim();
  return Boolean(trimmed && NON_INDIA_LOCATION_MARKER_REGEX.test(trimmed));
};

const isNoisyLocationCandidate = (value = "") => {
  const trimmed = String(value || "").replace(/\s+/g, " ").trim();
  if (!trimmed) return false;
  return (
    GROUPED_LOCATION_LABEL_REGEX.test(trimmed)
    || LOCATION_MARKUP_OR_CODE_REGEXES.some((regex) => regex.test(trimmed))
  );
};

const extractCityCandidate = (value = "") => {
  if (isNoisyLocationCandidate(value)) return null;
  if (matchesSpecialLocationLabel(value)) return "Remote";

  const normalized = normalizeCity(value);
  if (!normalized) return null;
  if (/^india$/i.test(normalized)) return null;
  return ALLOWED_CITY_SET.has(normalized.toLowerCase()) ? normalized : null;
};

const extractExplicitIndiaCityCandidate = (value = "") => {
  if (isNoisyLocationCandidate(value)) return null;
  if (matchesSpecialLocationLabel(value) || matchesPlainRemoteLabel(value)) return "Remote";

  const cityPart = String(value || "")
    .split(",")
    .map((part) => part.trim())
    .find((part) => part && !matchesCountryValue(part));
  const normalized = normalizeCity(cityPart);
  if (!normalized || /^india$/i.test(normalized)) return null;
  return normalized;
};

const isRemoteCity = (value = "") => /^remote$/i.test(String(value || "").trim());

export const getValidIndiaCityForJob = (job = {}) => {
  const country = typeof job.country === "string" ? job.country.trim() : "";
  // A collector's explicit unresolved-country result is stronger than the
  // legacy inference from a city or Remote label. Keep an independently
  // confirmed India worksite when only additional country scope is unresolved.
  if (job.sourceCountryScopeUnresolved === true && !matchesCountryValue(country)) return null;
  const city = typeof job.city === "string" ? job.city.trim() : "";
  const location = typeof job.location === "string" ? job.location.trim() : "";
  const locations = Array.isArray(job.locations)
    ? job.locations.map((value) => String(value || "").trim()).filter(Boolean)
    : [];
  const explicitIndiaCountry = matchesCountryValue(country);
  const primaryCandidates = [city, location]
    .filter((value) => value && !isNoisyLocationCandidate(value));
  const locationCandidates = locations
    .filter((value) => !isNoisyLocationCandidate(value));
  const allLocationValues = [city, location, ...locations].filter(Boolean);
  const hasExplicitIndiaLocation = allLocationValues.some((value) => (
    matchesSpecialLocationLabel(value) || matchesIndiaLocationMarker(value)
  ));

  // An explicit country is stronger evidence than a city-name inference.
  if (country && !explicitIndiaCountry) return null;
  if (
    explicitIndiaCountry
    && !hasExplicitIndiaLocation
    && allLocationValues.some((value) => matchesNonIndiaLocationMarker(value))
  ) return null;

  const hasIndiaScopeHint = explicitIndiaCountry
    || [...primaryCandidates, ...locationCandidates].some((value) => (
      matchesSpecialLocationLabel(value) || matchesIndiaLocationMarker(value)
    ));
  const remoteCandidates = [...primaryCandidates, ...locationCandidates]
    .filter((value) => matchesPlainRemoteLabel(value));
  const hasOnlyPlainRemoteLabels = (
    remoteCandidates.length > 0
    && remoteCandidates.length === primaryCandidates.length + locationCandidates.length
  );
  const allowPlainRemoteLabel = (
    explicitIndiaCountry
    || hasIndiaScopeHint
    || hasOnlyPlainRemoteLabels
  );

  // First try the primary city/location fields
  for (const candidate of primaryCandidates) {
    if (matchesSpecialLocationLabel(candidate)) return "Remote";
    if (matchesPlainRemoteLabel(candidate) && allowPlainRemoteLabel) return "Remote";
    const normalized = extractCityCandidate(candidate);
    if (!normalized) continue;
    if (isRemoteCity(normalized)) {
      if (matchesIndiaLocationMarker(candidate) || allowPlainRemoteLabel) return "Remote";
      continue;
    }
    if (matchesIndiaLocationMarker(candidate)) return normalized;
    if (ALLOWED_CITY_SET.has(normalized.toLowerCase())) return normalized;
  }

  // Then try special labels
  if (matchesSpecialLocationLabel(city)) return "Remote"; // Map "India Offsite" etc to Remote
  if (matchesSpecialLocationLabel(location)) return "Remote";
  if (matchesPlainRemoteLabel(city) && allowPlainRemoteLabel) return "Remote";
  if (matchesPlainRemoteLabel(location) && allowPlainRemoteLabel) return "Remote";

  // Finally scan the locations array
  for (const value of locationCandidates) {
    if (matchesSpecialLocationLabel(value)) return "Remote";
    if (matchesPlainRemoteLabel(value) && allowPlainRemoteLabel) return "Remote";
    const normalizedValue = extractCityCandidate(value);
    if (!normalizedValue) continue;
    if (isRemoteCity(normalizedValue)) {
      if (matchesIndiaLocationMarker(value) || allowPlainRemoteLabel) return "Remote";
      continue;
    }
    if (matchesIndiaLocationMarker(value)) return normalizedValue;
    if (ALLOWED_CITY_SET.has(normalizedValue.toLowerCase())) return normalizedValue;
  }

  if (explicitIndiaCountry) {
    // The UI city allowlist normalizes known cities; it must not reject an
    // otherwise confirmed India job merely because its city is not listed.
    for (const value of [...primaryCandidates, ...locationCandidates]) {
      const normalizedValue = extractExplicitIndiaCityCandidate(value);
      if (normalizedValue) return normalizedValue;
    }
    return "Remote";
  }
  if (primaryCandidates.some((value) => matchesIndiaLocationMarker(value))) return "Remote";
  if (locationCandidates.some((value) => matchesIndiaLocationMarker(value))) return "Remote";

  return null;
};

export const isJobInPublicLocationScope = (job = {}) => {
  return getValidIndiaCityForJob(job) !== null;
};

export const buildPublishedJobDateScope = (
  now = new Date(),
) => {
  const resolvedNow = normalizeLifecycleDate(now) || new Date();

  return {
    $expr: {
      $lte: [
        { $ifNull: ["$postedAt", resolvedNow] },
        resolvedNow,
      ],
    },
  };
};

export const buildPublicJobLifecycleDateScope = (
  now = new Date(),
) => {
  const resolvedNow = normalizeLifecycleDate(now) || new Date();

  return {
    // Unknown dates are not proof that a role has closed, so they remain visible.
    // Known posting dates must fall within the last calendar month.
    $expr: {
      $and: [
        {
          $lte: [
            { $ifNull: ["$postedAt", resolvedNow] },
            resolvedNow,
          ],
        },
        {
          $or: [
            { $eq: [{ $ifNull: ["$closingDate", null] }, null] },
            { $gt: ["$closingDate", resolvedNow] },
          ],
        },
        {
          $gte: [
            { $ifNull: ["$postedAt", resolvedNow] },
            buildPublishableJobPostedAtCutoff(resolvedNow),
          ],
        },
      ],
    },
  };
};

export const buildPublicJobLocationScope = (now = new Date(), options = {}) => ({
  isPublicIndia: true,
  $nor: [buildAggregateHiringSignalFilter(), buildMissingSourceDescriptionFilter()],
  ...buildPublicJobLifecycleDateScope(now, options),
});

export const applyPublicJobLocationScope = (
  filters = {},
  now = new Date(),
  options = {},
) => ({
  ...filters,
  ...buildPublicJobLocationScope(now, options),
  $nor: [...(filters.$nor || []), buildAggregateHiringSignalFilter(), buildMissingSourceDescriptionFilter()],
});
