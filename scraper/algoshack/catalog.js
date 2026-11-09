import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const ALGOSHACK_CATALOG = {
  source: 'algoshack',
  companyName: 'AlgoShack',
  adapter: 'script',
  companyCareerPage: 'https://algoshack.keka.com/careers',
  companyDomain: 'algoshack.com',
  atsPlatform: 'keka-embed-api',
  countryFilter: 'India',
  paginationStrategy: 'single-keka-active-jobs-endpoint',
  extractionStrategy: 'verified-public-keka-careers-shell+embedded-khConfig+active-keka-embed-api',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-18',
  verifiedSurfaceSummary:
    'Verified on Saturday, July 18, 2026 that https://algoshack.keka.com/careers was the live public AlgoShack Keka careers shell, that its embedded khConfig resolved to the active jobs feed for identifier f5063fa6-0819-41ce-971a-1cf377fd6636, and that the verified feed exposed India openings including Automation Engineer and Project Lead in Bangalore. The root algoshack.com homepage was bot-gated during live checks, so the public Keka endpoint is the trustworthy first-party jobs surface used here.',
  modulePath: path.join(currentDir, 'script.js'),
}

export default ALGOSHACK_CATALOG
