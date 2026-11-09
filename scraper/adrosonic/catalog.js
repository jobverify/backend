import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const ADROSONIC_CATALOG = {
  source: 'adrosonic',
  companyName: 'Adrosonic',
  officialBrandName: 'Adrosonic',
  adapter: 'script',
  companyCareerPage: 'https://adrosonic.com/careers/',
  homepageUrl: 'https://adrosonic.com/',
  careersPageUrl: 'https://adrosonic.com/careers/',
  careersPortalUrl: 'https://adrosonic.zohorecruit.in/jobs/Careers/',
  careersApiUrl:
    'https://adrosonic.zohorecruit.in/recruit/v2/public/Job_Openings?pagename=Careers&source=CareerSite',
  atsPlatform: 'zohorecruit',
  countryFilter: 'India',
  paginationStrategy: 'official-careers-page-handoff-plus-public-zoho-api',
  extractionStrategy: 'official-careers-page+branded-zohorecruit-portal+public-job-openings-api',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  companyDomain: 'adrosonic.com',
  verifiedOn: '2026-07-14',
  verifiedSurfaceSummary:
    'Verified on July 14, 2026 that https://adrosonic.com/ links to the first-party careers page at https://adrosonic.com/careers/, which hands off to the branded public Zoho Recruit portal at https://adrosonic.zohorecruit.in/jobs/Careers/ backed by https://adrosonic.zohorecruit.in/recruit/v2/public/Job_Openings?pagename=Careers&source=CareerSite.',
  modulePath: path.join(currentDir, 'script.js'),
}

export default ADROSONIC_CATALOG
