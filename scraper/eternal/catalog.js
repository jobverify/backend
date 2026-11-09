import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const VERIFIED_SURFACE_SUMMARY =
  'Verified on July 15, 2026 that https://www.eternal.com/ is the live first-party homepage and links to https://www.eternal.com/careers/. Verified that the live first-party careers page at https://www.eternal.com/careers/ is a shell titled "Careers - Hiring at Eternal" with canonical https://eternal.com/careers, but it does not expose public job cards, job detail pages, ATS handoff links, or structured JobPosting data. Verified that https://www.eternal.com/robots.txt and https://www.eternal.com/sitemap.xml both return 404, and that https://www.eternal.com/jobs/, https://www.eternal.com/join-us/, and https://www.eternal.com/work-with-us/ each resolve to a branded "Page Not Found | Eternal" page. There is no trustworthy public jobs surface on the verified first-party domain.'

export const ETERNAL_CATALOG = {
  source: 'eternal',
  companyName: 'Eternal',
  officialBrandName: 'Eternal',
  adapter: 'script',
  modulePath: path.resolve(currentDir, 'script.js'),
  dryRunFile: 'eternal/jobs.json',
  homepageUrl: 'https://www.eternal.com/',
  companyCareerPage: 'https://www.eternal.com/careers/',
  canonicalCareerUrl: 'https://eternal.com/careers',
  companyDomain: 'eternal.com',
  checkedNoJobsRouteUrls: [
    'https://www.eternal.com/jobs/',
    'https://www.eternal.com/join-us/',
    'https://www.eternal.com/work-with-us/',
  ],
  robotsTxtUrl: 'https://www.eternal.com/robots.txt',
  sitemapUrl: 'https://www.eternal.com/sitemap.xml',
  notFoundPageTitle: 'Page Not Found | Eternal',
  atsPlatform: 'official-company-site-no-public-jobs',
  countryFilter: 'India',
  paginationStrategy:
    'verified-homepage-plus-careers-shell-plus-missing-robots-sitemap-plus-not-found-job-routes',
  extractionStrategy:
    'verified-homepage-careers-link+verified-careers-shell-without-public-jobs+verified-missing-robots-sitemap+verified-not-found-job-routes+return-empty',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-15',
  verifiedSurfaceSummary: VERIFIED_SURFACE_SUMMARY,
}

export default ETERNAL_CATALOG
