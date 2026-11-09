import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const MAXGEN_TECHNOLOGIES_CATALOG = {
  source: 'maxgentechnologies',
  companyName: 'Maxgen Technologies',
  officialBrandName: 'Maxgen Technologies Pvt Ltd',
  adapter: 'script',
  homepageUrl: 'https://www.maxgentechnologies.com/',
  companyCareerPage: 'https://www.maxgentechnologies.com/career',
  sampleDetailUrl:
    'https://www.maxgentechnologies.com/career/python-developer-with-0-1-year-of-experience',
  companyDomain: 'maxgentechnologies.com',
  atsPlatform: 'official-careers-no-jobs-shell-with-unlinked-detail-pages',
  countryFilter: 'India',
  paginationStrategy: 'single-first-party-careers-page-validation',
  extractionStrategy:
    'verified-no-jobs-shell+unlinked-detail-pages-not-trusted+fail-closed-sentinel',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-18',
  verifiedSurfaceSummary:
    'Verified on Saturday, July 18, 2026 that https://www.maxgentechnologies.com/career is the exact-name first-party Maxgen careers page and that it currently renders the explicit empty-state message "No jobs available.". Also verified that isolated same-domain detail routes such as the publicly reachable "Python Developer with 0-1 year of experience" page at https://www.maxgentechnologies.com/career/python-developer-with-0-1-year-of-experience remain available, but they are not linked from the verified careers index and therefore are not treated as a trustworthy enumerable jobs surface. This provider stays fail-closed until Maxgen restores a stable first-party listings page.',
  modulePath: path.resolve(currentDir, 'script.js'),
  dryRunFile: 'maxgentechnologies/jobs.json',
}

export default MAXGEN_TECHNOLOGIES_CATALOG
