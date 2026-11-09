import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const EKA_SOFTWARE_CATALOG = {
  source: 'ekasoftware',
  companyName: 'Eka Software',
  officialBrandName: 'Quoreka',
  adapter: 'script',
  companyCareerPage: 'https://quoreka.com/careers',
  homepageUrl: 'https://quoreka.com/',
  careersPageUrl: 'https://quoreka.com/careers',
  sitemapUrl: 'https://quoreka.com/sitemap.xml',
  sitemapCareerRouteUrls: ['https://quoreka.com/careers'],
  noPublicJobRouteUrls: [
    'https://quoreka.com/jobs',
    'https://quoreka.com/careers/jobs',
    'https://quoreka.com/openings',
    'https://quoreka.com/join-us',
    'https://quoreka.com/work-with-us',
    'https://quoreka.com/current-openings',
  ],
  atsPlatform: 'official-company-site-no-public-careers',
  countryFilter: 'India',
  paginationStrategy: 'homepage-plus-careers-page-plus-sitemap-and-adjacent-route-validation',
  extractionStrategy:
    'verified-homepage+verified-first-party-careers-page+verified-single-sitemap-careers-route+missing-adjacent-jobs-routes-return-empty',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  companyDomain: 'quoreka.com',
  verifiedOn: '2026-07-15',
  verifiedSurfaceSummary:
    'Verified on July 15, 2026 that https://quoreka.com/ is the live first-party Quoreka homepage for the Eka Software business and links Careers to https://quoreka.com/careers, that the official careers page is currently a culture page with sections such as Our Vision, Our Values, and Career Benefits rather than public job cards or ATS handoffs, that https://quoreka.com/sitemap.xml currently publishes only https://quoreka.com/careers as the careers-like route, and that adjacent first-party job routes such as https://quoreka.com/jobs, https://quoreka.com/careers/jobs, https://quoreka.com/openings, https://quoreka.com/join-us, https://quoreka.com/work-with-us, and https://quoreka.com/current-openings returned 404 responses during live checks. There is no trustworthy public jobs surface for Eka Software on the current first-party Quoreka domain right now.',
  dryRunFile: 'ekasoftware/jobs.json',
  modulePath: path.resolve(currentDir, 'script.js'),
}

export default EKA_SOFTWARE_CATALOG
