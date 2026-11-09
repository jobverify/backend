import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const VERIFIED_SURFACE_SUMMARY =
  'Verified on Thursday, August 13, 2026 that https://www.mastek.com/careers/ returned a Cloudflare 403 "Just a moment..." interstitial, while the first-party jobs board at https://careers.mastek.com/search/ remained publicly reachable and showed "Showing 1 to 12 of 56 Jobs". The board exposed 28 India-coded postings in the live dry run, including Oracle FCCS Functional Consultant and SCM Fusion Supply Planning Consultant, and a live India detail page was verified at https://careers.mastek.com/job/Oracle-FCCS-Functional-Consultant/57886344/.'

export const MASTEK_CATALOG = {
  source: 'mastek',
  companyName: 'Mastek',
  officialBrandName: 'Mastek Limited',
  adapter: 'script',
  modulePath: path.resolve(currentDir, 'script.js'),
  dryRunFile: 'mastek/jobs.json',
  officialBrandSiteUrl: 'https://www.mastek.com/',
  companyCareerPage: 'https://www.mastek.com/careers/',
  officialCareersHandoffUrl: 'https://careers.mastek.com/search/',
  verifiedSampleJobUrl:
    'https://careers.mastek.com/job/Oracle-FCCS-Functional-Consultant/57886344/',
  companyDomain: 'careers.mastek.com',
  atsPlatform: 'successfactors',
  countryFilter: 'India',
  verifiedPublicJobCount: 56,
  paginationStrategy: 'first-party-search-startrow-query',
  extractionStrategy:
    'official-careers-page+first-party-search-page+job-tiles+detail-pages+talentcommunity-apply-handoff+india-location-filter',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-08-13',
  verifiedSurfaceSummary: VERIFIED_SURFACE_SUMMARY,
}

export default MASTEK_CATALOG
