import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const QUALE_INFOTECH_CATALOG = {
  source: 'qualeinfotech',
  companyName: 'Quale Infotech',
  officialBrandName: 'Quale Infotech',
  adapter: 'script',
  homepageUrl: 'https://qualeinfotech.com/',
  companyCareerPage: 'https://qualeinfotech.com/',
  aboutPageUrl: 'https://qualeinfotech.com/about-us/',
  contactPageUrl: 'https://qualeinfotech.com/contact-us/',
  companyDomain: 'qualeinfotech.com',
  atsPlatform: 'first-party-homepage-without-public-careers-surface',
  countryFilter: 'India',
  paginationStrategy: 'homepage-plus-about-plus-contact-validation',
  extractionStrategy:
    'verified-first-party-homepage+about+contact-without-public-careers-or-jobs+fail-closed-sentinel',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-08-04',
  verifiedSurfaceSummary:
    'Verified on Tuesday, August 4, 2026 that https://qualeinfotech.com/ remained the live exact-name Quale Infotech homepage with Generative AI marketing copy and India office contact details, while https://qualeinfotech.com/about-us/ and https://qualeinfotech.com/contact-us/ exposed only company profile and contact-form content. The common public careers routes /careers, /jobs, and /join-us returned first-party 404 pages, so no public careers or jobs page was exposed on the verified first-party surfaces.',
  modulePath: path.join(currentDir, 'script.js'),
  dryRunFile: 'qualeinfotech/jobs.json',
}

export default QUALE_INFOTECH_CATALOG
