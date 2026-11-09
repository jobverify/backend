import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const ALLIED_DIGITAL_SERVICES_CATALOG = {
  source: 'allieddigitalservices',
  companyName: 'Allied Digital Services',
  officialBrandName: 'Allied Digital Services Ltd',
  adapter: 'script',
  companyCareerPage: 'https://www.allieddigital.net/careers/',
  companyDomain: 'allieddigital.net',
  hiringNowPageUrl: 'https://www.allieddigital.net/job-openings/',
  jobsApiUrl: 'https://www.allieddigital.net/wp-json/wp/v2/awsm_job_openings',
  atsPlatform: 'wordpress-job-openings',
  countryFilter: 'India',
  paginationStrategy: 'count-checked-wordpress-rest-pages+two-own-detail-passes+final-public-inventory-and-corporate-announcements',
  extractionStrategy: 'current-first-party-publisher+public-native-post-identities+complete-public-criteria+all-native-workplace-alternatives+explicit-gaps',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: null,
  verifiedAt: null,
  verifiedPublicJobCount: null,
  verifiedIndiaJobCount: null,
  zeroResultPolicy: 'evidence-required',
  sourceScopeComplete: false,
  lifecycleCleanupAllowed: false,
  verifiedSurfaceSummary:
    'Current runtime checks the same-company public WordPress opening cards, authoritative REST counts, native canonical/alternate posting identities, full own-role criteria and every workplace interpretation. Two own-detail passes precede the final public inventory. Corporate hiring-table announcements are retained separately when criteria or public reveal evidence is unavailable. City-only addresses remain country-unknown, posting IDs never become formal requisitions, and private application controls do not gate public extraction. Source qualification and counts require fresh runtime evidence; company-wide scope and cleanup remain unproved.',
  dryRunFile: 'allieddigitalservices/jobs.json',
  modulePath: path.resolve(currentDir, 'script.js'),
}

export default ALLIED_DIGITAL_SERVICES_CATALOG
