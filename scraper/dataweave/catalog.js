import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const VERIFIED_SURFACE_SUMMARY =
  'Verified on July 15, 2026 that https://dataweave.com/ is the live official DataWeave homepage and its Careers link points to https://dataweave.com/us/careers. Verified that the first-party careers page at https://dataweave.com/us/careers currently exposes a Current Openings section with a visible Bangalore role, Technical Architect, linking to the same-domain detail page https://dataweave.com/jobs/09-202209210914-J/05-202605141139-R. Verified that the detail page is public, describes the Product Engineering role in Bangalore, India, and exposes an inline Apply Now form on the same first-party route.'

export const DATAWEAVE_CATALOG = {
  source: 'dataweave',
  companyName: 'DataWeave',
  adapter: 'script',
  homepageUrl: 'https://dataweave.com/',
  companyCareerPage: 'https://dataweave.com/us/careers',
  sampleJobUrl: 'https://dataweave.com/jobs/09-202209210914-J/05-202605141139-R',
  companyDomain: 'dataweave.com',
  atsPlatform: 'official-company-careers',
  countryFilter: 'India',
  paginationStrategy: 'single-first-party-careers-page-plus-detail-pages',
  extractionStrategy:
    'verified-homepage+verified-careers-page+visible-current-openings-list+same-domain-detail-page+inline-application-form',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-15',
  verifiedSurfaceSummary: VERIFIED_SURFACE_SUMMARY,
  dryRunFile: 'dataweave/jobs.json',
  modulePath: path.resolve(currentDir, 'script.js'),
}

export default DATAWEAVE_CATALOG
