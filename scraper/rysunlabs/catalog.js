import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const RYSUN_LABS_CATALOG = {
  source: 'rysunlabs',
  companyName: 'Rysun Labs',
  officialBrandName: 'Rysun Labs',
  adapter: 'script',
  homepageUrl: 'https://www.rysun.com/',
  companyCareerPage: 'https://www.rysun.com/',
  observedPublicJobsUrl: 'https://rysun-labs-inc.careerplug.com/jobs?locale=en',
  companyDomain: 'rysun.com',
  atsPlatform: 'third-party-careerplug-untrusted',
  countryFilter: 'India',
  paginationStrategy: 'third-party-board-sentinel',
  extractionStrategy: 'verified-third-party-careerplug-board-without-first-party-jobs-surface-return-empty',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-18',
  verifiedSurfaceSummary:
    'Verified on Saturday, July 18, 2026 that the only discoverable public Rysun jobs board was the third-party CareerPlug page at https://rysun-labs-inc.careerplug.com/jobs?locale=en. There is no trustworthy first-party jobs surface confirmed on https://www.rysun.com/, so the local provider stays fail-closed and returns no jobs until an official first-party careers page is verifiable.',
  modulePath: path.join(currentDir, 'script.js'),
}

export default RYSUN_LABS_CATALOG
