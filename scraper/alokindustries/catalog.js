import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const ALOK_INDUSTRIES_CATALOG = {
  source: 'alokindustries',
  companyName: 'Alok Industries',
  legalEntityName: 'Alok Industries Limited',
  adapter: 'script',
  companyCareerPage: 'https://www.alokind.com/careers.html',
  companyDomain: 'alokind.com',
  officialHomepageUrl: 'https://www.alokind.com/',
  robotsTxtUrl: 'https://www.alokind.com/robots.txt',
  sitemapUrl: 'https://www.alokind.com/sitemap.xml',
  officialResumeEmail: 'resume@alokind.com',
  atsPlatform: 'official-company-site-no-public-careers',
  countryFilter: 'India',
  paginationStrategy: 'verified-homepage-plus-resume-only-careers-page-plus-missing-first-party-job-routes',
  extractionStrategy:
    'verified-homepage-careers-link+verified-resume-only-careers-page+verified-missing-first-party-job-routes-return-empty',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-15',
  verifiedSurfaceSummary:
    'Verified on July 15, 2026 that https://www.alokind.com/ is the live first-party Alok Industries Limited homepage and links Careers to https://www.alokind.com/careers.html, that the careers page is currently a resume-only surface via resume@alokind.com, and that adjacent first-party job routes such as /careers, /jobs, /join-us, /openings, and /current-openings returned 404 pages. There is no trustworthy public jobs surface on the Alok Industries domain right now.',
  modulePath: path.join(currentDir, 'script.js'),
}

export default ALOK_INDUSTRIES_CATALOG
