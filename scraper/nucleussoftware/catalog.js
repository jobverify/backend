import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const NUCLEUS_SOFTWARE_CATALOG = {
  source: 'nucleussoftware',
  companyName: 'Nucleus Software',
  officialBrandName: 'Nucleus Software Exports Ltd.',
  adapter: 'script',
  homepageUrl: 'https://www.nucleussoftware.com/',
  companyCareerPage: 'https://www.nucleussoftware.com/careers/',
  careersPortalUrl: 'https://nucleussoftware.zohorecruit.in/jobs/Careers',
  careersApiUrl:
    'https://nucleussoftware.zohorecruit.in/recruit/v2/public/Job_Openings?pagename=Careers&source=CareerSite',
  atsPlatform: 'zohorecruit',
  countryFilter: 'India',
  paginationStrategy: 'single-public-feed',
  extractionStrategy: 'verified-first-party-careers-page+zoho-public-job-openings-api',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  companyDomain: 'nucleussoftware.com',
  verifiedOn: '2026-08-03',
  verifiedSurfaceSummary:
    'Verified on Monday, August 3, 2026 that https://www.nucleussoftware.com/careers/ is the live first-party careers page for Nucleus Software and still links Open Positions / Explore opportunities / Search Job Opportunities to the branded Zoho board at https://nucleussoftware.zohorecruit.in/jobs/Careers. The companion public feed at https://nucleussoftware.zohorecruit.in/recruit/v2/public/Job_Openings?pagename=Careers&source=CareerSite returned 40 public jobs on the verified date, including 29 India jobs such as Account Management - Manager, Technical Lead - Power BI, and Senior Manager Sales in Noida.',
  modulePath: path.join(currentDir, 'script.js'),
}

export default NUCLEUS_SOFTWARE_CATALOG
