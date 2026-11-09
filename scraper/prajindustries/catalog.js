import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PRAJ_INDUSTRIES_CATALOG = {
  source: 'prajindustries',
  companyName: 'Praj Industries',
  officialBrandName: 'Praj Industries',
  adapter: 'script',
  homepageUrl: 'https://www.praj.net/',
  companyCareerPage: 'https://www.praj.net/careers/',
  companyDomain: 'praj.net',
  atsPlatform: 'official-company-site-no-public-careers',
  countryFilter: 'India',
  paginationStrategy: 'verified-careers-page-plus-darwinbox-shell-and-blocked-api-validation',
  extractionStrategy:
    'verified-first-party-careers-page+verified-darwinbox-handoff+reachable-public-shells+blocked-listing-api-return-empty',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  officialCareersHandoffUrl: 'https://praj.darwinbox.in/ms/candidate/careers',
  darwinboxOrigin: 'https://praj.darwinbox.in',
  darwinboxCompanyId: 'main',
  darwinboxJobsUrl: 'https://praj.darwinbox.in/jobs',
  darwinboxCandidateCareersUrl: 'https://praj.darwinbox.in/ms/candidate/careers',
  darwinboxPublicHomeUrl: 'https://praj.darwinbox.in/ms/candidatev2/main/careers/home',
  darwinboxPublicAllJobsUrl: 'https://praj.darwinbox.in/ms/candidatev2/main/careers/allJobs',
  darwinboxListingApiUrl: 'https://praj.darwinbox.in/ms/candidateapi/job/alljobs?companyId=main',
  darwinboxShellRouteUrls: [
    'https://praj.darwinbox.in/jobs',
    'https://praj.darwinbox.in/ms/candidate/careers',
    'https://praj.darwinbox.in/ms/candidatev2/main/careers/home',
    'https://praj.darwinbox.in/ms/candidatev2/main/careers/allJobs',
  ],
  verifiedOn: '2026-08-14',
  verifiedSurfaceSummary:
    'Verified on Friday, August 14, 2026 that https://www.praj.net/careers/ remained the live official Praj Industries careers page and still exposed the SEARCH FOR JOB handoff to https://praj.darwinbox.in/ms/candidate/careers. Direct probes showed that https://praj.darwinbox.in/jobs now resolves to the blank public Darwinbox shell at https://praj.darwinbox.in/ms/candidatev2/main/careers/home, that https://praj.darwinbox.in/ms/candidate/careers returns only a minimal Please enable Javascript candidate shell, that the public home and all-jobs routes return generic candidatev2 shells with no trustworthy job content, and that the listing API at https://praj.darwinbox.in/ms/candidateapi/job/alljobs?companyId=main returns a Cloudflare 403 block in this API-only runtime. There is no trustworthy public Praj jobs surface in this environment on the verified date.',
  modulePath: path.resolve(currentDir, 'script.js'),
  dryRunFile: path.join(currentDir, 'jobs.json'),
}

export default PRAJ_INDUSTRIES_CATALOG
