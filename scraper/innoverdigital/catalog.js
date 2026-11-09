import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const INNOVER_DIGITAL_CATALOG = {
  source: 'innoverdigital',
  companyName: 'Innover Digital',
  officialBrandName: 'Innover',
  adapter: 'script',
  homepageUrl: 'https://www.innoverdigital.com/',
  companyCareerPage: 'https://www.innoverdigital.com/about/careers/',
  careersPortalUrl: 'https://innoverdigital.zohorecruit.in/jobs/Careers',
  careersApiUrl:
    'https://innoverdigital.zohorecruit.in/recruit/v2/public/Job_Openings?pagename=Careers&source=CareerSite',
  atsPlatform: 'zohorecruit',
  countryFilter: 'India',
  paginationStrategy: 'official-careers-page-handoff-plus-public-zoho-api',
  extractionStrategy: 'official-careers-page+branded-zohorecruit-portal+public-job-openings-api',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  companyDomain: 'innoverdigital.com',
  verifiedOn: '2026-07-17',
  verifiedSurfaceSummary:
    'Verified on Friday, July 17, 2026 that the first-party Innover Digital careers handoff at https://www.innoverdigital.com/about/careers/ pointed applicants to the branded public Zoho Recruit portal at https://innoverdigital.zohorecruit.in/jobs/Careers, that the portal exposed the Build a rewarding career with Innover messaging, and that the paired public API was live with the India role Application Support Manager / Sr. Manager.',
  modulePath: path.resolve(currentDir, 'script.js'),
  dryRunFile: 'innoverdigital/jobs.json',
}

export default INNOVER_DIGITAL_CATALOG
