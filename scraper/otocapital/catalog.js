import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const OTO_CAPITAL_CATALOG = {
  source: 'otocapital',
  companyName: 'OTO Capital',
  officialBrandName: 'OTO',
  adapter: 'script',
  homepageUrl: 'https://www.otocapital.in/',
  companyCareerPage: 'https://www.otocapital.in/careers',
  companyDomain: 'otocapital.in',
  officialSitemapUrl: 'https://www.otocapital.in/sitemap.xml',
  officialJobsPageUrl: 'https://www.otocapital.in/jobs',
  atsPlatform: 'official-company-site-no-public-careers',
  countryFilter: 'India',
  paginationStrategy: 'homepage-plus-sitemap-plus-careers-route-validation',
  extractionStrategy:
    'verified-homepage+verified-sitemap-without-careers+verified-careers-and-jobs-routes-404-return-empty',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-25',
  verifiedSurfaceSummary:
    'Verified on Saturday, July 25, 2026 that https://www.otocapital.in/ is the official live OTO homepage, that the official sitemap at https://www.otocapital.in/sitemap.xml did not expose a public careers or jobs route, and that the first-party routes https://www.otocapital.in/careers and https://www.otocapital.in/jobs both resolved to the first-party "OTO Capital - Not Found" shell rather than a trustworthy public jobs surface.',
  modulePath: path.resolve(currentDir, 'script.js'),
  dryRunFile: 'otocapital/jobs.json',
}

export default OTO_CAPITAL_CATALOG
