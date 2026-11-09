import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const ENMOVIL_CATALOG = {
  source: 'enmovil',
  companyName: 'Enmovil',
  officialBrandName: 'Enmovil',
  adapter: 'script',
  homepageUrl: 'https://www.enmovil.ai/',
  companyCareerPage: 'https://www.enmovil.ai/careers',
  sitemapUrl: 'https://www.enmovil.ai/sitemap.xml',
  checkedJobsRouteUrl: 'https://www.enmovil.ai/jobs',
  companyDomain: 'enmovil.ai',
  atsPlatform: 'official-company-careers-nonlisting',
  countryFilter: 'India',
  paginationStrategy: 'first-party-explicit-empty-careers-plus-sitemap-and-jobs-404-validation',
  extractionStrategy:
    'verified-homepage+verified-sitemap-home-url+verified-explicit-empty-careers-page+verified-jobs-route-404-return-empty',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-10-03',
  verifiedSurfaceSummary:
    'Verified on October 3, 2026 that https://www.enmovil.ai/ is the live official Enmovil homepage, that https://www.enmovil.ai/sitemap.xml includes the homepage while the noindex careers page is omitted, that https://www.enmovil.ai/careers explicitly says "We have no open roles right now" without public job listings or ATS handoffs, and that https://www.enmovil.ai/jobs returns a first-party Page Not Found shell. There is no trustworthy public jobs surface for Enmovil at the verified first-party URLs.',
  modulePath: path.join(currentDir, 'script.js'),
  dryRunFile: 'enmovil/jobs.json',
}

export default ENMOVIL_CATALOG
