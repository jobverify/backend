import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const MOONFROG_LABS_CATALOG = {
  source: 'moonfroglabs',
  companyName: 'Moonfrog Labs',
  officialBrandName: 'Moonfrog Labs Private Limited',
  adapter: 'script',
  homepageUrl: 'https://moonfroglabs.com/',
  companyCareerPage: 'https://moonfroglabs.com/careers/',
  recruitmentPrivacyPolicyUrl: 'https://moonfroglabs.com/recruitment-privacy-policy/',
  applicationEmail: 'hr@moonfroglabs.com',
  applicationUrl: 'mailto:hr@moonfroglabs.com',
  companyDomain: 'moonfroglabs.com',
  atsPlatform: 'official-company-site-no-public-careers',
  countryFilter: 'India',
  paginationStrategy:
    'verified-homepage-plus-careers-no-openings-message-plus-common-route-404-validation',
  extractionStrategy:
    'verified-homepage+verified-careers-no-openings-message+verified-missing-common-job-routes-return-empty',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-08-03',
  verifiedSurfaceSummary:
    'Verified on Monday, August 3, 2026 that https://moonfroglabs.com/ remained the live first-party homepage, that https://moonfroglabs.com/careers/ remained the branded careers page, and that the careers page still explicitly says "No Open Positions Currently" while directing speculative applicants to hr@moonfroglabs.com and LinkedIn. Verified that https://moonfroglabs.com/recruitment-privacy-policy/ remained the live recruitment privacy page for Moonfrog Labs Private Limited, and that adjacent first-party routes https://moonfroglabs.com/jobs/ and https://moonfroglabs.com/open-positions/ still returned 404 responses. There is no trustworthy public jobs surface for Moonfrog Labs on the verified date.',
  modulePath: path.resolve(currentDir, 'script.js'),
}

export default MOONFROG_LABS_CATALOG
