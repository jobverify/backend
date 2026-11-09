import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const METACUBE_SOFTWARE_CATALOG = {
  source: 'metacubesoftware',
  companyName: 'Metacube Software',
  officialBrandName: 'Metacube',
  adapter: 'script',
  homepageUrl: 'https://www.metacube.com/',
  careersHubUrl: 'https://metacube.com/careers.php',
  companyCareerPage: 'https://metacube.com/careers-professionals.php',
  jobsApiUrl: 'https://metacube.com/include/students.php?type=load&id=2',
  atsPlatform: 'first-party-csrf-protected-professionals-feed',
  countryFilter: 'India',
  paginationStrategy: 'session-cookie-plus-csrf-protected-first-party-professionals-feed',
  extractionStrategy:
    'verified-careers-hub+verified-professionals-page+csrf-protected-first-party-professionals-feed',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  companyDomain: 'metacube.com',
  verifiedOn: '2026-08-03',
  verifiedPublicJobCount: 6,
  verifiedSampleJobUrl: 'https://metacube.com/open-position-form.php',
  verifiedSurfaceSummary:
    'Verified on Monday, August 3, 2026 that the public Metacube careers hub at https://metacube.com/careers.php now routes experienced-professional openings to https://metacube.com/careers-professionals.php, that the professionals page loads its public role data from the first-party CSRF-protected feed at https://metacube.com/include/students.php?type=load&id=2, and that the live feed returned 6 India openings including Salesforce Tech Lead with a public apply target at https://metacube.com/open-position-form.php on the verified date.',
  modulePath: path.resolve(currentDir, 'script.js'),
}

export default METACUBE_SOFTWARE_CATALOG
