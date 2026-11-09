import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const AKHIL_SYSTEMS_CATALOG = {
  source: 'akhilsystems',
  companyName: 'Akhil Systems',
  legalEntityName: 'Akhil Systems Pvt. Ltd.',
  adapter: 'script',
  companyCareerPage: 'https://akhilsystems.com/OurCareer/',
  companyDomain: 'akhilsystems.com',
  officialHomepageUrl: 'https://akhilsystems.com/',
  officialHomepageCareerUrl: 'https://akhilsystems.com/OurCareer/',
  canonicalCareersUrl: 'https://akhilsystems.com/OurCareer/',
  atsPlatform: 'official-company-careers',
  countryFilter: 'India',
  paginationStrategy: 'single-first-party-careers-page-inline-job-cards',
  extractionStrategy:
    'verified-homepage-career-link+verified-canonical-careers-page+inline-first-party-job-cards',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-19',
  verifiedSurfaceSummary:
    'Verified on July 19, 2026 that https://akhilsystems.com/ is the live first-party site for Akhil Systems Pvt. Ltd., the homepage Career navigation resolves to https://akhilsystems.com/OurCareer/, and that first-party careers page exposes inline job cards for India roles.',
  modulePath: path.join(currentDir, 'script.js'),
}

export default AKHIL_SYSTEMS_CATALOG
