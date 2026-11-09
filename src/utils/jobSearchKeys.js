import { normalizeCity } from "../../scraper-support/utils/cityNormalizer.js";

const normalizeWhitespace = (value) => String(value ?? "")
  .normalize("NFKD")
  .replace(/[\u0300-\u036f]/g, "")
  .replace(/\s+/g, " ")
  .trim();

export const normalizeJobSearchKey = (value) => {
  const normalized = normalizeWhitespace(value).toLowerCase();
  return normalized || null;
};

export const normalizeJobSearchKeyList = (values = []) => {
  const sourceValues = Array.isArray(values) ? values : [values];

  return [...new Set(
    sourceValues
      .map((value) => normalizeJobSearchKey(value))
      .filter(Boolean),
  )];
};

export const buildJobSearchKeys = (job = {}) => {
  const locationValues = [
    job.city,
    job.location,
    ...(Array.isArray(job.locations) ? job.locations : []),
  ];

  return {
    companyKey: normalizeJobSearchKey(job.company),
    cityKey: normalizeJobSearchKey(job.city),
    locationKeys: normalizeJobSearchKeyList([
      ...locationValues,
      ...locationValues.map(normalizeCity),
    ]),
  };
};
