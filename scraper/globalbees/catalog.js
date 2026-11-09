import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const GLOBALBEES_CATALOG = {
  source: 'globalbees',
  companyName: 'GlobalBees',
  officialBrandName: 'GlobalBees',
  adapter: 'script',
  companyCareerPage: 'https://www.globalbees.com/career.html',
  companyDomain: 'globalbees.com',
  homepageUrl: 'https://www.globalbees.com/',
  atsPlatform: 'official-company-site-no-public-careers',
  countryFilter: 'India',
  paginationStrategy: 'homepage-plus-career-page-validation',
  extractionStrategy:
    'verified-homepage+verified-careers-contact-form+no-trustworthy-public-job-records-return-empty',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-16',
  verifiedSurfaceSummary:
    'Verified on July 16, 2026 that https://www.globalbees.com/ and https://www.globalbees.com/career.html are live first-party GlobalBees pages. The public careers page presents employer-brand copy, a careers@globalbees.com email handoff, and a send-us-your-CV contact form, but no trustworthy public job listings or ATS-backed opening records.',
  modulePath: path.join(currentDir, 'script.js'),
}

export default GLOBALBEES_CATALOG
