import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const REPLICON_CATALOG = {
  source: 'replicon',
  companyName: 'Replicon',
  officialBrandName: 'Replicon',
  adapter: 'script',
  modulePath: path.resolve(currentDir, 'script.js'),
  dryRunFile: 'replicon/jobs.json',
  companyCareerPage: 'https://www.replicon.com/company/careers/',
  redirectCareersUrl: 'https://www.deltek.com/company/careers/',
  genericSearchJobsUrl: 'https://careers.deltek.com/',
  searchApiUrl: 'https://jobsapi-google.m-cloud.io/api/job/search',
  searchApiCompanyName: 'companies/d78c5717-c840-461e-8f42-7e005f1a8068',
  upstreamCompanyName: 'Deltek',
  companyDomain: 'replicon.com',
  atsPlatform: 'deltek-careers-google-jobs-api',
  countryFilter: 'India',
  paginationStrategy: 'verified-replicon-redirect-plus-deltek-page-token-search-api',
  extractionStrategy:
    'verified-replicon-careers-redirect+verified-deltek-search-page+discovered-companyname+jobsapi-google-search',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-08-04',
  verifiedSurfaceSummary:
    'Verified on Tuesday, August 4, 2026 that https://www.replicon.com/company/careers/ resolves to https://www.deltek.com/company/careers/, that the Deltek careers page title is "Drive Your Career with #TeamDeltek | Search Jobs | Deltek", that the hiring CTAs point to https://careers.deltek.com/, and that the linked Deltek search page exposes public India hiring via company search identifier companies/d78c5717-c840-461e-8f42-7e005f1a8068 on the jobsapi-google.m-cloud.io job search feed.',
}

export default REPLICON_CATALOG
