import { mapJobsWithInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
import { createDarwinboxScraper } from '../darwinbox/script.js'

export const COMPANY_NAME = 'Polycab'
export const SOURCE = 'polycab'
export const COMPANY_ID = 'main'
export const DARWINBOX_ORIGIN = 'https://polycab.darwinbox.in'
export const OFFICIAL_CAREERS_URL = 'https://polycab.com/life-at-polycab/careers'
export const OFFICIAL_CAREERS_HANDOFF_URL = `${DARWINBOX_ORIGIN}/ms/candidate/careers`
export const PUBLIC_PORTAL_URL = `${DARWINBOX_ORIGIN}/ms/candidatev2/${COMPANY_ID}/careers/allJobs`

const createConfiguredScraper = () => createDarwinboxScraper({
  companyName: COMPANY_NAME,
  source: SOURCE,
  companyId: COMPANY_ID,
  origin: DARWINBOX_ORIGIN,
})

export const createPolycabScraper = ({
  now = () => new Date().toISOString(),
} = {}) => {
  const baseScraper = createConfiguredScraper()

  return {
    ...baseScraper,
    run: async (options = {}) => {
      const jobs = await baseScraper.run(options)
      const scrapedAt = now()

      return mapJobsWithInventoryEvidence(jobs, (job) => ({
        ...job,
        scrapedAt,
      }))
    },
  }
}

const scraper = createPolycabScraper()

export const {
  buildCareersPageUrl,
  buildListingApiUrl,
  buildJobDetailUrl,
  extractSearchResults,
  run,
} = scraper
