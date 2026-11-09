/**
 * @file City normalisation logic — maps raw scraped city strings to canonical names.
 * @module scraper/utils/cityNormalizer
 */

import { CANONICAL_CITIES } from './cities.js';

const escapeRegex = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const matchesCanonicalAlias = (value, alias) => (
  new RegExp(`(^|[^a-z0-9])${escapeRegex(alias)}([^a-z0-9]|$)`).test(value)
);

// Returns the canonical city name for a raw string; falls back to the trimmed original.
export const normalizeCity = (raw) => {
  if (!raw) return null;
  const trimmed = raw.trim();
  const lower = trimmed
    .toLowerCase()
    .replace(/[–—−]/g, '-')
    .replace(/\s+/g, ' ')
    .trim();

  if (lower.match(/^(?:\d+\s+locations?|multiple locations|various locations|unknown|none)$/i)) {
    return null;
  }

  // Strip common noisy prefixes/suffixes before exact and boundary-aware alias matching.
  const cleanLower = lower
    .replace(/^dgs india\s*-\s*/, '')
    .replace(/^ind\s*-\s*/, '')
    .replace(/india,? ?/g, '')
    .replace(/,\s*\d{6}/, '')
    .trim();

  if (CANONICAL_CITIES[cleanLower]) {
    return CANONICAL_CITIES[cleanLower];
  }
  for (const key of Object.keys(CANONICAL_CITIES)) {
    if (matchesCanonicalAlias(cleanLower, key)) {
      return CANONICAL_CITIES[key];
    }
  }
  return trimmed;
};
