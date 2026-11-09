import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const RURALSHORES_CATALOG = {
  source: 'ruralshores',
  companyName: 'RuralShores',
  officialBrandName: 'RuralShores',
  adapter: 'script',
  companyCareerPage: 'https://www.ruralshores.com/career.aspx',
  officialCareersPageUrl: 'https://www.ruralshores.com/career.aspx',
  companyDomain: 'ruralshores.com',
  atsPlatform: 'first-party-html-board',
  countryFilter: 'India',
  paginationStrategy: 'single-public-page',
  extractionStrategy: 'verified-first-party-careers-page+empty-talent-network-shell-or-html-jobcards',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-08-13',
  verifiedSurfaceSummary:
    'Verified on Thursday, August 13, 2026 that https://www.ruralshores.com/career.aspx is the current first-party RuralShores careers page linked from the homepage navigation, while the older https://www.ruralshores.com/career.html route now returns 404. The live careers page currently presents a first-party talent-network shell with the headings "Build a Rewarding Career with RuralShores" and "Join Our Talent Network", a mailto handoff to careers@ruralshores.com, and no public HTML job cards, requisition IDs, or opening list to scrape.',
  dryRunFile: 'ruralshores/jobs.json',
  modulePath: path.resolve(currentDir, 'script.js'),
}

export default RURALSHORES_CATALOG
