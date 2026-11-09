import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const IG_INFOTECH_INDIA_CATALOG = {
  source: 'iginfotechindia',
  companyName: 'IG Infotech India',
  officialBrandName: 'IG Infotech India',
  adapter: 'script',
  homepageUrl: 'https://www.iggroup.com/',
  companyCareerPage: 'https://www.iggroup.com/about-us/careers',
  companyContactPageUrl: 'https://www.iggroup.com/contact-page',
  workdayListingUrl: 'https://ig.wd103.myworkdayjobs.com/EXT_IG',
  workdayTenantHost: 'https://ig.wd103.myworkdayjobs.com/',
  parentCompanyName: 'IG Group',
  atsPlatform: 'workday',
  countryFilter: 'India',
  paginationStrategy: 'verified-ig-careers-handoff-plus-bengaluru-entity-page-and-shared-workday-runner',
  extractionStrategy:
    'verified-ig-careers-page+verified-bengaluru-entity-page+verified-workday-shell+shared-workday-runner',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  companyDomain: 'iggroup.com',
  verifiedOn: '2026-08-01',
  verifiedSurfaceSummary:
    'Revalidated on Saturday, August 1, 2026 that https://www.iggroup.com/about-us/careers remained the live first-party IG Group careers page and still linked Find a role you love to https://ig.wd103.myworkdayjobs.com/EXT_IG, that https://www.iggroup.com/contact-page still identified the Bengaluru office as IG Infotech India Private Limited, and that the linked public Workday shell canonicalized to https://ig.wd103.myworkdayjobs.com/EXT_IG with tenant ig and site EXT_IG while exposing live Bangalore, India openings including Lead Cyber Defence Analyst, Content Producer, and Principal Platform Engineer.',
  modulePath: path.resolve(currentDir, 'script.js'),
  dryRunFile: 'iginfotechindia.workday/jobs.json',
}

export default IG_INFOTECH_INDIA_CATALOG
