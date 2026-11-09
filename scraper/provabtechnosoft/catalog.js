import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PROVAB_TECHNOSOFT_CATALOG = {
  source: 'provabtechnosoft',
  companyName: 'Provab Technosoft',
  officialBrandName: 'PROVAB TECHNOSOFT',
  adapter: 'script',
  homepageUrl: 'https://www.provab.com/',
  companyCareerPage: 'https://www.provab.com/jobs/',
  atsPlatform: 'first-party-generic-application-form-no-public-openings',
  countryFilter: 'India',
  paginationStrategy: 'single-first-party-jobs-form-page',
  extractionStrategy:
    'verified-generic-application-form+role-dropdown-without-public-openings+fail-closed-sentinel',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  companyDomain: 'provab.com',
  verifiedOn: '2026-07-18',
  verifiedSurfaceSummary:
    'Verified on Saturday, July 18, 2026 that https://www.provab.com/jobs/ was the live first-party PROVAB jobs page, that it exposed only a generic application form with role dropdown choices including Android Developers, Python Developers, and UI / UX Designer, and that there was no public opening list or job-detail inventory. This provider stays fail-closed.',
  modulePath: path.resolve(currentDir, 'script.js'),
}

export default PROVAB_TECHNOSOFT_CATALOG
