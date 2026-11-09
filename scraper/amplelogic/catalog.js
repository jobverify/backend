import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const AMPLELOGIC_CATALOG = {
  source: 'amplelogic',
  companyName: 'AmpleLogic',
  adapter: 'script',
  companyCareerPage: 'https://www.amplelogic.com/careers',
  companyDomain: 'amplelogic.com',
  atsPlatform: 'official-first-party-job-cards',
  countryFilter: 'India',
  paginationStrategy: 'single-first-party-careers-page',
  extractionStrategy: 'verified-first-party-careers-page+first-party-job-cards+same-page-apply-cta',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-18',
  verifiedSurfaceSummary:
    'Verified on Saturday, July 18, 2026 that https://www.amplelogic.com/careers was the live first-party AmpleLogic careers page and that it publicly exposed same-page job cards including Lead Generation Executive, Sales Manager – B2B SaaS / aPaaS - Domestic, Electronic Lab Notebook (ELN) Domain Expert, Sales Manager – B2B SaaS / aPaaS -Europe region, and Join Our 90-Day Internship Program. The verified cards exposed India job metadata such as Hyderabad, India, Full-time, and experience ranges directly on the first-party page alongside Apply Now and View Details CTAs.',
  modulePath: path.join(currentDir, 'script.js'),
}

export default AMPLELOGIC_CATALOG
