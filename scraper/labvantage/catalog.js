import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const VERIFIED_SURFACE_SUMMARY =
  'Verified on Friday, July 17, 2026 that https://www.labvantage.com/who-we-are/careers/ was the live first-party LabVantage Solutions careers page, that the India section directed applicants to teamhr@labvantage.com, and that the verified India openings list publicly included Product Marketing Manager / Lead – Product Marketing, Senior Software Engineer – Development, Technical Project Manager, Product Manager, Finance Controller, Finance & Planning Analyst, Software Engineer – DevOps, and DocuSign Technical Analyst.'

export const LABVANTAGE_SOLUTIONS_CATALOG = {
  source: 'labvantage',
  companyName: 'Labvantage Solutions',
  officialBrandName: 'LabVantage Solutions',
  adapter: 'script',
  homepageUrl: 'https://www.labvantage.com/',
  companyCareerPage: 'https://www.labvantage.com/who-we-are/careers/',
  applicationEmail: 'teamhr@labvantage.com',
  applicationUrl: 'mailto:teamhr@labvantage.com',
  companyDomain: 'labvantage.com',
  atsPlatform: 'official-company-careers',
  countryFilter: 'India',
  paginationStrategy: 'single-first-party-regional-section-page',
  extractionStrategy: 'verified-first-party-careers-page+india-section-job-list+shared-email-apply',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-17',
  verifiedSurfaceSummary: VERIFIED_SURFACE_SUMMARY,
  dryRunFile: 'labvantage/jobs.json',
  modulePath: path.resolve(currentDir, 'script.js'),
}

export default LABVANTAGE_SOLUTIONS_CATALOG
