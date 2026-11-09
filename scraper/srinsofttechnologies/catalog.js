import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SRINSOFT_TECHNOLOGIES_CATALOG = {
  source: 'srinsofttechnologies',
  companyName: 'SrinSoft Technologies',
  officialBrandName: 'SrinSoft',
  adapter: 'script',
  homepageUrl: 'https://www.srinsofttech.com/',
  companyCareerPage: 'https://www.srinsofttech.com/career.html',
  applyFormUrl: 'https://www.srinsofttech.com/career.html#form_sec',
  contactEmail: 'tms@srinsofttech.com',
  atsPlatform: 'official-first-party-accordion-careers-page',
  countryFilter: 'India',
  paginationStrategy: 'single-page-accordion-list',
  extractionStrategy: 'verified-first-party-accordion-jobs+common-apply-form+india-location-filter',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  companyDomain: 'srinsofttech.com',
  verifiedOn: '2026-07-18',
  verifiedSurfaceSummary:
    'Verified on Saturday, July 18, 2026 that https://www.srinsofttech.com/career.html is the live first-party SrinSoft careers page and that it publicly exposes role accordion entries with location, experience, and job description fields, all pointing to a shared first-party apply form. Verified public entries include Test Engineer - QA and Senior DevOps Engineer, so this local scraper extracts only the India-facing accordion roles.',
  modulePath: path.join(currentDir, 'script.js'),
}

export default SRINSOFT_TECHNOLOGIES_CATALOG
