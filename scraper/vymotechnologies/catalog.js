import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const VYMO_TECHNOLOGIES_CATALOG = {
  source: 'vymotechnologies',
  companyName: 'Vymo Technologies',
  officialBrandName: 'Vymo',
  adapter: 'script',
  modulePath: path.join(currentDir, 'script.js'),
  homepageUrl: 'https://vymo.com/',
  companyCareerPage: 'https://vymo.com/careers/',
  atsPlatform: 'first-party-gatsby-careers-page',
  countryFilter: 'India',
  paginationStrategy: 'first-party-careers-page-shell-validation-return-empty',
  extractionStrategy: 'verified-first-party-careers-shell+no-promoted-public-job-parser',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  companyDomain: 'vymo.com',
  dryRunFile: 'vymotechnologies/jobs.json',
  verifiedOn: '2026-07-17',
  verifiedSurfaceSummary:
    'Verified on Friday, July 17, 2026 that https://vymo.com/careers/ was the live first-party Vymo careers page, rendered as a Gatsby page titled "Careers | Vymo" with canonical URL https://vymo.com/careers/ and first-party page metadata describing Vymo’s AI and automation hiring pitch.',
}

export default VYMO_TECHNOLOGIES_CATALOG
