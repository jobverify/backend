import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const GARDEN_REACH_SHIPBUILDERS_CATALOG = {
  source: 'gardenreachshipbuilders',
  companyName: 'Garden Reach Shipbuilders',
  officialBrandName: 'Garden Reach Shipbuilders & Engineers Limited',
  adapter: 'script',
  modulePath: path.resolve(currentDir, 'script.js'),
  dryRunFile: 'gardenreachshipbuilders/jobs.json',
  homepageUrl: 'https://www.grse.in/',
  companyCareerPage: 'https://www.grse.in/career/index',
  verifiedApplyPortalUrls: [
    'https://jobapply.in/grse2026/',
    'https://jobapply.in/grse2025/',
  ],
  companyDomain: 'grse.in',
  atsPlatform: 'official-company-careers-with-linked-public-apply-portal',
  countryFilter: 'India',
  dryRunEnrichPublicExperience: false,
  paginationStrategy: 'bounded-configured-native-notice-indices-with-current-corporate-delegation',
  extractionStrategy:
    'active-own-notice-identity+declared-detailed-pdf+individual-role-country-hold',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-11-11',
  sourceScopeComplete: false,
  sourceListingComplete: false,
  lifecycleCleanupAllowed: false,
  companyIndiaTotal: null,
  companyGlobalTotal: null,
  verifiedPublicJobCount: null,
  verifiedIndiaJobCount: null,
  verifiedSurfaceSummary:
    'Reviewed on November 11, 2026 (Asia/Kolkata; original captures November 10 UTC): current official careers https://www.grse.in/career/index explicitly delegates https://jobapply.in/grse2026 for native recruitment notification 2026/05(J&OP), JOURNEYMAN & DRIVER (VEHICLE). Configured public indices https://jobapply.in/grse2026/ and https://jobapply.in/grse2025/ expose 4 and 11 native notice observations respectively, with 1 active notice opening October 30 and closing November 28, 2026. Its exact own detailed advertisement https://jobapply.in/GRSE2026Journeyman/adv_eng.pdf advertises aggregate slots of 55 Journeyman and 3 Driver positions; these are not 58 individual vacancy records. The notification ID is not an individual job or requisition ID. Individual role country, formal job IDs and individual role full criteria remain unknown; nationality, government affiliation, company office and city names cannot establish India worksite country. Ordinary local PDF text extraction is document observation only. The actual registered restricted worker reaches the PDF then holds with the exact cached DOMMatrix is not defined PDF.js/native-addons failure; native PDF capability is not repaired. No qualified individual jobs or verified zero, source/company completeness, company totals or lifecycle cleanup are claimed.',
}

export default GARDEN_REACH_SHIPBUILDERS_CATALOG
