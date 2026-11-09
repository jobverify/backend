import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const VERIFIED_SURFACE_SUMMARY =
  'Verified on Wednesday, August 5, 2026 that https://sulavineyards.com/careers.php still presents the official first-party Careers at Sula content inside the broader Sula brand shell, including the Indian wine industry recruiting copy and a View Open Positions handoff to https://app.hrone.cloud/career-portal?appId=MHZzWpATk5uSVkWo1EwlhxzjgIG1VZ3pIZYpNVctJxMlUQo18qUoCm-17Y6BMlv4l0Cqdw6PNgHEZKAACmWo7upw3Rwo24m2v5XmXqZ2XGYc1Q2nq54JyLnImKiiIoss&dc=sula&rqt=m8jH4bpBQbccEU8MZpSP5Q&cc=eaqzS8e-weZZc3W_dw_T1Q. Verified that the public HROne handoff still only exposes a JavaScript-required shell, so there is no trustworthy public jobs surface for the exact-name Sula Vineyards row right now and this provider fails closed with an empty result.'

export const SULA_VINEYARDS_CATALOG = {
  source: 'sulavineyards',
  companyName: 'Sula Vineyards',
  officialBrandName: 'Sula Vineyards Limited',
  adapter: 'script',
  companyCareerPage: 'https://sulavineyards.com/careers.php',
  officialCareersPageUrl: 'https://sulavineyards.com/careers.php',
  officialCareersHandoffUrl:
    'https://app.hrone.cloud/career-portal?appId=MHZzWpATk5uSVkWo1EwlhxzjgIG1VZ3pIZYpNVctJxMlUQo18qUoCm-17Y6BMlv4l0Cqdw6PNgHEZKAACmWo7upw3Rwo24m2v5XmXqZ2XGYc1Q2nq54JyLnImKiiIoss&dc=sula&rqt=m8jH4bpBQbccEU8MZpSP5Q&cc=eaqzS8e-weZZc3W_dw_T1Q',
  companyDomain: 'sulavineyards.com',
  atsPlatform: 'hrone-handoff-unverifiable',
  countryFilter: 'India',
  paginationStrategy: 'official-careers-page-plus-external-hrone-handoff-no-verifiable-public-board',
  extractionStrategy: 'verified-official-careers-page+verified-hrone-handoff+fail-closed-sentinel',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-08-05',
  verifiedSurfaceSummary: VERIFIED_SURFACE_SUMMARY,
  dryRunFile: 'sulavineyards/jobs.json',
  modulePath: path.join(currentDir, 'script.js'),
}

export default SULA_VINEYARDS_CATALOG
