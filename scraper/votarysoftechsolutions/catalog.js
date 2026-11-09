import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const VOTARY_SOFTECH_SOLUTIONS_CATALOG = {
  source: 'votarysoftechsolutions',
  companyName: 'Votary Softech Solutions',
  officialBrandName: 'Votary Tech',
  adapter: 'script',
  homepageUrl: 'https://www.votarytech.com/',
  companyCareerPage: 'https://www.votarytech.com/careers/',
  companyDomain: 'votarytech.com',
  atsPlatform: 'official-company-careers',
  countryFilter: 'India',
  paginationStrategy: 'single-careers-page-faq-job-accordion',
  extractionStrategy:
    'verified-first-party-careers-page+embedded-faq-jsonld+same-page-job-details+popup-apply-handoff',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-18',
  verifiedSurfaceSummary:
    'Verified on Saturday, July 18, 2026 that https://www.votarytech.com/careers/ is the live first-party Votary Tech careers page. The page still publishes same-page engineering openings such as "Software Engineer / WLAN Testing" and exposes role details through embedded FAQPage JSON-LD plus first-party apply popup handoffs on the careers page itself.',
  modulePath: path.resolve(currentDir, 'script.js'),
  dryRunFile: 'votarysoftechsolutions/jobs.json',
}

export default VOTARY_SOFTECH_SOLUTIONS_CATALOG
