import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const ACCEDERE_CATALOG = {
  source: 'accedere',
  companyName: 'Accedere',
  officialBrandName: 'Accedere',
  adapter: 'script',
  companyCareerPage: 'https://accedere.io/',
  companyDomain: 'accedere.io',
  aboutPageUrl: 'https://accedere.io/about',
  contactPageUrl: 'https://accedere.io/contact',
  atsPlatform: 'official-company-site-no-public-careers',
  countryFilter: 'India',
  paginationStrategy: 'homepage-plus-about-page-plus-contact-page-plus-common-careers-route-validation',
  extractionStrategy: 'verified-homepage+verified-about-page+verified-contact-page+no-public-ats-or-careers-links-return-empty',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-14',
  verifiedSurfaceSummary:
    'Verified on July 14, 2026 that https://accedere.io/, https://accedere.io/about, and https://accedere.io/contact are live first-party Accedere pages. The official site exposes service, company, and contact content but no trustworthy public jobs surface, no visible first-party careers/jobs handoff, and no visible public ATS board.',
  modulePath: path.join(currentDir, 'script.js'),
}

export default ACCEDERE_CATALOG
