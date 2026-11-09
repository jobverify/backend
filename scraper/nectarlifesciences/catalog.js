import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const VERIFIED_SURFACE_SUMMARY =
  'Verified on Monday, August 3, 2026 that https://www.neclife.com/ is the live official Nectar Lifesciences homepage and links Careers to https://www.neclife.com/careers. The official careers URL still renders only the site shell/navigation/footer with the title "Careers | My Site" and no trustworthy public job listings, ATS handoff, or public job detail pages.'

export const NECTAR_LIFESCIENCES_CATALOG = {
  source: 'nectarlifesciences',
  companyName: 'Nectar Lifesciences',
  officialBrandName: 'Nectar Lifesciences Ltd.',
  adapter: 'script',
  modulePath: path.join(currentDir, 'script.js'),
  homepageUrl: 'https://www.neclife.com/',
  companyCareerPage: 'https://www.neclife.com/careers',
  companyDomain: 'neclife.com',
  atsPlatform: 'official-company-careers-no-public-jobs',
  countryFilter: 'India',
  paginationStrategy: 'homepage-plus-careers-page-shell-validation',
  extractionStrategy: 'verified-homepage+verified-careers-page-without-public-listings-return-empty',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-08-03',
  verifiedSurfaceSummary: VERIFIED_SURFACE_SUMMARY,
}

export default NECTAR_LIFESCIENCES_CATALOG
