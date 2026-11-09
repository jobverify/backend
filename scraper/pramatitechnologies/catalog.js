import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PRAMATI_TECHNOLOGIES_CATALOG = {
  source: 'pramatitechnologies',
  companyName: 'Pramati Technologies',
  officialBrandName: 'Pramati',
  adapter: 'script',
  homepageUrl: 'https://pramati.com/',
  companyCareerPage: 'https://pramati.com/careers/',
  linkedCareersBoardUrl: 'https://recruitcareers.zappyhire.com/pramati',
  companyDomain: 'pramati.com',
  atsPlatform: 'first-party-homepage-plus-opaque-linked-zappyhire-board',
  countryFilter: 'India',
  paginationStrategy: 'homepage-link-plus-missing-careers-route-plus-opaque-zappyhire-shell',
  extractionStrategy:
    'verified-homepage-careers-link+verified-404-careers-route+verified-opaque-zappyhire-shell+fail-closed-sentinel',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-08-04',
  verifiedSurfaceSummary:
    'Verified on Tuesday, August 4, 2026 that https://pramati.com/ remained the exact-name first-party homepage, that it still linked the careers handoff https://recruitcareers.zappyhire.com/pramati while the exact-name route https://pramati.com/careers/ returned a Page not found response, and that the linked Zappyhire destination stayed an opaque careers shell without server-rendered public job cards, so this provider remains fail-closed until a trustworthy public Pramati listings contract is confirmed.',
  modulePath: path.join(currentDir, 'script.js'),
  dryRunFile: 'pramatitechnologies/jobs.json',
}

export default PRAMATI_TECHNOLOGIES_CATALOG
