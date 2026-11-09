import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const FABEL_CATALOG = {
  source: 'fabel',
  companyName: 'Fabel',
  officialBrandName: 'Fabel Services Private Limited',
  adapter: 'script',
  homepageUrl: 'https://www.fabelservices.net/',
  companyCareerPage: 'https://www.fabelservices.net/',
  checkedCareersRouteUrls: [
    'https://www.fabelservices.net/careers',
    'https://www.fabelservices.net/career',
    'https://www.fabelservices.net/jobs',
    'https://www.fabelservices.net/join-us',
    'https://www.fabelservices.net/openings',
  ],
  companyDomain: 'fabelservices.net',
  atsPlatform: 'official-company-site-no-public-careers',
  countryFilter: 'India',
  paginationStrategy: 'homepage-plus-common-careers-route-404-validation',
  extractionStrategy: 'verified-homepage+verified-missing-common-careers-routes-return-empty',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-15',
  verifiedSurfaceSummary:
    'Verified on July 15, 2026 that https://www.fabelservices.net/ is the live official Fabel Services Private Limited homepage, with the first-party contact section on the homepage listing Plot No. 334, Udyog Vihar, Phase IV, Gurgaon 122016 plus info@fabelservices.net and 9999208074. The verified first-party site exposes no trustworthy public jobs surface, and common first-party careers routes including https://www.fabelservices.net/careers, https://www.fabelservices.net/career, https://www.fabelservices.net/jobs, https://www.fabelservices.net/join-us, and https://www.fabelservices.net/openings returned first-party 404 responses during live checks.',
  modulePath: path.join(currentDir, 'script.js'),
  dryRunFile: 'fabel/jobs.json',
}

export default FABEL_CATALOG
