import { normalizeLifecycleDate } from './jobLifecycle.js'
import { parseWorkdayNativeLifecycleDate } from '../../scraper-support/myworkday/nativeLifecycleDates.js'

const result = (date, provenance) => ({
  date,
  provenance,
  provenanceValue: date?.toISOString() || null,
})

// Keep the origin tied to the normalized value, so a later provider update to
// either date alias can replace an observation fallback after object spreads
// and JSON round trips. These fields are not provider-verification evidence.
export const resolveJobPublicationDate = (job = {}, { observationDate = null } = {}) => {
  const dates = [job.postingDate, job.postedAt].map(normalizeLifecycleDate).filter(Boolean)
  const provenance = ['source', 'observation'].includes(job.postedAtProvenance)
    ? job.postedAtProvenance : null
  const anchor = typeof job.postedAtProvenanceValue === 'string'
    ? normalizeLifecycleDate(job.postedAtProvenanceValue) : null
  const hasAnchor = provenance && anchor?.toISOString() === job.postedAtProvenanceValue

  if (hasAnchor) {
    const replacement = dates.find(date => +date !== +anchor)
    if (replacement) return result(replacement, 'source')
    return result(dates[0] || anchor, provenance)
  }

  if (dates.length) return result(dates[0], 'source')
  return result(normalizeLifecycleDate(job.scrapedTimestamp)
    || normalizeLifecycleDate(job.scrapedAt)
    || normalizeLifecycleDate(observationDate), 'observation')
}

// Verified enrichment must mark its source date explicitly when it happens to
// equal the fallback instant; equal values alone cannot establish provenance.
export const sourcePublicationDateFields = value => {
  let date
  try {
    date = parseWorkdayNativeLifecycleDate(value instanceof Date ? value.toISOString() : value).date
  } catch {
    throw new TypeError('A source publication date must be a valid lifecycle date')
  }
  if (!date) throw new TypeError('A source publication date must be a valid lifecycle date')
  const timestamp = date.toISOString()
  return {
    employerPostedAt: timestamp,
    postingDate: timestamp,
    postedAt: timestamp,
    postedAtProvenance: 'source',
    postedAtProvenanceValue: timestamp,
  }
}
