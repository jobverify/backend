import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const GAMESKRAFT_CATALOG = {
  source: 'gameskraft',
  companyName: 'GamesKraft',
  adapter: 'script',
  companyCareerPage: 'https://gameskraft.com/careers',
  companyDomain: 'gameskraft.com',
  officialHomepageUrl: 'https://gameskraft.com/',
  wwwHomepageUrl: 'https://www.gameskraft.com/',
  landerUrl: 'https://gameskraft.com/lander',
  robotsTxtUrl: 'https://gameskraft.com/robots.txt',
  sitemapUrl: 'https://gameskraft.com/sitemap.xml',
  llmsTxtUrl: 'https://gameskraft.com/llms.txt',
  noPublicJobRouteUrls: [
    'https://gameskraft.com/jobs',
    'https://gameskraft.com/current-openings',
  ],
  atsPlatform: 'official-company-site-no-public-careers',
  countryFilter: 'India',
  paginationStrategy: 'verified-redirect-shell-plus-parked-lander-and-crawl-surface-validation',
  extractionStrategy:
    'verified-homepage-and-careers-redirect-shell+verified-parked-lander+sitemap-robots-llms-validation+empty-adjacent-job-routes-return-empty',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-15',
  verifiedSurfaceSummary:
    'Verified on July 15, 2026 that https://gameskraft.com/, https://www.gameskraft.com/, and https://gameskraft.com/careers all serve the same first-party JavaScript redirect shell to /lander; that https://gameskraft.com/lander is currently a parked landing page; that https://gameskraft.com/jobs and https://gameskraft.com/current-openings also resolve to the same redirect shell; and that the crawl surfaces at https://gameskraft.com/robots.txt, https://gameskraft.com/sitemap.xml, and https://gameskraft.com/llms.txt only point back to the parked domain surface. There is no trustworthy public jobs surface on the GamesKraft domain right now.',
  modulePath: path.join(currentDir, 'script.js'),
}

export default GAMESKRAFT_CATALOG
