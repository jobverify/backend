import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const NAS_ACADEMY_CATALOG = {
  source: 'nasacademy',
  companyName: 'Nas Academy',
  officialBrandName: 'Nas Academy',
  adapter: 'script',
  modulePath: path.resolve(currentDir, 'script.js'),
  companyCareerPage: 'https://www.nas.co/work-with-us',
  homepageUrl: 'https://nasacademy.com/',
  officialCareersHandoffUrl: 'https://linktr.ee/nascompany',
  companyDomain: 'nasacademy.com',
  atsPlatform: 'official-company-page-company-level-linktree-no-exact-nasacademy-board',
  countryFilter: 'Global',
  paginationStrategy: 'verified-page-plus-company-level-linktree-handoff',
  extractionStrategy:
    'official-nas-careers-page+company-level-linktree-links+no-exact-nas-academy-jobs-link',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  dryRunFile: 'nasacademy/jobs.json',
  verifiedOn: '2026-08-03',
  verifiedSurfaceSummary:
    'Verified on Monday, August 3, 2026 that https://www.nas.co/work-with-us is still the official Nas Company work-with-us page and still hands off via Explore Our Job Openings to https://linktr.ee/nascompany rather than to a dedicated Nas Academy board. The current Linktree now renders nested button markup, but the public handoff still only exposes company-level jobs links such as Nas Daily Jobs, Nas.com Jobs, and Nas Summit Jobs, with no trustworthy exact-name Nas Academy public jobs surface to scrape.',
}

export default NAS_ACADEMY_CATALOG
