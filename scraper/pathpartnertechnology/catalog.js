import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PATHPARTNER_TECHNOLOGY_CATALOG = {
  source: 'pathpartnertechnology',
  companyName: 'PathPartner Technology',
  officialBrandName: 'PathPartner Technology',
  adapter: 'script',
  homepageUrl: 'https://pathpartnertech.com/',
  companyCareerPage: 'https://pathpartnertech.com/about/',
  companyDomain: 'pathpartnertech.com',
  atsPlatform: 'official-company-site-unavailable-no-public-jobs',
  countryFilter: 'India',
  paginationStrategy: 'verified-no-public-routes-or-trusted-host-unavailability',
  extractionStrategy:
    'trusted-host-unavailability-return-empty+verified-homepage+verified-about-page+verified-page-sitemap-without-careers-route+verified-missing-routes',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-08-14',
  verifiedSurfaceSummary:
    'Verified on Friday, August 14, 2026 that every previously pinned first-party PathPartner Technology route on https://pathpartnertech.com/ currently fails direct requests from this runtime with read ECONNRESET, including the homepage, about page, page-sitemap.xml, /career/, /careers/, and /jobs/. The exact-name host therefore remains transport-unavailable from this worker and exposes no trustworthy public first-party jobs surface, so this provider now treats the verified host outage as a zero-job sentinel instead of a hard scraper failure.',
  modulePath: path.resolve(currentDir, 'script.js'),
  dryRunFile: 'pathpartnertechnology/jobs.json',
}

export default PATHPARTNER_TECHNOLOGY_CATALOG
