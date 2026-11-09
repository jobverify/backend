import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const CAMBRIDGE_TECHNOLOGY_ENTERPRISES_CATALOG = {
  source: 'cambridgetechnologyenterprises',
  companyName: 'Cambridge Technology Enterprises',
  officialBrandName: 'Cambridge Technology',
  adapter: 'script',
  homepageUrl: 'https://www.ctepl.com/',
  companyCareerPage: 'https://www.ctepl.com/careers/',
  officialCareersLandingUrl: 'https://www.ctepl.com/careers/',
  officialJobsBoardUrl: 'https://cambridgetechnology.freshteam.com/jobs',
  detailUrlPattern: 'https://cambridgetechnology.freshteam.com/jobs/{opaque_id}/{slug}',
  atsPlatform: 'freshteam',
  countryFilter: 'India',
  paginationStrategy: 'official-homepage-plus-first-party-careers-landing-plus-public-freshteam-board',
  extractionStrategy: 'verified-homepage+verified-first-party-careers-landing+public-freshteam-board-or-zero-state+detail-page-apply-surface',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  companyDomain: 'ctepl.com',
  verifiedOn: '2026-10-20',
  verifiedPublicJobCount: 15,
  verifiedIndiaJobCount: 15,
  verifiedInventoryStatus: 'complete-inventory',
  bindingEvidence: {
    verified: true,
    checkedAt: '2026-10-20T17:34:11.504Z',
    officialURL: 'https://www.ctepl.com/careers/',
    httpStatus: 200,
    matchedLinks: ['https://cambridgetechnology.freshteam.com/jobs'],
    bindingMethod: 'official-company-careers-link',
    evidenceOrigin: 'browser-public-http-capture',
  },
  verifiedSurfaceSummary:
    'On October 20, 2026, captured HTTP 200 responses from https://www.ctepl.com/, its official https://www.ctepl.com/careers/ handoff, and https://cambridgetechnology.freshteam.com/jobs with all 15 role details. The native parser reconciled the complete reported inventory and extracted 15 eligible India roles. Captures and hash-linked extraction evidence are under artifacts/full-catalog; saved jobs and public visibility remain unknown while the production database is unavailable. These verification notes do not replace fresh inventory evidence on future runs.',
  modulePath: path.resolve(currentDir, 'script.js'),
  dryRunFile: 'cambridgetechnologyenterprises/jobs.json',
}

export default CAMBRIDGE_TECHNOLOGY_ENTERPRISES_CATALOG
