import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const VERIFIED_SURFACE_SUMMARY =
  "Inspected on November 7, 2026: the official BHEL homepage https://www.bhel.com/ declares https://careers.bhel.in/index.jsp, whose 13 visible recruitment announcements are not individual verified vacancies. The first Artisan Recruitment 2027 campaign publishes Advt. 01/2026, its full six-page advertisement and two referenced corrigenda. Preserve native unit/trade coordinates, full available original content and a tentative campaign headcount of 660 without inferring country, posting dates, role requisition IDs or company totals. Its exact unit-wise vacancy PDF URL returns an HTML JavaScript/cookie challenge; stop all further requests there. Original country/publication/full coupled-document and company scope remain unverified; no India or verified-empty credit."


export const BHARAT_HEAVY_ELECTRICALS_CATALOG = {
  source: 'bharatheavyelectricals',
  companyName: 'Bharat Heavy Electricals',
  officialBrandName: 'Bharat Heavy Electricals Limited',
  adapter: 'script',
  modulePath: path.join(currentDir, 'script.js'),
  dryRunFile: 'bharatheavyelectricals/jobs.json',
  homepageUrl: 'https://www.bhel.com/',
  homepageLinkedCareersUrl: 'https://careers.bhel.in/index.jsp',
  companyCareerPage: 'https://careers.bhel.in/index.jsp',
  companyDomain: 'bhel.com',
  atsPlatform: 'official-recruitment-notices-pdf-bundles',
  countryFilter: 'India',
  paginationStrategy: 'company-declared-coupled-documents+bounded-sequential-first-failure-stop+scope-unverified',
  extractionStrategy:
    'company-careers-card+visible-announcements+native-advertisement-and-corrections+unit-trade-matrix+first-unqualified-stop',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-11-07',
  verifiedSurfaceSummary: VERIFIED_SURFACE_SUMMARY,
}

export default BHARAT_HEAVY_ELECTRICALS_CATALOG
