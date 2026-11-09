import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const HOTFOOT_TECHNOLOGY_CATALOG = {
  source: 'hotfoottechnology',
  companyName: 'Hotfoot Technology',
  officialBrandName: 'Hotfoot Technology Solutions',
  adapter: 'script',
  modulePath: path.join(currentDir, 'script.js'),
  companyCareerPage: 'https://hotfoot.co.in/job-openings/',
  homepageUrl: 'https://hotfoot.co.in/',
  jobsPageUrl: 'https://hotfoot.co.in/job-openings/',
  staleJobDetailRouteUrls: [
    'https://hotfoot.co.in/blog/job-openings/devops-engineer/',
    'https://hotfoot.co.in/blog/job-openings/senior-business-analyst/',
  ],
  staleJobArchiveRouteUrls: [
    'https://hotfoot.co.in/blog/category/job-openings/',
  ],
  companyDomain: 'hotfoot.co.in',
  atsPlatform: 'official-company-site-no-public-careers',
  countryFilter: 'India',
  paginationStrategy: 'verified-job-openings-placeholder-plus-stale-route-validation',
  extractionStrategy:
    'verified-first-party-job-openings-page-with-placeholder-shortcode+verified-stale-job-detail-routes-return-empty',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  dryRunFile: 'hotfoottechnology/jobs.json',
  verifiedOn: '2026-07-16',
  verifiedSurfaceSummary:
    'Verified on July 16, 2026 that https://hotfoot.co.in/job-openings/ is the live first-party Hotfoot Technology Solutions jobs page, but direct HTTP and browser-backed rendering both expose only recruiting copy plus the literal [awsmjobs] placeholder with careers@hotfoot.co.in and no live job cards, load-more controls, public detail links, ATS feed, or JobPosting records. Also verified that stale first-party job routes such as https://hotfoot.co.in/blog/job-openings/devops-engineer/, https://hotfoot.co.in/blog/job-openings/senior-business-analyst/, and https://hotfoot.co.in/blog/category/job-openings/ currently return the Hotfoot 404 page, so stale search-engine snippets do not reflect a trustworthy current public jobs surface. There is no trustworthy public jobs surface to scrape.',
}

export default HOTFOOT_TECHNOLOGY_CATALOG
