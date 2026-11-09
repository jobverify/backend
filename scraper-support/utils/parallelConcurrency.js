export const FALLBACK_PARALLEL_SCRAPER_CONCURRENCY = 1

const parsePositiveConcurrency = (value) => {
  const parsed = Number.parseInt(value, 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null
}

export const resolveConfiguredParallelScraperConcurrency = (
  value = process.env.SCRAPER_CONCURRENCY,
  fallbackConcurrency = FALLBACK_PARALLEL_SCRAPER_CONCURRENCY,
) => parsePositiveConcurrency(value) ?? fallbackConcurrency

export const resolveParallelWorkerConcurrency = ({
  requested = process.env.SCRAPER_CONCURRENCY,
  defaultConcurrency = resolveConfiguredParallelScraperConcurrency(),
} = {}) => {
  const normalizedRequested = parsePositiveConcurrency(requested) ?? defaultConcurrency

  return {
    requested: normalizedRequested,
    effective: normalizedRequested,
    clamped: false,
  }
}
