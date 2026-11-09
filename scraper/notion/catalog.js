import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const NOTION_CATALOG = {
  source: 'notion',
  companyName: 'Notion',
  officialBrandName: 'Notion',
  adapter: 'script',
  companyCareerPage: 'https://www.notion.com/careers',
  officialCareersPageUrl: 'https://www.notion.com/careers',
  ashbyPublicBoardUrl: 'https://jobs.ashbyhq.com/notion',
  ashbyJobBoardUrl: 'https://api.ashbyhq.com/posting-api/job-board/notion',
  companyDomain: 'notion.com',
  atsPlatform: 'ashby',
  countryFilter: 'India',
  paginationStrategy: 'official-site-handoff-plus-public-ashby-job-board',
  extractionStrategy:
    'verified-official-careers-page-handoff+public-ashby-job-board-api+india-location-filter',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-16',
  verifiedSurfaceSummary:
    'Verified on Thursday, July 16, 2026 that the official Notion careers page at https://www.notion.com/careers links candidate traffic to the public Ashby board at https://jobs.ashbyhq.com/notion, that the public board API is https://api.ashbyhq.com/posting-api/job-board/notion, and that the verified India slice on that date included Hyderabad, India roles such as Customer Support - Billing, Product Support Manager, QA Manager, Software Engineer, Developer Experience, and Software Engineer, Infrastructure.',
  modulePath: path.resolve(currentDir, 'script.js'),
}

export default NOTION_CATALOG
