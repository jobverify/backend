import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SAARTHI_CATALOG = {
  source: 'saarthi',
  companyName: 'Saarthi',
  officialBrandName: 'Saarthi',
  adapter: 'script',
  homepageUrl: 'https://www.joinsaarthi.com/',
  companyCareerPage: 'https://joinsaarthi.com/about',
  publicMarketplaceUrl: 'https://www.joinsaarthi.com/',
  companyDomain: 'joinsaarthi.com',
  atsPlatform: 'official-job-marketplace-no-company-careers',
  countryFilter: 'India',
  paginationStrategy: 'static-about-page-plus-homepage-marketplace-validation',
  extractionStrategy:
    'verified-about-page+verified-homepage-marketplace-third-party-jobs+no-exact-company-careers-return-empty',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-17',
  verifiedSurfaceSummary:
    "Verified on Friday, July 17, 2026 that https://joinsaarthi.com/about is the official exact-name Saarthi company about page and that https://www.joinsaarthi.com/ is the first-party product surface for Saarthi's fresher-jobs marketplace. The about page states that Saarthi tracks 15,000+ companies every day, and the homepage surfaces third-party jobs and drives from companies such as SLB, Honeywell International, Bayer, American Chase, NielsenIQ, and IndiaMART rather than exact-name Saarthi openings. Because no trustworthy exact-name Saarthi careers surface was exposed, this provider is a fail-closed sentinel that returns no jobs.",
  modulePath: path.resolve(currentDir, 'script.js'),
  dryRunFile: 'saarthi/jobs.json',
}

export default SAARTHI_CATALOG
