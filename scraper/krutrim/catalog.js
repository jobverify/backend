import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const KRUTRIM_CATALOG = {
  source: 'krutrim',
  companyName: 'Krutrim',
  officialBrandName: 'Krutrim',
  adapter: 'script',
  modulePath: path.join(currentDir, 'script.js'),
  companyCareerPage: 'https://ai-labs.olakrutrim.com/',
  homepageUrl: 'https://www.olakrutrim.com/',
  companyDomain: 'olakrutrim.com',
  atsPlatform: 'official-company-site-no-public-careers',
  countryFilter: 'India',
  paginationStrategy: 'homepage-plus-ai-labs-join-us-shell-plus-missing-crawlable-careers-routes',
  extractionStrategy:
    'verified-main-homepage+verified-ai-labs-join-us-shell+verified-no-crawlable-job-links+missing-careers-routes-and-sitemap-surface-return-empty',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  dryRunFile: 'krutrim/jobs.json',
  verifiedOn: '2026-07-16',
  verifiedSurfaceSummary:
    'Verified on Thursday, July 16, 2026 that https://www.olakrutrim.com/ is the current first-party Krutrim Cloud site and https://ai-labs.olakrutrim.com/ is the public Krutrim AI Labs surface with a Join Us section that shows Career Opportunities and an Open Positions button. That AI Labs page does not expose a crawlable first-party jobs URL, https://ai-labs.olakrutrim.com/careers and https://ai-labs.olakrutrim.com/sitemap.xml return first-party 404 pages, and the main sitemap at https://www.olakrutrim.com/sitemap.xml lists only product and legal URLs. There is no trustworthy public jobs surface to scrape.',
}

export default KRUTRIM_CATALOG
