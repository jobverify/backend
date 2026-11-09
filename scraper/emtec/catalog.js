import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const EMTEC_CATALOG = {
  source: 'emtec',
  companyName: 'Emtec',
  officialBrandName: 'Bridgenext',
  adapter: 'script',
  modulePath: path.resolve(currentDir, 'script.js'),
  companyCareerPage: 'https://www.bridgenext.com/company/careers/',
  companyDomain: 'emtecinc.com',
  atsPlatform: 'parent-brand-careers-page-external-icims-handoff-sentinel',
  countryFilter: 'India',
  paginationStrategy: 'single-parent-careers-page-external-handoff-sentinel',
  extractionStrategy:
    'emtec-brand-unification-verification+bridgenext-careers-india-section+external-icims-handoff-detection+fail-closed-sentinel',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-18',
  verifiedSurfaceSummary:
    'Verified on Saturday, July 18, 2026 that Bridgenext is the unified public brand for Emtec, that https://www.bridgenext.com/company/careers/ is the live public careers page for the merged company, and that the page exposes an India Openings section but hands applicants off to careers-bridgenext.icims.com instead of publishing a trustworthy first-party jobs inventory on the company domain. The local scraper therefore fails closed until Emtec/Bridgenext exposes stable first-party company-attributable listings.',
}

export default EMTEC_CATALOG
