import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const VERIFIED_SURFACE_SUMMARY =
  'Verified on July 16, 2026 that https://www.indusface.com/career/ is the live first-party Indusface careers landing page, that https://www.indusface.com/careers/current-openings/ is the public first-party openings page, and that page currently renders five public role cards including Application Security Analyst and Associate Engineer, Managed Security Services. Verified the first-party detail route https://www.indusface.com/careers/current-openings/information-security-analyst/ and its on-page application form posting to /wp-content/themes/indusface/sentmail/.'

export const INDUSFACE_CATALOG = {
  source: 'indusface',
  companyName: 'Indusface',
  officialBrandName: 'Indusface',
  adapter: 'script',
  companyCareerPage: 'https://www.indusface.com/careers/current-openings/',
  homepageUrl: 'https://www.indusface.com/career/',
  sampleJobUrl: 'https://www.indusface.com/careers/current-openings/information-security-analyst/',
  companyDomain: 'indusface.com',
  atsPlatform: 'official-first-party-html-jobs-form',
  countryFilter: 'India',
  paginationStrategy: 'single-first-party-current-openings-page-plus-detail-pages',
  extractionStrategy:
    'verified-first-party-current-openings-page+html-job-cards+first-party-detail-pages+on-page-join-form',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-16',
  verifiedSurfaceSummary: VERIFIED_SURFACE_SUMMARY,
  dryRunFile: 'indusface/jobs.json',
  modulePath: path.resolve(currentDir, 'script.js'),
}

export default INDUSFACE_CATALOG
