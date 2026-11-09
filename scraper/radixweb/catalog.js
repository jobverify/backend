import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const RADIXWEB_CATALOG = {
  source: 'radixweb',
  companyName: 'Radixweb',
  officialBrandName: 'Radixweb',
  adapter: 'script',
  homepageUrl: 'https://radixweb.com/',
  companyCareerPage: 'https://radixweb.com/current-openings',
  atsPlatform: 'client-rendered-current-openings-shell-no-ssr-jobs',
  countryFilter: 'India',
  paginationStrategy: 'tez-shell-validation',
  extractionStrategy: 'verified-current-openings-shell-without-ssr-job-cards-return-empty',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  companyDomain: 'radixweb.com',
  verifiedOn: '2026-07-18',
  verifiedSurfaceSummary:
    'Verified on Saturday, July 18, 2026 that https://radixweb.com/current-openings remained the exact-name first-party Radixweb current-openings route, that browser-rendered evidence still exposed Current Openings entries such as Trainee Software Engineer and Senior AI Engineer, and that the raw first-party HTML fetched on the verified date was only the Tez client shell with the current-openings title, canonical tag, asset preloads, and #tez_app loader rather than trustworthy server-rendered job cards.',
  dryRunFile: 'radixweb/jobs.json',
  modulePath: path.join(currentDir, 'script.js'),
}

export default RADIXWEB_CATALOG
