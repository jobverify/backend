import { fileURLToPath } from 'node:url'

const modulePath = fileURLToPath(new URL('./script.js', import.meta.url))

export const OPTISOL_BUSINESS_SOLUTIONS_CATALOG = {
  source: 'optisolbusinesssolutions',
  companyName: 'OptiSol Business Solutions',
  officialBrandName: 'OptiSol',
  adapter: 'script',
  modulePath,
  homepageUrl: 'https://www.optisolbusiness.com/join-with-us',
  companyCareerPage: 'https://www.optisolbusiness.com/current-openings',
  currentOpeningsUrl: 'https://www.optisolbusiness.com/current-openings',
  careersPortalUrl: 'https://optisolbusiness.zohorecruit.in/jobs/Careers',
  careersApiUrl: 'https://optisolbusiness.zohorecruit.in/recruit/v2/public/Job_Openings?pagename=Careers&source=CareerSite',
  companyDomain: 'optisolbusiness.com',
  atsPlatform: 'embedded-zohorecruit',
  countryFilter: 'India',
  paginationStrategy: 'single-zohorecruit-api-payload',
  extractionStrategy: 'verified-first-party-landing+embedded-zohorecruit-widget+public-job-openings-api',
  verifiedOn: '2026-08-03',
  verifiedSurfaceSummary:
    'Verified on Monday, August 3, 2026 that https://www.optisolbusiness.com/join-with-us remained the live first-party OptiSol careers landing page, that https://www.optisolbusiness.com/current-openings embedded Zoho Recruit with site https://optisolbusiness.zohorecruit.in and page_name Careers, and that the paired public Job_Openings API returned the India role Digital Marketing Associate in Chennai.',
}

export default OPTISOL_BUSINESS_SOLUTIONS_CATALOG
