import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const KANERIKA_SOFTWARE_CATALOG = {
  source: 'kanerikasoftware',
  companyName: 'Kanerika Software',
  officialBrandName: 'Kanerika',
  adapter: 'script',
  homepageUrl: 'https://kanerika.com/',
  companyCareerPage: 'https://kanerika.com/careers/',
  careersPortalUrl: 'https://kanerika.zohorecruit.com/jobs/Careers',
  jobsApiUrl: 'https://kanerika.zohorecruit.com/recruit/v2/public/Job_Openings?pagename=Careers&source=CareerSite',
  atsPlatform: 'zohorecruit',
  countryFilter: 'India',
  paginationStrategy: 'single-public-jobs-api',
  extractionStrategy: 'verified-first-party-careers-page+embedded-zohorecruit-widget+public-job-openings-api',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  companyDomain: 'kanerika.com',
  verifiedOn: '2026-07-18',
  verifiedSurfaceSummary:
    'Verified on Saturday, July 18, 2026 that https://kanerika.com/careers/ is the live first-party Kanerika careers page and that its Career Opportunities section embeds the public Zoho Recruit widget for https://kanerika.zohorecruit.com. The verified public Job_Openings API at https://kanerika.zohorecruit.com/recruit/v2/public/Job_Openings?pagename=Careers&source=CareerSite returned live India openings including Data Engineer and Lead Data Engineer - Databricks on the verified date.',
  modulePath: path.resolve(currentDir, 'script.js'),
}

export default KANERIKA_SOFTWARE_CATALOG
