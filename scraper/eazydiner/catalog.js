import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const VERIFIED_SURFACE_SUMMARY =
  'Verified on Thursday, August 13, 2026 that https://www.eazydiner.com/ is still the live first-party homepage and still links visitors to the first-party career route at https://www.eazydiner.com/career. Verified that the live career page remains a resume-drop recruiting surface titled "Explore Career Opportunities at EazyDiner | Apply Now" that tells candidates to write to career@eazydiner.com, but it does not expose public job cards, job detail pages, or a public ATS handoff. Verified that https://www.eazydiner.com/robots.txt still advertises https://www.eazydiner.com/sitemap.xml, that the advertised sitemap URL currently returns a 404 "Sitemap not found" placeholder, that https://www.eazydiner.com/sitemap/others.xml still publishes only https://www.eazydiner.com/career as a career-like first-party route, and that adjacent routes https://www.eazydiner.com/careers, https://www.eazydiner.com/jobs, https://www.eazydiner.com/join-us, and https://www.eazydiner.com/work-with-us still return 404 during live checks. No trustworthy public jobs surface is currently available.'

export const EAZY_DINER_CATALOG = {
  source: 'eazydiner',
  companyName: 'EazyDiner',
  officialBrandName: 'EazyDiner',
  adapter: 'script',
  modulePath: path.resolve(currentDir, 'script.js'),
  dryRunFile: 'eazydiner/jobs.json',
  rootUrl: 'https://www.eazydiner.com/',
  companyCareerPage: 'https://www.eazydiner.com/career',
  companyDomain: 'eazydiner.com',
  robotsTxtUrl: 'https://www.eazydiner.com/robots.txt',
  sitemapUrl: 'https://www.eazydiner.com/sitemap.xml',
  otherRoutesSitemapUrl: 'https://www.eazydiner.com/sitemap/others.xml',
  verifiedResumeDropEmail: 'career@eazydiner.com',
  atsPlatform: 'official-company-site-no-public-careers',
  countryFilter: 'India',
  paginationStrategy: 'verified-homepage-plus-career-page-plus-robots-sitemap-plus-missing-job-routes',
  extractionStrategy:
    'verified-homepage-career-link+verified-resume-drop-career-page+verified-robots-sitemap-with-single-career-url+verified-missing-job-routes-return-empty',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-08-13',
  verifiedSurfaceSummary: VERIFIED_SURFACE_SUMMARY,
}

export default EAZY_DINER_CATALOG
