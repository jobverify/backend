import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const AMNEX_INFOTECHNOLOGIES_CATALOG = {
  source: 'amnexinfotechnologies',
  companyName: 'Amnex InfoTechnologies',
  adapter: 'script',
  companyCareerPage: 'https://amnex.com/professional-opportunities/',
  companyDomain: 'amnex.com',
  atsPlatform: 'official-company-careers-plus-wordpress-jobs-api',
  countryFilter: 'India',
  paginationStrategy: 'first-party-jobs-rest-api-plus-taxonomy-lookup',
  extractionStrategy:
    'verified-homepage-career-handoff+verified-openings-page+wp-json-jobs+same-domain-detail-pages+inline-apply-form',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  homepageUrl: 'https://amnex.com/',
  officialCareersHandoffUrl: 'https://amnex.com/career/',
  jobsApiUrl: 'https://amnex.com/wp-json/wp/v2/jobs?per_page=100',
  jobLocationsApiUrl: 'https://amnex.com/wp-json/wp/v2/job_locations?per_page=100',
  jobYearsApiUrl: 'https://amnex.com/wp-json/wp/v2/job_years?per_page=100',
  verifiedJobDetailUrl: 'https://amnex.com/jobs/cyber-security-expert/',
  verifiedPublicJobCount: 5,
  verifiedOn: '2026-07-15',
  verifiedSurfaceSummary:
    'Verified on July 15, 2026 that https://amnex.com/ is the live first-party homepage, that it hands job seekers to https://amnex.com/career/, that https://amnex.com/professional-opportunities/ is the public openings page, that https://amnex.com/wp-json/wp/v2/jobs?per_page=100 exposes five live same-domain job records, and that https://amnex.com/jobs/cyber-security-expert/ is a live first-party detail page with an inline application form.',
  modulePath: path.join(currentDir, 'script.js'),
}

export default AMNEX_INFOTECHNOLOGIES_CATALOG
