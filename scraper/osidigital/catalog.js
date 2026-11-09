import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const OSI_DIGITAL_CATALOG = {
  source: 'osidigital',
  companyName: 'OSI Digital',
  officialBrandName: 'OSI Digital',
  adapter: 'script',
  companyCareerPage: 'https://osidigital.com/careers/',
  companyDomain: 'osidigital.com',
  jobOpeningsUrl: 'https://osidigital.com/careers/job_openings/',
  jobBoardApiUrl: 'https://api.turbohire.co/api/careerpagejobs',
  publicApplyHost: 'https://osidigital.turbohire.co',
  atsPlatform: 'official-careers-page-plus-turbohire-publicjobs',
  countryFilter: 'India',
  paginationStrategy: 'official-careers-page-plus-embedded-turbohire-api',
  extractionStrategy:
    'verified-first-party-careers-page+verified-job-openings-page+embedded-turbohire-api+public-job-feed',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-08-03',
  verifiedPublicPostingCount: 23,
  verifiedSurfaceSummary:
    'Verified on Monday, August 3, 2026 that https://osidigital.com/careers/ remained the live first-party OSI Digital careers page, that its APPLY TODAY handoff points to https://osidigital.com/careers/job_openings/, and that the first-party job openings page embeds the public TurboHire endpoint https://api.turbohire.co/api/careerpagejobs with OSI-branded apply links under https://osidigital.turbohire.co/job/publicjobs/ . Live verification on Monday, August 3, 2026 confirmed 23 public jobs in that feed.',
  modulePath: path.resolve(currentDir, 'script.js'),
  dryRunFile: 'osidigital/jobs.json',
}

export default OSI_DIGITAL_CATALOG
