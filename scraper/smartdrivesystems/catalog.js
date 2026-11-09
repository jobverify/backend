import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SMART_DRIVE_SYSTEMS_CATALOG = {
  source: 'smartdrivesystems',
  companyName: 'Smart Drive Systems',
  officialBrandName: 'SmartDrive Systems',
  adapter: 'script',
  companyCareerPage: 'https://www.smartdrive.net/careers/',
  officialCareersPageUrl: 'https://www.smartdrive.net/careers/',
  companyDomain: 'smartdrive.net',
  atsPlatform: 'official-company-site-no-trustworthy-public-board',
  countryFilter: 'India',
  paginationStrategy: 'legacy-careers-shell-without-public-job-links',
  extractionStrategy: 'verified-first-party-careers-shell+fail-closed-sentinel',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-18',
  verifiedSurfaceSummary:
    'Verified on Saturday, July 18, 2026 that https://www.smartdrive.net/careers/ was the live first-party SmartDrive careers shell, that it exposed a VIEW ALL OPEN POSITIONS shell, and that there was no trustworthy public jobs surface on the verified date.',
  dryRunFile: 'smartdrivesystems/jobs.json',
  modulePath: path.join(currentDir, 'script.js'),
}

export default SMART_DRIVE_SYSTEMS_CATALOG
