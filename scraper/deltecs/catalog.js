import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const VERIFIED_SURFACE_SUMMARY =
  'Verified on August 1, 2026 that https://www.dronahq.com/ is the live first-party DronaHQ homepage and that its title, careers navigation, and Deltecs Infotech Pvt Ltd footer still tie the brand to Deltecs. Verified that https://www.dronahq.com/careers/ is the live first-party public careers page with 4 public openings linking to first-party role pages under https://www.dronahq.com/career/, including https://www.dronahq.com/career/b2b-tech-marketing-intern-developer-platform/, https://www.dronahq.com/career/qa-lead/, https://www.dronahq.com/career/legal-executive/, and https://www.dronahq.com/career/b2b-saas-marketer/. Verified that https://www.dronahq.com/career-sitemap.xml is the first-party career sitemap for the same public jobs surface.'

export const DELTECS_CATALOG = {
  source: 'deltecs',
  companyName: 'Deltecs',
  officialBrandName: 'Deltecs Infotech Pvt Ltd',
  publicBrandName: 'DronaHQ',
  adapter: 'script',
  modulePath: path.resolve(currentDir, 'script.js'),
  dryRunFile: 'deltecs/jobs.json',
  homepageUrl: 'https://www.dronahq.com/',
  companyCareerPage: 'https://www.dronahq.com/careers/',
  careersSitemapUrl: 'https://www.dronahq.com/career-sitemap.xml',
  verifiedJobUrls: [
    'https://www.dronahq.com/career/b2b-tech-marketing-intern-developer-platform/',
    'https://www.dronahq.com/career/qa-lead/',
    'https://www.dronahq.com/career/legal-executive/',
    'https://www.dronahq.com/career/b2b-saas-marketer/',
  ],
  companyDomain: 'dronahq.com',
  atsPlatform: 'official-company-careers',
  countryFilter: 'India',
  paginationStrategy: 'verified-first-party-careers-page-plus-first-party-detail-pages',
  extractionStrategy:
    'verified-dronahq-homepage+verified-deltecs-brand-signals+verified-careers-page+first-party-job-cards+first-party-detail-pages',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-08-01',
  verifiedSurfaceSummary: VERIFIED_SURFACE_SUMMARY,
}

export default DELTECS_CATALOG
