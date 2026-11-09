import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const OLX_GROUP_CATALOG = {
  source: 'olxgroup',
  companyName: 'OLX Group',
  officialBrandName: 'OLX',
  adapter: 'script',
  companyCareerPage: 'https://careers.olxgroup.com/jobs/',
  officialCareersPageUrl: 'https://careers.olxgroup.com/jobs/',
  leverBoardUrl: 'https://jobs.eu.lever.co/olx',
  leverApiUrl: 'https://api.eu.lever.co/v0/postings/olx?mode=json',
  companyDomain: 'olxgroup.com',
  atsPlatform: 'lever',
  countryFilter: 'India',
  paginationStrategy: 'official-site-handoff-plus-public-lever-job-board',
  extractionStrategy:
    'verified-official-careers-page-handoff+public-lever-job-board+public-lever-api+india-location-filter',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-17',
  verifiedSurfaceSummary:
    'Verified on Friday, July 17, 2026 that the official OLX Group jobs page at https://careers.olxgroup.com/jobs/ exposes the live first-party roles surface, that it hands candidate traffic to OLX role URLs on the public Lever board at https://jobs.eu.lever.co/olx, and that the public Lever API is https://api.eu.lever.co/v0/postings/olx?mode=json. The verified live payload contained 58 postings on that date, including roles such as AI Operations Specialist, Customer Support Agent, and Treasury Manager/Senior Manager, but zero India roles, so this exact-name provider is pinned to the official surface and currently returns an honest empty India slice.',
  dryRunFile: 'olxgroup/jobs.json',
  modulePath: path.resolve(currentDir, 'script.js'),
}

export default OLX_GROUP_CATALOG
