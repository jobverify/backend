import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const VERIFIED_SURFACE_SUMMARY =
  'Verified on Friday, July 17, 2026 that https://www.smallcase.com/about is the live official smallcase About page, that it invites candidates to View Open Positions through https://app.pyjamahr.com/careers?company=smallcase&company_uuid=2615584222, and that a public PyjamaHR detail route still exists at https://jobs.pyjamahr.com/smallcase/software-engineer-level-ii-backend-development. There is no trustworthy public jobs surface for the exact-name Smallcase row right now because the live PyjamaHR handoff state was not enumerable into a trustworthy current public jobs board from browser probes on the verified date, so this provider fails closed and returns no jobs until smallcase exposes a stable verifiable public listings contract again.'

export const SMALLCASE_CATALOG = {
  source: 'smallcase',
  companyName: 'Smallcase',
  officialBrandName: 'smallcase',
  adapter: 'script',
  companyCareerPage: 'https://www.smallcase.com/about',
  officialCareersPageUrl: 'https://www.smallcase.com/about',
  officialCareersHandoffUrl:
    'https://app.pyjamahr.com/careers?company=smallcase&company_uuid=2615584222',
  verifiedSampleJobUrl:
    'https://jobs.pyjamahr.com/smallcase/software-engineer-level-ii-backend-development',
  companyDomain: 'smallcase.com',
  atsPlatform: 'pyjamahr-handoff-unverifiable',
  countryFilter: 'India',
  paginationStrategy: 'official-about-page-plus-external-pyjamahr-handoff-no-verifiable-current-public-board',
  extractionStrategy:
    'verified-first-party-about-page+verified-pyjamahr-handoff+historical-public-jobdetail+fail-closed-sentinel',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-17',
  verifiedSurfaceSummary: VERIFIED_SURFACE_SUMMARY,
  dryRunFile: 'smallcase/jobs.json',
  modulePath: path.join(currentDir, 'script.js'),
}

export default SMALLCASE_CATALOG
