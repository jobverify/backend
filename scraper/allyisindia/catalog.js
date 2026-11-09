import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const ALLYIS_INDIA_CATALOG = {
  source: 'allyisindia',
  companyName: 'Allyis India',
  officialBrandName: 'Tech Mahindra Allyis',
  adapter: 'script',
  homepageUrl: 'https://www.allyis.com/ind/careers',
  companyCareerPage: 'https://www.allyis.com/ind/careers',
  embeddedJobsUrl: 'https://staffing.allyisapps.com/home/listjobs/114025',
  atsPlatform: 'official-careers-page-plus-declared-embedded-jobs-handoff',
  countryFilter: 'India',
  paginationStrategy: 'single-first-party-careers-page-plus-declared-iframe-validation',
  extractionStrategy: 'verified-first-party-careers-page+declared-embedded-jobs-handoff+propagate-transport-errors',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  companyDomain: 'allyis.com',
  verifiedOn: '2026-08-01',
  verifiedSurfaceSummary:
    'Historical verification on Saturday, August 1, 2026 confirmed that https://www.allyis.com/ind/careers presents "Jobs at Allyis, India" for TechM Allyis and embeds the public jobs handoff iframe https://staffing.allyisapps.com/home/listjobs/114025. During that verification from this environment, the embedded staffing host timed out and remained unreachable. This source validates the declared handoff and propagates iframe transport failures unchanged; a reachable embedded jobs document requires a real scraper upgrade before jobs can be collected. These historical notes do not establish current vacancy counts or inventory completeness.',
  modulePath: path.resolve(currentDir, 'script.js'),
}

export default ALLYIS_INDIA_CATALOG
