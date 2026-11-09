import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const provider = {
  source: 'ustblueconchtechnologies',
  companyName: 'UST BlueConch Technologies',
  officialBrandName: 'UST BlueConch',
  adapter: 'script',
  modulePath: path.join(currentDir, 'script.js'),
  companyCareerPage: 'https://www.ust.com/en/careers',
  blueconchReferenceUrl:
    'https://www.ust.com/en/who-we-are/ust-newsroom/ust-blueconch-wins-excellence-award-for-best-security-practices-in-it-ites-sector',
  companyDomain: 'ust.com',
  atsPlatform: 'cloudflare-blocked-parent-company-pages',
  countryFilter: 'India',
  paginationStrategy: 'blueconch-reference-plus-parent-careers-cloudflare-block-validation',
  extractionStrategy:
    'verified-ust-blueconch-reference-route+verified-parent-careers-route+cloudflare-blocked-no-blueconch-public-jobs-return-empty',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  dryRunFile: 'ustblueconchtechnologies/jobs.json',
  verifiedOn: '2026-08-04',
  verifiedSurfaceSummary:
    'Verified on Tuesday, August 4, 2026 that both the UST BlueConch reference route and the parent UST careers page on ust.com now resolve to the same Cloudflare block surface, and that no BlueConch-specific public jobs inventory can be trusted from that blocked state. This local contract returns [] and fails closed if a real BlueConch-specific public jobs surface appears later.',
}

export default provider
