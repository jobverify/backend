import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const HOPSCOTCH_CATALOG = {
  source: 'hopscotch',
  companyName: 'Hopscotch',
  officialBrandName: 'Hopscotch',
  adapter: 'script',
  modulePath: path.join(currentDir, 'script.js'),
  companyCareerPage: 'https://www.hopscotch.in/',
  homepageUrl: 'https://www.hopscotch.in/',
  sitemapUrl: 'https://www.hopscotch.in/sitemap.xml',
  noPublicJobRouteUrls: [
    'https://www.hopscotch.in/careers',
    'https://www.hopscotch.in/jobs',
    'https://www.hopscotch.in/job-openings',
  ],
  companyDomain: 'hopscotch.in',
  atsPlatform: 'official-company-site-no-public-careers',
  countryFilter: 'India',
  paginationStrategy: 'verified-app-shell-plus-sitemap-and-common-job-route-validation',
  extractionStrategy:
    'verified-first-party-commerce-shell+verified-sitemap-without-careers+verified-common-job-routes-without-public-listings-return-empty',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  dryRunFile: 'hopscotch/jobs.json',
  verifiedOn: '2026-07-16',
  verifiedSurfaceSummary:
    'Verified on July 16, 2026 that https://www.hopscotch.in/ and common career-like first-party routes resolve to the same Hopscotch commerce app shell, while https://www.hopscotch.in/sitemap.xml lists only commerce, help, and policy/about URLs and exposes no careers, jobs, job-openings, ATS handoff, public job cards, or JobPosting records. There is no trustworthy public jobs surface to scrape.',
}

export default HOPSCOTCH_CATALOG
