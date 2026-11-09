import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const FLATWORLD_MORTGAGE_PROCESSING_CATALOG = {
  source: 'flatworldmortgageprocessing',
  companyName: 'Flatworld Mortgage Processing',
  officialBrandName: 'Flatworld Mortgage Pvt. Ltd.',
  adapter: 'script',
  homepageUrl: 'https://www.flatworldmortgage.com/',
  companyCareerPage: 'https://www.flatworldsolutions.com/careers/forms/apply.php',
  companyDomain: 'flatworldsolutions.com',
  atsPlatform: 'first-party-generic-careers-form',
  countryFilter: 'India',
  paginationStrategy: 'single-generic-application-form',
  extractionStrategy:
    'verified-generic-application-form+role-dropdown-without-public-openings+fail-closed-sentinel',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-18',
  verifiedSurfaceSummary:
    'Verified on Saturday, July 18, 2026 that https://www.flatworldsolutions.com/careers/forms/apply.php was the live public Flatworld application form, that it exposed the generic "Please fill in the form below" flow with a Select profile applying for dropdown including Mortgage Processor and Mortgage Underwriters, and that the verified page did not expose a public openings list or job-specific inventory for Flatworld Mortgage Processing. This provider therefore stays fail-closed.',
  modulePath: path.join(currentDir, 'script.js'),
}

export default FLATWORLD_MORTGAGE_PROCESSING_CATALOG
