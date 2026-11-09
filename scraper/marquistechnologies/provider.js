import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const provider = {
  source: 'marquistechnologies',
  companyName: 'Marquis Technologies',
  officialBrandName: 'Marquistech',
  adapter: 'script',
  homepageUrl: 'https://www.marquistech.com/',
  companyCareerPage: 'https://www.marquistech.com/job-openings/',
  atsPlatform: 'official-homepage-plus-compromised-careers-route',
  countryFilter: 'India',
  paginationStrategy: 'homepage-plus-compromised-careers-route-validation',
  extractionStrategy:
    'verified-homepage+verified-compromised-job-openings-route+fail-closed-sentinel',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  companyDomain: 'marquistech.com',
  verifiedOn: '2026-07-18',
  verifiedSurfaceSummary:
    'Verified on Saturday, July 18, 2026 that https://www.marquistech.com/ still rendered the legitimate Marquistech telecom-testing homepage, while the public jobs route at https://www.marquistech.com/job-openings/ served compromised gambling-spam content branded with NABUNG77 and BADAK178 markers instead of trustworthy career listings. Because the exact-name careers surface is currently untrustworthy, this provider remains fail-closed.',
  modulePath: path.resolve(currentDir, 'script.js'),
  dryRunFile: path.resolve(currentDir, 'jobs.json'),
}

export default provider
