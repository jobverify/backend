import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const EVOKE_TECHNOLOGIES_CATALOG = {
  source: 'evoketechnologies',
  companyName: 'Evoke Technologies',
  officialBrandName: 'Evoke Technologies',
  adapter: 'script',
  companyCareerPage: 'https://www.evoketechnologies.com/careers/',
  indiaJobsPageUrl: 'https://careers.evoketechnologies.com/go/India/733644/',
  companyDomain: 'evoketechnologies.com',
  atsPlatform: 'first-party-careers-site',
  countryFilter: 'India',
  paginationStrategy: 'single-country-listing-page',
  extractionStrategy: 'verified-first-party-careers-handoff+country-listing-table',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-18',
  verifiedSurfaceSummary:
    'Verified on Saturday, July 18, 2026 that https://www.evoketechnologies.com/careers/ was the live first-party Evoke careers page and that it linked View Job Openings to https://careers.evoketechnologies.com/. Verified the first-party India listing page at https://careers.evoketechnologies.com/go/India/733644/ rendered Results 1 – 7 of 7 Page 1 of 1 and listed openings including Technical Associate - .NET+Angular, Senior Technical Associate, and Technical/Solutions Architect - AI in Hyderabad, India.',
  modulePath: path.resolve(currentDir, 'script.js'),
  dryRunFile: 'evoketechnologies/jobs.json',
}

export default EVOKE_TECHNOLOGIES_CATALOG
