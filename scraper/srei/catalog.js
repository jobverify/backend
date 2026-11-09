import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SREI_CATALOG = {
  source: 'srei',
  companyName: 'SREI',
  officialBrandName: 'SREI',
  adapter: 'script',
  companyCareerPage: 'https://www.srei.com/careers',
  companyDomain: 'srei.com',
  jobListingsUrl: 'https://www.myemploywise.com/asperm/servlet/website?customer_code=srei',
  portalOrigin: 'https://www.myemploywise.com',
  atsPlatform: 'official-company-site-no-public-careers',
  countryFilter: 'India',
  paginationStrategy: 'verified-first-party-careers-page-plus-unresolved-employwise-shell',
  extractionStrategy: 'verified-first-party-careers-page+verified-unresolved-employwise-shell-return-empty',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-17',
  verifiedSurfaceSummary:
    'Verified on Friday, July 17, 2026 that https://www.srei.com/careers is the live first-party SREI careers page and its Work with us handoff points to https://www.myemploywise.com/asperm/servlet/website?customer_code=srei. The linked EmployWise surface only exposed an unresolved Open Positions shell with Search by function(s) controls and repeated Please wait markers, with no trustworthy public job cards, detail URLs, or public API evidence, so there is no trustworthy public jobs surface right now.',
  modulePath: path.join(currentDir, 'script.js'),
}

export default SREI_CATALOG
