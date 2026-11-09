import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const VERIFIED_SURFACE_SUMMARY =
  "Verified on July 15, 2026 that https://www.elastic.run/careers is the live first-party ElasticRun careers shell, that https://www.elastic.run/sitemap.xml publishes https://elastic.run/careers, that the careers client bundle exposes the View Open Roles handoff to https://elasticruncareers.peoplestrong.com/job/joblist, and that the linked public PeopleStrong route currently returns a 404 Candidate Portal shell while the jobs API at https://elasticruncareers.peoplestrong.com/api/cp/rest/altone/cp/jobs/v1?offset=0&limit=20 is live and returned totalRecords: 0 with no public records during verification."

export const ELASTIC_RUN_CATALOG = {
  source: 'elasticrun',
  companyName: 'ElasticRun',
  officialBrandName: 'ElasticRun',
  adapter: 'script',
  homepageUrl: 'https://www.elastic.run/',
  companyCareerPage: 'https://www.elastic.run/careers',
  careersPageUrl: 'https://www.elastic.run/careers',
  sitemapUrl: 'https://www.elastic.run/sitemap.xml',
  portalOrigin: 'https://elasticruncareers.peoplestrong.com',
  jobListingsUrl: 'https://elasticruncareers.peoplestrong.com/job/joblist',
  jobsApiUrl: 'https://elasticruncareers.peoplestrong.com/api/cp/rest/altone/cp/jobs/v1?offset=0&limit=20',
  companyDomain: 'elastic.run',
  atsPlatform: 'peoplestrong',
  countryFilter: 'India',
  paginationStrategy: 'first-party-careers-shell-plus-peoplestrong-offset-limit-api',
  extractionStrategy:
    'first-party-careers-shell+client-bundle-handoff-to-broken-peoplestrong-joblist+peoplestrong-jobs-api-empty',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-15',
  verifiedSurfaceSummary: VERIFIED_SURFACE_SUMMARY,
  dryRunFile: 'elasticrun/jobs.json',
  modulePath: path.resolve(currentDir, 'script.js'),
}

export default ELASTIC_RUN_CATALOG
