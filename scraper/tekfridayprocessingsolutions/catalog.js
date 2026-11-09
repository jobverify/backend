import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const TEKFRIDAY_PROCESSING_SOLUTIONS_CATALOG = {
  source: 'tekfridayprocessingsolutions',
  companyName: 'TekFriday Processing Solutions',
  officialBrandName: 'TekFriday',
  adapter: 'script',
  homepageUrl: 'https://www.tekfriday.com/',
  companyCareerPage: 'https://www.tekfriday.com/careers.html',
  companyDomain: 'tekfriday.com',
  atsPlatform: 'zohorecruit',
  countryFilter: 'India',
  paginationStrategy: 'single-first-party-careers-page-plus-zohorecruit-portal-plus-public-api',
  extractionStrategy: 'verified-homepage+verified-first-party-careers-page+embedded-zohorecruit-portal+public-job-openings-api',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-08-05',
  verifiedSurfaceSummary:
    'Verified on Wednesday, August 5, 2026 that https://www.tekfriday.com/ linked to the live first-party careers page at https://www.tekfriday.com/careers.html, that the careers page embedded the public Zoho Recruit widget for https://tekfriday.zohorecruit.in via rec_embed_js.load, and that the public jobs portal at https://tekfriday.zohorecruit.in/jobs/Careers and public API at https://tekfriday.zohorecruit.in/recruit/v2/public/Job_Openings?pagename=Careers&source=CareerSite were live with current India openings including .Net8 Developers, Python Developer, Salesforce Marketing Cloud & Data Cloud Specialist - FinTech, and Management Trainee.',
  modulePath: path.resolve(currentDir, 'script.js'),
  dryRunFile: 'tekfridayprocessingsolutions/jobs.json',
}

export default TEKFRIDAY_PROCESSING_SOLUTIONS_CATALOG
