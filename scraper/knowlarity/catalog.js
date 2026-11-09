import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const KNOWLARITY_CATALOG = {
  source: 'knowlarity',
  companyName: 'Knowlarity',
  officialBrandName: 'Knowlarity',
  adapter: 'script',
  modulePath: path.join(currentDir, 'script.js'),
  companyCareerPage: 'https://www.knowlarity.com/careers',
  homepageUrl: 'https://www.knowlarity.com/',
  companyDomain: 'knowlarity.com',
  atsPlatform: 'official-company-site-no-public-careers',
  countryFilter: 'India',
  paginationStrategy: 'verified-first-party-careers-empty-state',
  extractionStrategy:
    'verified-careers-page+embedded-next-data-empty-jobOpening-array+empty-state-email-resume-cta',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  dryRunFile: 'knowlarity/jobs.json',
  verifiedOn: '2026-08-15',
  verifiedSurfaceSummary:
    'Verified on Saturday, August 15, 2026 that https://www.knowlarity.com/careers still resolves to the official first-party Knowlarity careers page, that the visible JOB OPENINGS section still only exposes Location and Department dropdowns plus the empty-state CTA EMAIL US YOUR RESUME with Not Matched any profile, and that the embedded Next.js page data still contains jobOpening: []. Direct Node fetches from this runtime currently fail certificate verification, but the first-party page remains reachable through the shared browser-backed HTTPS fallback and still exposes no trustworthy public jobs surface to scrape.',
}

export default KNOWLARITY_CATALOG
