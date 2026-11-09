import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SNAPDEAL_CATALOG = {
  source: 'snapdeal',
  companyName: 'Snapdeal',
  officialBrandName: 'Snapdeal',
  adapter: 'script',
  companyCareerPage: 'https://www.snapdeal.com/',
  officialCareersPageUrl: 'https://www.snapdeal.com/',
  officialAboutPageUrl: 'https://www.snapdeal.com/page/about-us',
  officialCareersHandoffUrl: 'https://www.linkedin.com/company/snapdeal/',
  linkedinCompanyPageUrl: 'https://www.linkedin.com/company/snapdeal/',
  linkedinWorldwideJobsUrl: 'https://www.linkedin.com/jobs/snapdeal-jobs-worldwide?f_C=2100709',
  publicLinkedInJobsUrl: 'https://www.linkedin.com/jobs/search/?f_C=2100709&geoId=102713980',
  companyDomain: 'snapdeal.com',
  atsPlatform: 'linkedin-guest-search',
  countryFilter: 'India',
  paginationStrategy: 'single-public-company-search-page',
  extractionStrategy:
    'official-homepage-and-about-page-linkedin-handoff+public-linkedin-company-search+public-detail-jsonld',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-08-14',
  verifiedPublicJobCount: 3,
  verifiedIndiaJobCount: 3,
  verifiedSampleJobUrl: 'https://in.linkedin.com/jobs/view/lead-software-engineer-at-snapdeal-4450897171',
  verifiedSurfaceSummary:
    'Verified on Friday, August 14, 2026 that both the official Snapdeal homepage at https://www.snapdeal.com/ and the official about page at https://www.snapdeal.com/page/about-us still expose a Careers footer link, but that live link now points to the public LinkedIn company page at https://www.linkedin.com/company/snapdeal/ instead of the historical Darwinbox portal. Also verified that the LinkedIn company page exposes the Snapdeal organization with org id 2100709, that its See jobs control points to https://www.linkedin.com/jobs/snapdeal-jobs-worldwide?f_C=2100709, and that the public India jobs search at https://www.linkedin.com/jobs/search/?f_C=2100709&geoId=102713980 exposed 3 India roles on the verified date, including Lead Software Engineer, Senior Manager / Associate Director - HR, and Training Content & Video Production Intern in Gurugram.',
  dryRunFile: 'snapdeal/jobs.json',
  modulePath: path.resolve(currentDir, 'script.js'),
}

export default SNAPDEAL_CATALOG
