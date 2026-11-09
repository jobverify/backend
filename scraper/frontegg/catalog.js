import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const FRONTEGG_CATALOG = {
  source: 'frontegg',
  companyName: 'Frontegg',
  officialBrandName: 'Frontegg',
  adapter: 'script',
  homepageUrl: 'https://frontegg.com/',
  companyCareerPage: 'https://frontegg.com/careers',
  verifiedJobDetailUrl: 'https://frontegg.com/careers/co/israel/DE.45E/senior-backend-developer/all',
  companyDomain: 'frontegg.com',
  atsPlatform: 'official-company-site',
  countryFilter: 'Israel',
  paginationStrategy: 'first-party-careers-page-listing-links-plus-first-party-detail-pages',
  extractionStrategy: 'verified-careers-page+verified-current-opening-links+verified-detail-page-sections',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-15',
  verifiedSurfaceSummary:
    'Verified on July 15, 2026 that https://frontegg.com/ is the live Frontegg homepage, that the first-party careers page at https://frontegg.com/careers publicly renders "Careers at Frontegg" with a "Current openings" section, and that it links to first-party detail pages under /careers/co/.../all including the verified Senior Backend Developer opening at https://frontegg.com/careers/co/israel/DE.45E/senior-backend-developer/all. The verified careers surface currently exposes live public openings on the first-party domain, including roles listed under Israel.',
  modulePath: path.resolve(currentDir, 'script.js'),
  dryRunFile: 'frontegg/jobs.json',
}

export default FRONTEGG_CATALOG
