import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SAHAJ_E_VILLAGE_CATALOG = {
  source: 'sahajevillage',
  companyName: 'Sahaj e-Village',
  officialBrandName: 'Sahaj e-Village Limited',
  adapter: 'script',
  companyInfoUrl: 'https://skilldevelopment.sahajcorporate.com/',
  companyCareerPage: 'https://cblearning.sahajcorporate.com/elportal/home/join_us.php',
  learningHomeUrl: 'https://cblearning.sahajcorporate.com/elportal/home/index.php',
  companyDomain: 'sahajcorporate.com',
  atsPlatform: 'legacy-first-party-site-no-public-careers',
  countryFilter: 'India',
  paginationStrategy: 'legacy-company-info-plus-elearning-join-us-validation',
  extractionStrategy:
    'verified-company-info-page+verified-elearning-join-us-page+no-public-company-jobs-return-empty',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-17',
  verifiedSurfaceSummary:
    'Verified on Friday, July 17, 2026 that https://skilldevelopment.sahajcorporate.com/ remained a live first-party Sahaj e-Village Ltd information page with legacy company details, and that https://cblearning.sahajcorporate.com/elportal/home/join_us.php was a first-party Sahaj eLearning course-pricing and benefits page titled "Why Join Sahaj eLearning Courses" rather than a company careers board. There is no trustworthy public company jobs surface for the exact-name Sahaj e-Village backlog row on the verified first-party domains.',
  dryRunFile: 'sahajevillage/jobs.json',
  modulePath: path.resolve(currentDir, 'script.js'),
}

export default SAHAJ_E_VILLAGE_CATALOG
