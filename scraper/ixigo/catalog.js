import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const IXIGO_CATALOG = {
  source: 'ixigo',
  companyName: 'ixigo',
  officialBrandName: 'ixigo',
  adapter: 'script',
  modulePath: path.resolve(currentDir, 'script.js'),
  homepageUrl: 'https://www.ixigo.com/',
  companyCareerPage: 'https://careers.ixigo.com/',
  legacyCareersUrl: 'https://www.ixigo.com/about/careers/',
  currentCareersUrl: 'https://careers.ixigo.com/',
  atsPlatform: 'smartrecruiters',
  countryFilter: 'India',
  paginationStrategy: 'first-party-openings-api-with-numFound-completeness-check',
  extractionStrategy:
    'verified-first-party-careers+openings-api+company-and-country-validation+native-detail-identity+full-description',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  companyDomain: 'ixigo.com',
  verifiedOn: '2026-09-13',
  verifiedSurfaceSummary:
    'Verified on September 13, 2026 that https://careers.ixigo.com/ renders an initial No Jobs Found placeholder before fetching https://careers.ixigo.com/api/openings. The public API returned eight ixigo India vacancies with numFound=8. Its official client links jobVacancyId values to SmartRecruiters, and https://jobs.smartrecruiters.com/ixigo/13351237674 returned the matching Full-Stack Intern role. The legacy https://www.ixigo.com/about/careers/ redirect is no longer a scrape prerequisite.',
  dryRunFile: 'ixigo/jobs.json',
}

export default IXIGO_CATALOG
