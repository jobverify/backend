import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const VERIFIED_SURFACE_SUMMARY =
  'Verified on July 19, 2026 that https://www.goindigo.in/careers.html is the live first-party IndiGo careers landing page and that https://www.goindigo.in/careers/job-search.html publishes a public job-search microfrontend configured with https://ms-careers-prod.goindigo.in/career-job-list plus a page-provided user_key. The verified API returned 17 public postings and SuccessFactors apply links are built from the page-declared career-in10.hr.cloud.sap URL prefix.'

export const INDIGO_CATALOG = {
  source: 'indigo',
  companyName: 'Indigo',
  officialBrandName: 'IndiGo',
  adapter: 'script',
  homepageUrl: 'https://www.goindigo.in/',
  companyCareerPage: 'https://www.goindigo.in/careers.html',
  careersDepartmentsUrl: 'https://www.goindigo.in/careers/departments.html',
  careersJobSearchUrl: 'https://www.goindigo.in/careers/job-search.html',
  sampleDepartmentUrl: 'https://www.goindigo.in/careers/departments/airportoperationscustomerservices.html',
  successFactorsHost: 'career44.sapsf.com',
  successFactorsCompanyToken: 'interglobe',
  jobSearchApiUrl: 'https://ms-careers-prod.goindigo.in/career-job-list',
  careerMsUserKey: '03ba3c0795ce04ed48e7fe3854155a1f',
  successFactorsApplyUrlPrefix:
    'https://career-in10.hr.cloud.sap/careers?company=interglobe&correlation_Id=38774994&lang=en_GB&clientId=jobs2web&socialApply=false&career_ns=job_application&site=&career_job_req_id=',
  companyDomain: 'goindigo.in',
  atsPlatform: 'official-company-careers-successfactors-api',
  countryFilter: 'India',
  paginationStrategy: 'first-party-job-search-shell-plus-successfactors-api',
  extractionStrategy: 'verified-first-party-careers-page+job-search-env+successfactors-api+india-filter',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-19',
  verifiedSurfaceSummary: VERIFIED_SURFACE_SUMMARY,
  dryRunFile: 'indigo/jobs.json',
  modulePath: path.resolve(currentDir, 'script.js'),
}

export default INDIGO_CATALOG
