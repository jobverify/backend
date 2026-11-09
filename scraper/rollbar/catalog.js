import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const ROLLBAR_CATALOG = {
  source: 'rollbar',
  companyName: 'Rollbar',
  officialBrandName: 'Rollbar',
  adapter: 'script',
  modulePath: path.resolve(currentDir, 'script.js'),
  homepageUrl: 'https://rollbar.com/',
  companyCareerPage: 'https://rollbar.com/careers',
  aboutPageUrl: 'https://rollbar.com/about-us',
  jobsPageUrl: 'https://rollbar.com/jobs',
  contactPageUrl: 'https://rollbar.com/contact-us',
  homepageCareersAnchorUrl: 'https://rollbar.com/about-us#career',
  atsPlatform: 'official-company-site-no-public-careers',
  countryFilter: 'Global',
  paginationStrategy:
    'verified-homepage-footer-careers-anchor-plus-careers-and-jobs-route-validation',
  extractionStrategy:
    'verified-homepage-footer-careers-anchor+verified-careers-route-about-page-no-public-jobs-return-empty+verified-jobs-route-homepage-return-empty',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  companyDomain: 'rollbar.com',
  verifiedOn: '2026-10-03',
  verifiedSurfaceSummary:
    'Verified on October 3, 2026 that https://rollbar.com/ uses the new title "Rollbar | Error Tracking Tool That Fixes Errors Too" and hero "Every production error, found and fixed." Its footer Careers link still targets https://rollbar.com/about-us#career. Direct requests to https://rollbar.com/careers resolve to the first-party about page at https://rollbar.com/about-us, while https://rollbar.com/jobs resolves back to the homepage. The about page still says "Join the Rollbar Team" and links only to https://rollbar.com/contact-us. These first-party routes expose no trustworthy public jobs surface, ATS handoff, public openings list, or JobPosting records.',
  dryRunFile: 'rollbar/jobs.json',
}

export default ROLLBAR_CATALOG
