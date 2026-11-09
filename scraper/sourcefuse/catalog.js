import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const VERIFIED_SURFACE_SUMMARY = 'Verified on Friday, July 17, 2026 that the official SourceFuse careers landing page at https://www.sourcefuse.com/careers/ routes to the live India openings page at https://www.sourcefuse.com/careers/?location=India, that the page renders public first-party inline job panels including Senior Integration Engineer and Senior Business Analyst, and that applications are submitted through the first-party inline form action /careers/?location=India#wpcf7-f91356-o1 on sourcefuse.com. No separate public jobs API was required because the verified first-party India openings page renders the current openings and application form directly.'

export const SOURCEFUSE_CATALOG = {
  source: 'sourcefuse',
  companyName: 'SourceFuse',
  officialBrandName: 'SourceFuse',
  adapter: 'script',
  companyCareerPage: 'https://www.sourcefuse.com/careers/?location=India',
  officialCareersPageUrl: 'https://www.sourcefuse.com/careers/',
  indiaOpeningsUrl: 'https://www.sourcefuse.com/careers/?location=India',
  verifiedApplicationFormAction: '/careers/?location=India#wpcf7-f91356-o1',
  companyDomain: 'sourcefuse.com',
  atsPlatform: 'official-company-site-public-job-pages',
  countryFilter: 'India',
  paginationStrategy: 'single-verified-india-openings-page',
  extractionStrategy: 'verified-india-openings-page+inline-job-panels+onsite-application-form',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-17',
  verifiedSurfaceSummary: VERIFIED_SURFACE_SUMMARY,
  dryRunFile: 'sourcefuse/jobs.json',
  modulePath: path.resolve(currentDir, 'script.js'),
}

export default SOURCEFUSE_CATALOG
