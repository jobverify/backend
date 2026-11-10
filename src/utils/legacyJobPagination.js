export const MAX_LEGACY_JOB_OFFSET = 100_000;

// Keep numbered navigation compatible, but reject unsafe arithmetic and work
// beyond the legacy endpoint's budget. Cursor search supports deeper traversal.
export const parseLegacyJobPagination = ({ page, limit, sort } = {}) => {
  const positiveInteger = (value, fallback) => {
    if (value == null) return fallback;
    if (!/^[0-9]+$/.test(String(value))) return null;
    const number = Number(value);
    return Number.isSafeInteger(number) && number > 0 ? number : null;
  };
  const pageNumber = positiveInteger(page, 1);
  const requestedLimit = positiveInteger(limit, 12);
  if (pageNumber == null || requestedLimit == null) return null;
  const pageLimit = Math.min(requestedLimit, sort === 'recommended' ? 12 : 1000);
  const offset = (pageNumber - 1) * pageLimit;
  if (!Number.isSafeInteger(offset) || offset > MAX_LEGACY_JOB_OFFSET) return null;
  return { page: pageNumber, limit: pageLimit, offset };
};
