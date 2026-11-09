import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const INSTASAFE_CATALOG = {
  source: 'instasafe',
  companyName: 'InstaSafe',
  officialBrandName: 'InstaSafe',
  adapter: 'script',
  companyCareerPage: 'https://instasafe.com/careers/',
  homepageUrl: 'https://instasafe.com/',
  careersPageUrl: 'https://instasafe.com/careers/',
  careersPortalUrl: 'https://instasafe.zohorecruit.com/jobs/Careers',
  careersApiUrl:
    'https://instasafe.zohorecruit.com/recruit/v2/public/Job_Openings?source=CareerSite&pagename=Careers&extra_fields=%5B%22Date_Opened%22,%22Job_Description%22,%22Work_Experience%22,%22Job_Type%22,%22Required_Skills%22%5D',
  atsPlatform: 'zohorecruit',
  countryFilter: 'India',
  paginationStrategy: 'single-first-party-careers-page-plus-zohorecruit-portal-plus-public-api',
  extractionStrategy: 'verified-first-party-careers-page+verified-zohorecruit-portal+public-job-openings-api+india-country-filter',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  companyDomain: 'instasafe.com',
  dryRunFile: 'instasafe/jobs.json',
  verifiedOn: '2026-09-03',
  verifiedPublicPostingCount: 14,
  verifiedIndiaJobCount: 12,
  verifiedSurfaceSummary:
    'Verified on September 3, 2026 that https://instasafe.com/careers/ is InstaSafe\'s live first-party careers page with the current title "Instasafe Careers | Instasafe Jobs", server-rendered "See open roles" and "Our Openings" sections, and an official handoff to the branded Zoho Recruit board at https://instasafe.zohorecruit.com/jobs/Careers. Verified the linked public Zoho Recruit API at https://instasafe.zohorecruit.com/recruit/v2/public/Job_Openings?source=CareerSite&pagename=Careers&extra_fields=%5B%22Date_Opened%22,%22Job_Description%22,%22Work_Experience%22,%22Job_Type%22,%22Required_Skills%22%5D returned 14 public postings, including 12 India jobs with explicit India location metadata during the verification run.',
  modulePath: path.join(currentDir, 'script.js'),
}

export default INSTASAFE_CATALOG
