import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const BRAINIUM_INFORMATION_TECHNOLOGIES_CATALOG = {
  source: 'brainiuminformationtechnologies',
  companyName: 'Brainium Information Technologies',
  officialBrandName: 'Brainium Information Technologies Pvt Ltd',
  adapter: 'script',
  homepageUrl: 'https://www.brainiuminfotech.com/',
  companyCareerPage: 'https://www.brainiuminfotech.com/careers',
  officialCareersPageUrl: 'https://www.brainiuminfotech.com/careers',
  companyDomain: 'brainiuminfotech.com',
  atsPlatform: 'first-party-html-open-roles',
  countryFilter: 'India',
  paginationStrategy: 'legacy-public-page-unverified-stop-on-access-denial',
  extractionStrategy: 'legacy-first-party-cards-unverified-access-denial-is-not-empty',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-10-27',
  verifiedSurfaceSummary:
    'On October 27, 2026 the current public careers GET returned HTTP 403. No homepage or alternative request followed the denial. Current roles, employer scope, details and India counts remain unverified; access denial throws and cannot establish empty inventory. Legacy card parsers remain unqualified for current extraction.',
  dryRunFile: 'brainiuminformationtechnologies/jobs.json',
  modulePath: path.resolve(currentDir, 'script.js'),
}

export default BRAINIUM_INFORMATION_TECHNOLOGIES_CATALOG
