import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PRAMATA_KNOWLEDGE_SOLUTIONS_CATALOG = {
  source: 'pramataknowledgesolutions',
  companyName: 'Pramata Knowledge Solutions',
  officialBrandName: 'Pramata',
  adapter: 'script',
  companyCareerPage: 'https://www.pramata.com/careers/',
  sampleRoleUrl: 'https://www.pramata.com/careers/legal-solution-consultant/',
  contactEmail: 'hr-usa@pramata.com',
  atsPlatform: 'first-party-careers-page-bot-gated',
  countryFilter: 'India',
  paginationStrategy: 'verified-blocked-careers-routes',
  extractionStrategy: 'verified-cloudflare-403-careers-routes-return-empty',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  companyDomain: 'pramata.com',
  verifiedOn: '2026-08-14',
  verifiedSurfaceSummary:
    'Verified on Friday, August 14, 2026 that both https://www.pramata.com/careers/ and the sample role route https://www.pramata.com/careers/legal-solution-consultant/ returned the same Cloudflare HTTP 403 "Just a moment..." interstitial with the ki-cf-botcl=1 refresh pattern instead of scraper-visible listings. This local provider remains intentionally fail-closed and returns an honest empty list until the official careers surfaces become scraper-accessible again.',
  dryRunFile: 'pramataknowledgesolutions/jobs.json',
  modulePath: path.resolve(currentDir, 'script.js'),
}

export default PRAMATA_KNOWLEDGE_SOLUTIONS_CATALOG
