import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const LAVENDER_TECHNOLOGY_CATALOG = {
  source: 'lavendertechnology',
  companyName: 'Lavender Technology',
  officialBrandName: 'Lavender Technologies',
  adapter: 'script',
  homepageUrl: 'https://lavendertechnologies.com/',
  companyCareerPage: 'https://lavendertechnologies.com/',
  companyDomain: 'lavendertechnologies.com',
  atsPlatform: 'first-party-homepage-without-public-careers-surface',
  countryFilter: 'India',
  paginationStrategy: 'homepage-only-no-careers-or-jobs-surface',
  extractionStrategy:
    'verified-exact-name-homepage+no-public-careers-surface+fail-closed-sentinel',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-18',
  verifiedSurfaceSummary:
    'Verified on Saturday, July 18, 2026 that https://lavendertechnologies.com/ is the exact-name Lavender Technologies first-party homepage, that its primary navigation reads "Home About Products Contact Get Quote," and that the public surface only exposes company/contact content such as Alappuzha, Kerala, India with no public careers or jobs page. Because no trustworthy public jobs inventory is exposed, this local provider is pinned fail-closed.',
  modulePath: path.resolve(currentDir, 'script.js'),
  dryRunFile: 'lavendertechnology/jobs.json',
}

export default LAVENDER_TECHNOLOGY_CATALOG
