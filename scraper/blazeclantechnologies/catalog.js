import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const BLAZECLAN_TECHNOLOGIES_CATALOG = {
  source: 'blazeclantechnologies',
  companyName: 'Blazeclan Technologies',
  officialBrandName: 'Blazeclan',
  adapter: 'script',
  homepageUrl: 'https://blazeclan.com/',
  companyCareerPage: 'https://blazeclan.com/work-with-us/',
  brokenBoardUrl: 'https://blazeclan.zohorecruit.in/jobs/Careers',
  companyDomain: 'blazeclan.com',
  atsPlatform: 'first-party-careers-page-broken-zoho-handoff',
  countryFilter: 'India',
  paginationStrategy: 'single-first-party-work-with-us-page-plus-broken-board-validation',
  extractionStrategy:
    'verified-first-party-work-with-us-page+dead-zoho-board-handoff+fail-closed-sentinel',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-18',
  verifiedSurfaceSummary:
    'Verified on Saturday, July 18, 2026 that https://blazeclan.com/work-with-us/ was the exact-name Blazeclan careers page, that its Current Openings CTA pointed to https://blazeclan.zohorecruit.in/jobs/Careers, and that the linked Zoho Recruit board returned a dead-board page stating the tenant does not exist. Because the first-party handoff is broken and no trustworthy public jobs board is currently exposed, this local provider remains fail-closed.',
  modulePath: path.join(currentDir, 'script.js'),
  dryRunFile: 'blazeclantechnologies/jobs.json',
}

export default BLAZECLAN_TECHNOLOGIES_CATALOG
