import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const APPCINO_TECHNOLOGIES_CATALOG = {
  source: 'appcinotechnologies',
  companyName: 'Appcino Technologies',
  officialBrandName: 'Appcino Technologies | Part of Xebia',
  adapter: 'script',
  modulePath: path.resolve(currentDir, 'script.js'),
  companyCareerPage: 'https://xebia.com/careers/',
  companyDomain: 'xebia.com',
  atsPlatform: 'parent-company-careers-hub-no-appcino-inventory',
  countryFilter: 'India',
  paginationStrategy: 'single-parent-careers-hub-sentinel',
  extractionStrategy: 'appcino-acquisition-verification+parent-careers-hub-detection+fail-closed-sentinel',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-18',
  verifiedSurfaceSummary:
    'Verified on Saturday, July 18, 2026 that Xebia publicly identifies Appcino as part of Xebia and routes recruiting through the general Xebia careers hub at https://xebia.com/careers/, but that public hub does not expose a trustworthy Appcino-specific jobs inventory. The local scraper therefore fails closed until Appcino or Xebia publishes company-attributable openings for this brand.',
}

export default APPCINO_TECHNOLOGIES_CATALOG
