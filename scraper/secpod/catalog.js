import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SECPOD_CATALOG = {
  source: 'secpod',
  companyName: 'SecPod',
  officialBrandName: 'SecPod',
  adapter: 'script',
  homepageUrl: 'https://www.secpod.com/',
  companyCareerPage: 'https://www.secpod.com/careers',
  companyDomain: 'secpod.com',
  atsPlatform: 'first-party-declared-keka',
  countryFilter: 'India',
  paginationStrategy: 'current-declared-careers-client-and-keka-active-array',
  extractionStrategy:
    'verified-corporate-client-declaration+keka-renderer+native-account+active-native-india-records',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-11-20',
  verifiedSurfaceSummary:
    'Verified on Friday, November 20, 2026 that https://www.secpod.com/careers renders its Current Job Openings mount and declares the current careers client containing the SecPod Keka configuration and renderer. The exact current native account and active feed advertise seven explicit India roles with authored descriptions and original publication dates. The reader validates the current declared client, native renderer, account, role identities and explicit countries. Company-wide inventory remains incomplete and lifecycle cleanup is disabled; the portal publisher is SecPod Careers, while legal employers remain unverified. The historical July 17, 2026 surface guards remain available for the earlier layout.',
  modulePath: path.resolve(currentDir, 'script.js'),
  dryRunFile: 'secpod/jobs.json',
}

export default SECPOD_CATALOG
