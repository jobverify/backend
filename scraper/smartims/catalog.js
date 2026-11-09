import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SMART_IMS_CATALOG = {
  source: 'smartims',
  companyName: 'Smart IMS',
  officialBrandName: 'Smart IMS',
  adapter: 'script',
  modulePath: path.resolve(currentDir, 'script.js'),
  companyCareerPage: 'https://www.smartims.com/careers/',
  companyDomain: 'smartims.com',
  atsPlatform: 'first-party-careers-page-with-current-openings',
  countryFilter: 'India',
  paginationStrategy: 'single-first-party-current-openings-accordion',
  extractionStrategy:
    'first-party-accordion-openings+cloudflare-email-decode+structured-field-extraction',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-08-04',
  verifiedSurfaceSummary:
    'Verified on Tuesday, August 4, 2026 that https://www.smartims.com/careers/ is Smart IMS\'s live first-party careers page and that the public HTML exposes a Current Job Openings accordion with three Hyderabad listings and Cloudflare-protected apply-by-email links that decode to Indiacareers@SmartIMS.com, including Data Engineer II, Java Backend Software Development Engineer (SDE-2), and Front End Developer.',
}

export default SMART_IMS_CATALOG
