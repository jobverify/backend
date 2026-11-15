import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOROCO_CATALOG = {
  source: 'soroco',
  companyName: 'Soroco',
  officialBrandName: 'Soroco',
  adapter: 'script',
  homepageUrl: 'https://soroco.com/',
  companyCareerPage: 'https://soroco.com/careers/',
  allOpeningsUrl: 'https://soroco.com/all-job-openings/',
  embeddedGreenhouseApiUrl: 'https://boards-api.greenhouse.io/v1/boards/soroco/jobs?content=true',
  companyDomain: 'soroco.com',
  atsPlatform: 'official-company-careers',
  countryFilter: 'India',
  paginationStrategy: 'current-declared-native-public-listing-and-closing',
  extractionStrategy:
    'finite-current-corporate-srcdoc-and-clients+original-native-full-role-data+explicit-country+closing',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-11-14',
  verifiedPublicJobCount: 2,
  verifiedIndiaJobCount: 2,
  verifiedSampleJobUrl: 'https://soroco.zohorecruit.com/jobs/Careers/836634000001765193/General-Counsel?source=CareerSite',
  verifiedSurfaceSummary:
    'Verified November 14, 2026: the exact current first-party careers documents declare the own Soroco Zoho Careers account. Two native roles have literal India countries, complete original rich criteria as native data, an explicit Soroco internal organization and matching closing records. Original August Date_Opened values are retained; first-ever publication, current CSS coverage, rendered application activation and complete company scope are unverified, with lifecycle cleanup held. The legacy Greenhouse reference is unused.',
  modulePath: path.join(currentDir, 'script.js'),
  dryRunFile: path.join(currentDir, 'jobs.json'),
}

export default SOROCO_CATALOG
