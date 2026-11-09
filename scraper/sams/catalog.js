import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SAMS_CATALOG = {
  source: 'sams',
  companyName: 'SAMS',
  officialBrandName: 'SAMS',
  adapter: 'script',
  officialHomepageUrl: 'https://www.sams.co.in/',
  companyCareerPage: 'https://www.sams.co.in/Jobs/job-list',
  jobsListScriptUrl: 'https://www.sams.co.in/Scripts/filter.js',
  jobsFragmentUrl: 'https://www.sams.co.in/Jobs/JobsList',
  detailUrlPrefix: 'https://www.sams.co.in/jobs/job-description/',
  companyDomain: 'sams.co.in',
  atsPlatform: 'first-party-jobs-html-fragment',
  countryFilter: 'India',
  paginationStrategy: 'verified-job-list-shell-plus-first-public-jobslist-fragment',
  extractionStrategy:
    'verified-job-list-shell+verified-filter-script+jobslist-html-fragment+same-domain-detail-pages+external-samsstc-apply-handoff+india-location-filter',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-17',
  verifiedSurfaceSummary:
    'Verified on Friday, July 17, 2026 that https://www.sams.co.in/Jobs/job-list is the live exact-name first-party SAMS jobs shell, that it loads the first-party script asset https://www.sams.co.in/Scripts/filter.js which posts to the same-origin endpoint https://www.sams.co.in/Jobs/JobsList, and that the first public jobs fragment response returned 34 current job cards including Program Manager and State Project Manager. Same-domain detail pages under https://www.sams.co.in/jobs/job-description/ expose the role detail and hand off applications to samsstc.com.',
  dryRunFile: 'sams/jobs.json',
  modulePath: path.resolve(currentDir, 'script.js'),
}

export default SAMS_CATALOG
