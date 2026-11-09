import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const VERIFIED_SURFACE_SUMMARY =
  'Verified on July 15, 2026 that https://www.dialpad.com/careers/ is the live first-party Dialpad careers page and links See all jobs to https://www.dialpad.com/careers/open-opportunities/. Verified that the first-party open opportunities page currently lists 6 Bengaluru, India roles, including QA Automation Engineer, Sr. Software Engineer (Search), Account Receivable Associate (6-Month Contract), Salesforce Administrator, Sr. Salesforce Developer, and Security Engineer. Verified that the first-party India detail page at https://www.dialpad.com/careers/open-opportunities/apply/?id=8407056002&location=Bengaluru-India&officeId=4017032002&title=QA-Automation-Engineer renders the full job description and exposes Apply for this position to https://boards.greenhouse.io/dialpad/jobs/8407056002.'

export const DIALPAD_CATALOG = {
  source: 'dialpad',
  companyName: 'Dialpad',
  officialBrandName: 'Dialpad',
  adapter: 'script',
  homepageUrl: 'https://www.dialpad.com/',
  companyCareerPage: 'https://www.dialpad.com/careers/',
  openOpportunitiesUrl: 'https://www.dialpad.com/careers/open-opportunities/',
  sampleJobUrl:
    'https://www.dialpad.com/careers/open-opportunities/apply/?id=8407056002&location=Bengaluru-India&officeId=4017032002&title=QA-Automation-Engineer',
  sampleApplyUrl: 'https://boards.greenhouse.io/dialpad/jobs/8407056002',
  companyDomain: 'dialpad.com',
  atsPlatform: 'first-party-careers-plus-greenhouse-apply-link',
  countryFilter: 'India',
  paginationStrategy: 'first-party-open-opportunities-list',
  extractionStrategy:
    'verified-first-party-careers-page+verified-open-opportunities-listing+india-location-filter+first-party-detail-pages+greenhouse-apply-links',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-15',
  verifiedSurfaceSummary: VERIFIED_SURFACE_SUMMARY,
  dryRunFile: 'dialpad/jobs.json',
  modulePath: path.resolve(currentDir, 'script.js'),
}

export default DIALPAD_CATALOG
