import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const VERIFIED_SURFACE_SUMMARY =
  'Verified on Monday, August 3, 2026 that https://www.magnasoft.com/careers/ remains the live first-party Magnasoft careers shell and now embeds the public Zoho Recruit board at https://magnasoft.zohorecruit.in/jobs/Careers. The direct public board currently exposes 4 published roles overall, including 2 India roles: AIML Engineer in Bangalore South and Principle AI Engineer in Bengaluru. This provider therefore uses the direct Zoho board payload and filters to India-facing openings for Magnasoft Consulting India.'

export const MAGNASOFT_CONSULTING_INDIA_CATALOG = {
  source: 'magnasoftconsultingindia',
  companyName: 'Magnasoft Consulting India',
  officialBrandName: 'Magnasoft',
  adapter: 'script',
  homepageUrl: 'https://www.magnasoft.com/',
  companyCareerPage: 'https://www.magnasoft.com/careers/',
  jobsBoardUrl: 'https://magnasoft.zohorecruit.in/jobs/Careers',
  verifiedSampleJobUrl:
    'https://magnasoft.zohorecruit.in/jobs/Careers/148491000003493001/AIML-Engineer?source=CareerSite',
  companyDomain: 'magnasoft.com',
  atsPlatform: 'zoho-recruit',
  countryFilter: 'India',
  paginationStrategy: 'first-party-careers-shell-plus-single-zoho-board-hidden-jobs-json',
  extractionStrategy: 'verified-first-party-careers-shell+verified-zoho-board+hidden-jobs-json+india-country-filter',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-08-03',
  verifiedPublicPostingCount: 2,
  verifiedSurfaceSummary: VERIFIED_SURFACE_SUMMARY,
  dryRunFile: 'magnasoftconsultingindia/jobs.json',
  modulePath: path.resolve(currentDir, 'script.js'),
}

export default MAGNASOFT_CONSULTING_INDIA_CATALOG
