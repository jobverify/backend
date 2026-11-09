import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const UNILOG_CONTENT_SOLUTIONS_CATALOG = {
  source: 'unilogcontentsolutions',
  companyName: 'Unilog Content Solutions ( P)',
  officialBrandName: 'Unilog',
  adapter: 'script',
  homepageUrl: 'https://www.unilogcorp.com/',
  companyCareerPage: 'https://www.unilogcorp.com/careers/',
  officialCareersPageUrl: 'https://www.unilogcorp.com/careers/',
  companyDomain: 'unilogcorp.com',
  atsPlatform: 'official-company-site-cloudflare-challenge-no-public-jobs-catalog',
  countryFilter: 'India',
  paginationStrategy: 'verified-cloudflare-challenged-homepage-and-careers-routes',
  extractionStrategy: 'verified-cloudflare-challenged-homepage+verified-cloudflare-challenged-careers-route-return-empty',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-08-06',
  verifiedSurfaceSummary:
    'Verified on Thursday, August 6, 2026 that https://www.unilogcorp.com/, https://www.unilogcorp.com/careers/, and the first-party contact route each returned the same Cloudflare challenge shell with HTTP 403 and the title "Just a moment..." instead of a fetchable Unilog jobs catalog. The previously verified open-roles HTML surface from Thursday, July 17, 2026 is no longer reachable from this environment, and the blocked responses expose no trustworthy public job cards, detail pages, ATS handoff, or structured jobs payload to enumerate.',
  dryRunFile: 'unilogcontentsolutions/jobs.json',
  modulePath: path.resolve(currentDir, 'script.js'),
}

export default UNILOG_CONTENT_SOLUTIONS_CATALOG
