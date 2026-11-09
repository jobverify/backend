import { mapJobsWithInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
import { createDarwinboxScraper } from '../darwinbox/script.js'

const createConfiguredScraper = () => {
  const baseScraper = createDarwinboxScraper({
    companyName: 'Ninjacart',
    source: 'ninjacart',
    companyId: 'main',
    pageSize: 10,
    origin: 'https://ninjacart.darwinbox.in',
  })

  const normalizeCity = (job) => {
    const location = String(job?.location ?? '')
    const parts = location
      .split(',')
      .map((part) => part.trim())
      .filter(Boolean)

    if (/multiple locations/i.test(location)) {
      return null
    }

    if (parts.length > 1 && /\bbu\b/i.test(parts[0])) {
      return parts[1]
    }

    return job.city
  }

  return {
    ...baseScraper,
    async run(options = {}) {
      const jobs = await baseScraper.run(options)
      return mapJobsWithInventoryEvidence(jobs, (job) => ({
        ...job,
        city: normalizeCity(job),
      }))
    },
  }
}

const scraper = createConfiguredScraper()

export const {
  buildCareersPageUrl,
  buildListingApiUrl,
  buildJobDetailUrl,
  extractSearchResults,
  run,
} = scraper

export const createNinjacartScraper = createConfiguredScraper
