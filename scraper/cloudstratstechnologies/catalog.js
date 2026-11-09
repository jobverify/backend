import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const CLOUDSTRATS_TECHNOLOGIES_CATALOG = {
  source: 'cloudstratstechnologies',
  companyName: 'Cloudstrats Technologies',
  officialBrandName: 'Cloudstrats',
  adapter: 'script',
  homepageUrl: 'https://cloudstrats.ai/',
  companyCareerPage: 'https://cloudstrats.ai/careers/',
  atsPlatform: 'official-company-careers',
  countryFilter: 'India',
  paginationStrategy: 'single-first-party-careers-page',
  extractionStrategy: 'verified-first-party-careers-page+job-detail-pages+first-party-apply-forms',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  companyDomain: 'cloudstrats.ai',
  verifiedOn: '2026-07-17',
  verifiedSurfaceSummary:
    'Verified on Friday, July 17, 2026 that https://cloudstrats.ai/careers/ was the live first-party Cloudstrats careers page and that it publicly listed current opportunities including Cloud Engineer, Management Traniee, Executive Assistant, Tender Coordinator, and HR Intern with same-domain detail pages and first-party apply forms such as https://cloudstrats.ai/apply/1/.',
  modulePath: path.resolve(currentDir, 'script.js'),
  dryRunFile: 'cloudstratstechnologies/jobs.json',
}

export default CLOUDSTRATS_TECHNOLOGIES_CATALOG
