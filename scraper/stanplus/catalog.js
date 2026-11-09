import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const STAN_PLUS_CATALOG = {
  source: 'stanplus',
  companyName: 'StanPlus',
  adapter: 'script',
  companyCareerPage: 'https://www.red.health/career',
  officialHomepageUrl: 'https://www.red.health/',
  contactUsUrl: 'https://www.red.health/contact-us',
  termsUrl: 'https://www.red.health/terms-conditions',
  officialBrandName: 'RED.Health',
  legalEntityName: 'Stanplus Technologies Private Limited',
  officialCareersHandoffUrl: 'https://redhealth.darwinbox.in/ms/candidatev2/main',
  darwinboxJobsUrl: 'https://redhealth.darwinbox.in/jobs',
  darwinboxCandidateCareersUrl: 'https://redhealth.darwinbox.in/ms/candidate/careers',
  darwinboxPublicHomeUrl: 'https://redhealth.darwinbox.in/ms/candidatev2/main/careers/home',
  darwinboxPublicAllJobsUrl: 'https://redhealth.darwinbox.in/ms/candidatev2/main/careers/allJobs',
  darwinboxListingApiUrl: 'https://redhealth.darwinbox.in/ms/candidateapi/job/alljobs?companyId=main',
  atsPlatform: 'official-company-site-no-public-careers',
  countryFilter: 'India',
  paginationStrategy: 'verified-careers-page-plus-darwinbox-shell-and-blocked-api-validation',
  extractionStrategy:
    'verified-first-party-careers-page+verified-darwinbox-handoff+reachable-public-shells+blocked-listing-api-return-empty',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  companyDomain: 'red.health',
  verifiedOn: '2026-08-05',
  verifiedSurfaceSummary:
    'Verified on Wednesday, August 5, 2026 that https://www.red.health/career was still the live first-party RED.Health careers page for StanPlus and still linked candidates via Discover Roles to the Darwinbox handoff at https://redhealth.darwinbox.in/ms/candidatev2/main, while first-party legal copy on https://www.red.health/contact-us still identified Stanplus Technologies Private Limited. Direct probes to https://redhealth.darwinbox.in/jobs, https://redhealth.darwinbox.in/ms/candidate/careers, https://redhealth.darwinbox.in/ms/candidatev2/main/careers/home, and https://redhealth.darwinbox.in/ms/candidatev2/main/careers/allJobs now returned generic public Darwinbox JavaScript shells with no trustworthy job content, while https://redhealth.darwinbox.in/ms/candidateapi/job/alljobs?companyId=main returned a Cloudflare 403 block. In this environment there was still no trustworthy public StanPlus jobs surface.',
  darwinboxTimeoutRouteUrls: [
    'https://redhealth.darwinbox.in/jobs',
    'https://redhealth.darwinbox.in/ms/candidate/careers',
    'https://redhealth.darwinbox.in/ms/candidatev2/main/careers/home',
    'https://redhealth.darwinbox.in/ms/candidatev2/main/careers/allJobs',
    'https://redhealth.darwinbox.in/ms/candidateapi/job/alljobs?companyId=main',
  ],
  modulePath: path.join(currentDir, 'script.js'),
  dryRunFile: path.join(currentDir, 'jobs.json'),
}

export default STAN_PLUS_CATALOG
