import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const VERIFIED_SURFACE_SUMMARY =
  'Verified on August 4, 2026 that https://fareye.com/ is the live first-party FarEye homepage and links to the official careers page at https://fareye.com/about/careers. Verified that https://fareye.com/about/careers is the live first-party careers page titled "Careers | FarEye" and that it still hands candidates to https://fareye.darwinbox.in/ms/candidate/careers. Verified that https://fareye.darwinbox.in/jobs redirects through /user/login to https://darwinbox.com/, that https://fareye.darwinbox.in/ms/candidate/careers plus https://fareye.darwinbox.in/ms/candidatev2/main/careers/home and https://fareye.darwinbox.in/ms/candidatev2/main/careers/allJobs each return only minimal blank Darwinbox shells with no public job signals, and that both https://fareye.darwinbox.in/ms/candidateapi/job/alljobs?companyId=main and https://fareye.darwinbox.in/ms/candidateapi/getCompanyConfig still return 500 tenant-info errors. There is no trustworthy public jobs surface for FarEye on the verified date.'

export const FAREYE_CATALOG = {
  source: 'fareye',
  companyName: 'FarEye',
  officialBrandName: 'FarEye',
  adapter: 'script',
  modulePath: path.resolve(currentDir, 'script.js'),
  dryRunFile: 'fareye/jobs.json',
  homepageUrl: 'https://fareye.com/',
  companyCareerPage: 'https://fareye.com/about/careers',
  officialCareersHandoffUrl: 'https://fareye.darwinbox.in/ms/candidate/careers',
  darwinboxJobsUrl: 'https://fareye.darwinbox.in/jobs',
  darwinboxShellRouteUrls: [
    'https://fareye.darwinbox.in/ms/candidate/careers',
    'https://fareye.darwinbox.in/ms/candidatev2/main/careers/home',
    'https://fareye.darwinbox.in/ms/candidatev2/main/careers/allJobs',
  ],
  darwinboxListingApiUrl: 'https://fareye.darwinbox.in/ms/candidateapi/job/alljobs?companyId=main',
  darwinboxCompanyConfigUrl: 'https://fareye.darwinbox.in/ms/candidateapi/getCompanyConfig',
  companyDomain: 'fareye.com',
  atsPlatform: 'official-company-site-no-public-careers',
  countryFilter: 'India',
  paginationStrategy:
    'official-careers-page-plus-darwinbox-login-redirect-blank-shells-and-broken-api-validation',
  extractionStrategy:
    'verified-homepage+verified-careers-page+verified-darwinbox-handoff+verified-login-redirect+verified-blank-shells+verified-broken-tenant-api+return-empty',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-08-04',
  verifiedSurfaceSummary: VERIFIED_SURFACE_SUMMARY,
}

export default FAREYE_CATALOG
