import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const VERIFIED_SURFACE_SUMMARY =
  'Verified on Sunday, July 19, 2026 that https://www.unominda.com/career is the live official careers page for Uno Minda Limited, whose investor and contact surfaces identify it as formerly known as Minda Industries Limited. The verified careers page publishes corphr@unominda.com and hands job seekers to https://inspire-unominda.darwinbox.in/ms/candidatev2/main/careers/home. A direct GET to https://inspire-unominda.darwinbox.in/ms/candidateapi/job/alljobs?companyId=main returned HTTP 422 with {"message":"no job found with that id","status":"failure"}, but the same endpoint succeeds with the Darwinbox listing POST body {"companyId":"main","sort_option":"new","limit":20,"page":1}; that POST returned status success, job_counts 58, and live India roles including Assistant Manager in Manesar. This scraper therefore keeps the official Uno Minda careers page as the ownership sentinel and uses the Darwinbox POST listing API with companyId=main.'

export const MINDA_INDUSTRIES_CATALOG = {
  source: 'mindaindustries',
  companyName: 'Minda Industries',
  officialBrandName: 'Uno Minda Limited (formerly Minda Industries Limited)',
  adapter: 'script',
  modulePath: path.resolve(currentDir, 'script.js'),
  dryRunFile: 'mindaindustries/jobs.json',
  companyCareerPage: 'https://www.unominda.com/career',
  officialCareersHandoffUrl: 'https://inspire-unominda.darwinbox.in/ms/candidatev2/main/careers/home',
  publicAllJobsUrl: 'https://inspire-unominda.darwinbox.in/ms/candidatev2/main/careers/allJobs',
  listingApiUrl: 'https://inspire-unominda.darwinbox.in/ms/candidateapi/job/alljobs?companyId=main',
  darwinboxOrigin: 'https://inspire-unominda.darwinbox.in',
  darwinboxCompanyId: 'main',
  companyDomain: 'unominda.com',
  verifiedApplicationContact: 'corphr@unominda.com',
  atsPlatform: 'darwinbox',
  countryFilter: 'India',
  paginationStrategy: 'verified-careers-page-plus-darwinbox-post-listing-api',
  extractionStrategy: 'verified-rename-era-careers-page+darwinbox-post-listing-api',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-19',
  verifiedSurfaceSummary: VERIFIED_SURFACE_SUMMARY,
}

export default MINDA_INDUSTRIES_CATALOG
