import path from 'node:path'
import { fileURLToPath } from 'node:url'
const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const EMBITEL_TECHNOLOGIES_CATALOG = {
  source: 'embiteltechnologies',
  companyName: 'Embitel Technologies',
  officialBrandName: 'Embitel Technologies India Pvt. Ltd.',
  adapter: 'script',
  homepageUrl: 'https://www.embitel.com/',
  companyCareerPage: 'https://www.embitel.com/work-with-us',
  openingsPageUrl: 'https://www.embitel.com/cariad-india-jobs',
  openingsHandoffUrl: 'https://www.embitel.com/cariad-india-openings',
  workdayBoardUrl: 'https://diconium.wd3.myworkdayjobs.com/Embitel_Technologies',
  workdayJobsApiUrl: 'https://diconium.wd3.myworkdayjobs.com/wday/cxs/diconium/Embitel_Technologies/jobs',
  verifiedHiringOrganization: 'embIND Embitel Technologies (India) Private Limited',
  jobsScriptUrl: 'https://www.embitel.com/wp-content/themes/astra-child/assets/embitel/wdhub-job.js',
  jobsApiUrl: 'https://www.embitel.com/wp-admin/admin-ajax.php',
  companyDomain: 'embitel.com',
  atsPlatform: 'first-party-ajax+workday',
  countryFilter: 'India',
  paginationStrategy: 'complete-native-workday-pages-and-stable-snapshot',
  extractionStrategy: 'verified-embitel-handoff+full-native-workday+employer-country-applicable-details+stable-count',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-10-09',
  verifiedPublicOpeningCount: 320,
  verifiedSurfaceSummary: "Verified October 9, 2026: the canonical official work-with-us page and CARIAD India Jobs client pin diconium.wd3.myworkdayjobs.com/Embitel_Technologies. The cached AJAX list has 358 rows/349 unique requisitions, including 41 absent native requisitions and missing 12 current native roles. Current unfiltered Workday inventory is 320 roles across 16 pages; all 320 full details name embIND Embitel Technologies (India) Private Limited, are posted/applicable, and confirm India (309 Bangalore/BLR office, 11 Pune). Runtime uses canonical first-party routes and full native paging/details/stable-count reconciliation, not cached AJAX titles or inventory. The historical HTTP307 is currently restored to200; future upstream failures remain errors.",
  modulePath: path.join(currentDir, 'script.js'),
  dryRunFile: path.join(currentDir, 'jobs.json'),
}

export default EMBITEL_TECHNOLOGIES_CATALOG
