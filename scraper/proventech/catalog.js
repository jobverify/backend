import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PROVENTECH_CATALOG = {
  source: 'proventech',
  companyName: 'Proventech',
  officialBrandName: 'ProvenTech',
  adapter: 'script',
  homepageUrl: 'https://hr.proventech.in/',
  companyCareerPage: 'https://hr.proventech.in/',
  applyUrl: 'https://hr.proventech.in/',
  atsPlatform: 'official-company-site-no-public-careers',
  countryFilter: 'India',
  paginationStrategy: 'verified-login-shell-plus-missing-routes',
  extractionStrategy: 'verified-login-shell+verified-missing-careers-routes-return-empty',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  companyDomain: 'proventech.in',
  verifiedOn: '2026-08-04',
  verifiedSurfaceSummary:
    'Verified on Tuesday, August 4, 2026 that https://hr.proventech.in/ was the live first-party ProvenTech HRMS login shell, that it did not expose trustworthy public openings, and that https://hr.proventech.in/careers and https://hr.proventech.in/jobs each returned first-party page-not-found responses. The legacy https://new.proventech.in/ host now fails TLS because its certificate only covers hr.proventech.in, so this provider remains fail-closed until a trustworthy public first-party jobs surface is restored.',
  modulePath: path.resolve(currentDir, 'script.js'),
}

export default PROVENTECH_CATALOG
