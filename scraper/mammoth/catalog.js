import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const MAMMOTH_CATALOG = {
  source: 'mammoth',
  companyName: 'Mammoth',
  officialBrandName: 'Mammoth Analytics',
  adapter: 'script',
  companyCareerPage: 'https://mammoth.io/',
  companyDomain: 'mammoth.io',
  officialAboutUrl: 'https://mammoth.io/about-us/',
  atsPlatform: 'official-company-site-no-public-careers',
  countryFilter: 'India',
  paginationStrategy: 'homepage-plus-about-plus-common-careers-route-404-validation',
  extractionStrategy: 'verified-homepage+verified-about-page+verified-missing-common-careers-routes-return-empty',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-16',
  verifiedSurfaceSummary:
    'Verified on Thursday, July 16, 2026 that https://mammoth.io/ is the live first-party Mammoth Analytics site, https://mammoth.io/about-us/ is the official about page, and the domain exposes no trustworthy public jobs surface. Common first-party careers routes such as /careers, /jobs, /join-us, and /team return first-party 404 pages rather than public openings.',
  modulePath: path.join(currentDir, 'script.js'),
}

export default MAMMOTH_CATALOG
