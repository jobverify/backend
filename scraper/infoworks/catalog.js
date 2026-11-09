import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const INFOWORKS_CATALOG = {
  source: 'infoworks',
  companyName: 'Infoworks',
  adapter: 'script',
  companyCareerPage: 'https://www.infoworks.io/',
  homepageUrl: 'https://www.infoworks.io/',
  officialAcquisitionUrl: 'https://www.uniphore.com/infoworks/',
  parentCareersUrl: 'https://www.uniphore.com/careers/',
  officialBrandName: 'InfoWorks',
  parentCompanyName: 'Uniphore',
  atsPlatform: 'acquired-company-landing-page-no-public-careers',
  countryFilter: 'Global',
  paginationStrategy: 'verified-infoworks-domain-redirects-to-acquisition-landing-page',
  extractionStrategy:
    'verified-infoworks-domain-routes-redirect-to-uniphore-acquisition-page+no-exact-name-public-jobs-surface-return-empty',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  companyDomain: 'infoworks.io',
  verifiedOn: '2026-07-17',
  verifiedSurfaceSummary:
    'Verified on Friday, July 17, 2026 that https://www.infoworks.io/ redirected to the first-party acquisition landing page at https://www.uniphore.com/infoworks/, where Uniphore acquired Infoworks. Verified that adjacent exact-name routes https://www.infoworks.io/careers, https://www.infoworks.io/jobs, and https://www.infoworks.io/about also resolved to the same acquisition landing page instead of exposing an Infoworks-specific jobs board. The visible Careers link on that first-party page pointed only to the broader parent-company page at https://www.uniphore.com/careers/, so there was no trustworthy exact-name public jobs surface for Infoworks on Friday, July 17, 2026.',
  firstPartyRedirectRoutes: [
    'https://www.infoworks.io/',
    'https://www.infoworks.io/careers',
    'https://www.infoworks.io/jobs',
    'https://www.infoworks.io/about',
  ],
  modulePath: path.join(currentDir, 'script.js'),
  dryRunFile: path.join(currentDir, 'jobs.json'),
}

export default INFOWORKS_CATALOG
