import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SHORE_INFOTECH_INDIA_CATALOG = {
  source: 'shoreinfotechindia',
  companyName: 'Shore Infotech India',
  officialBrandName: 'Shore Group',
  adapter: 'script',
  companyCareerPage: 'https://www.shoregrp.com/',
  companyDomain: 'shoregrp.com',
  contactPageUrl: 'https://www.shoregrp.com/contact',
  atsPlatform: 'official-company-site-no-public-careers',
  countryFilter: 'India',
  paginationStrategy: 'homepage-plus-contact-plus-common-careers-route-validation',
  extractionStrategy: 'verified-homepage+verified-contact-page+verified-missing-careers-routes-return-empty',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-10-09',
  verifiedSurfaceSummary:
    'Verified on 2026-10-09 that https://www.shoregrp.com/ remains the first-party Shore Group homepage for the Shore Infotech India business family, and https://www.shoregrp.com/contact identifies the Hyderabad office. Current digital-services and operations-discovery-call copy is verified; /careers, /jobs, /join-us and /openings return first-party 404s. This is discovery-only evidence of checked routes, with incomplete inventory and unknown vacancy counts.',
  dryRunFile: 'shoreinfotechindia/jobs.json',
  modulePath: path.resolve(currentDir, 'script.js'),
}

export default SHORE_INFOTECH_INDIA_CATALOG
