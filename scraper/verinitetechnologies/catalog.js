import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const VERINITE_TECHNOLOGIES_CATALOG = {
  source: 'verinitetechnologies',
  companyName: 'Verinite Technologies',
  officialBrandName: 'Verinite Technologies',
  adapter: 'script',
  homepageUrl: 'https://www.verinite.com/',
  companyCareerPage: 'https://www.verinite.com/careers.html',
  companyDomain: 'verinite.com',
  atsPlatform: 'official-first-party-job-card-page',
  countryFilter: 'India',
  paginationStrategy: 'single-careers-page-job-cards',
  extractionStrategy: 'verified-first-party-careers-page+job-cards+detail-links',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-18',
  verifiedSurfaceSummary:
    'Verified on Saturday, July 18, 2026 that https://www.verinite.com/careers.html was the live first-party Verinite Technologies careers page and that it publicly exposed job cards with relative detail links including Prime Test Lead and Powercard L2 Support on the verified date.',
  dryRunFile: 'verinitetechnologies/jobs.json',
  modulePath: path.resolve(currentDir, 'script.js'),
}

export default VERINITE_TECHNOLOGIES_CATALOG
