import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const HYTECH_PROFESSIONALS_CATALOG = {
  source: 'hytechprofessionals',
  companyName: 'HyTech Professionals',
  officialBrandName: 'HyTechPro',
  adapter: 'script',
  homepageUrl: 'https://www.hytechpro.com/',
  companyCareerPage: 'https://www.hytechpro.com/career',
  jobsApiUrl:
    'https://hytechprous.zohorecruit.com/recruit/v2/public/Job_Openings?pagename=Careers&source=CareerSite',
  atsPlatform: 'zoho-recruit',
  countryFilter: 'India',
  paginationStrategy: 'single-public-zoho-payload',
  extractionStrategy: 'verified-first-party-careers-page+zoho-public-jobs-api',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  companyDomain: 'hytechpro.com',
  verifiedOn: '2026-07-18',
  verifiedSurfaceSummary:
    'Verified on Saturday, July 18, 2026 that https://www.hytechpro.com/career is the live first-party HyTechPro careers page, that it embeds Zoho Recruit with site https://hytechprous.zohorecruit.com, and that the public jobs payload exposes India roles including SEO specialist, Full Stack Microsoft Web Developer, and Salesforce Developer.',
  dryRunFile: 'hytechprofessionals/jobs.json',
  modulePath: path.resolve(currentDir, 'script.js'),
}

export default HYTECH_PROFESSIONALS_CATALOG
