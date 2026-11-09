import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SATTVA_MEDIA_CATALOG = {
  source: 'sattvamedia',
  companyName: 'Sattva Media',
  officialBrandName: 'Sattva Consulting',
  legalEntityName: 'Sattva Media and Consulting Private Limited',
  adapter: 'script',
  companyCareerPage: 'https://www.sattva.co.in/join-us/careers/',
  homepageUrl: 'https://www.sattva.co.in/join-us/',
  officialCareersPageUrl: 'https://www.sattva.co.in/join-us/careers/',
  officialJobsBoardUrl: 'https://sattva-talent.freshteam.com/jobs',
  detailUrlPattern: 'https://sattva-talent.freshteam.com/jobs/{opaque_id}/{slug}',
  companyDomain: 'sattva.co.in',
  atsPlatform: 'freshteam',
  countryFilter: 'India',
  paginationStrategy: 'official-careers-page-plus-public-freshteam-board',
  extractionStrategy: 'verified-join-us-page+verified-careers-page-cta+public-freshteam-board+detail-page-apply-surface',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-17',
  verifiedSurfaceSummary:
    'Verified on Friday, July 17, 2026 that https://www.sattva.co.in/join-us/ is the live first-party Join Us landing page, https://www.sattva.co.in/join-us/careers/ is the live first-party Sattva careers page with a SEE ALL JOBS CTA, and the matching public jobs surface is the Sattva Freshteam board at https://sattva-talent.freshteam.com/jobs whose current detail pages identify the recruiting legal entity as Sattva Media and Consulting Private Limited.',
  modulePath: path.join(currentDir, 'script.js'),
}

export default SATTVA_MEDIA_CATALOG
