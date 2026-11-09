import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PRATIAN_TECHNOLOGIES_CATALOG = {
  source: 'pratiantechnologies',
  companyName: 'Pratian Technologies',
  officialBrandName: 'Pratian',
  adapter: 'script',
  homepageUrl: 'https://www.pratian.com/',
  companyCareerPage: 'https://www.pratian.com/career',
  companyDomain: 'pratian.com',
  atsPlatform: 'first-party-careers-shell-no-public-jobs',
  countryFilter: 'India',
  paginationStrategy: 'angular-shell-plus-bundle-check',
  extractionStrategy: 'verified-first-party-angular-shell+verified-career-bundle-without-public-job-listings+fail-closed-sentinel',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-08-04',
  verifiedSurfaceSummary:
    'Verified on Tuesday, August 4, 2026 that direct TLS-validated fetches to https://www.pratian.com/career currently fail with CERT_HAS_EXPIRED for this worker, and that a controlled inspection of the same first-party Angular careers shell still pointed to bundle main.d7ac0e33a2b8f83f.js containing the verified "At Pratian, it is all about you." messaging together with nurture, challenge, celebrate, and trust copy. No trustworthy public jobs surface, public role rows, or stable anonymous job detail links were exposed on the verified date, so this provider remains fail-closed.',
  dryRunFile: 'pratiantechnologies/jobs.json',
  modulePath: path.resolve(currentDir, 'script.js'),
}

export default PRATIAN_TECHNOLOGIES_CATALOG
