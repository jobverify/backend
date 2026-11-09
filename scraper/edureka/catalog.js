import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const VERIFIED_SURFACE_SUMMARY =
  'Verified on July 15, 2026 that https://www.edureka.co/ is the live first-party homepage and links job seekers to https://www.edureka.co/careers. Verified that https://www.edureka.co/careers is the live first-party careers page, that it exposes career@edureka.co plus 5 visible openings linking directly to first-party detail pages including https://www.edureka.co/openpositions/2/47, and that the linked handoff route https://www.edureka.co/careers/job_details currently returns a first-party Internal Server Error shell instead of a reliable listings surface. The trusted public jobs surface is therefore the inline first-party openings list on /careers plus the first-party /openpositions/* detail pages.'

export const EDUREKA_CATALOG = {
  source: 'edureka',
  companyName: 'Edureka',
  officialBrandName: 'Edureka',
  adapter: 'script',
  modulePath: path.resolve(currentDir, 'script.js'),
  dryRunFile: 'edureka/jobs.json',
  rootUrl: 'https://www.edureka.co/',
  companyCareerPage: 'https://www.edureka.co/careers',
  brokenOpeningsRouteUrl: 'https://www.edureka.co/careers/job_details',
  sampleJobUrl: 'https://www.edureka.co/openpositions/2/47',
  applicationEmail: 'career@edureka.co',
  companyDomain: 'edureka.co',
  atsPlatform: 'official-company-careers',
  countryFilter: 'India',
  paginationStrategy: 'single-first-party-careers-page-inline-opening-links',
  extractionStrategy:
    'verified-homepage+verified-careers-page+inline-opening-links+first-party-detail-pages+same-page-application-form',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-15',
  verifiedSurfaceSummary: VERIFIED_SURFACE_SUMMARY,
}

export default EDUREKA_CATALOG
