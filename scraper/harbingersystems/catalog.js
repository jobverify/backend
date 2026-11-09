import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const HARBINGER_SYSTEMS_CATALOG = {
  source: 'harbingersystems',
  companyName: 'Harbinger Systems',
  officialBrandName: 'Harbinger Systems',
  adapter: 'script',
  homepageUrl: 'https://www.harbingergroup.com/',
  companyCareerPage: 'https://www.harbingergroup.com/current-openings/',
  officialCareersHandoffUrl: 'https://harbingergroup.darwinbox.in/ms/candidate/careers',
  darwinboxOrigin: 'https://harbingergroup.darwinbox.in',
  darwinboxCompanyId: 'main',
  atsPlatform: 'darwinbox',
  countryFilter: 'India',
  paginationStrategy: 'page-number',
  extractionStrategy: 'browser-verified-darwinbox-api',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  companyDomain: 'harbingergroup.com',
  verifiedOn: '2026-07-17',
  verifiedSurfaceSummary:
    'Verified on Friday, July 17, 2026 that https://www.harbingergroup.com/current-openings/ was the live first-party Harbinger Systems careers page and that it handed applicants to the public Darwinbox surface at https://harbingergroup.darwinbox.in/ms/candidate/careers. Verified through the public Darwinbox surface that live India roles included Senior Software Engineer and Senior Software Test Engineer.',
  modulePath: path.join(currentDir, 'script.js'),
}

export default HARBINGER_SYSTEMS_CATALOG
