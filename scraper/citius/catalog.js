import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const VERIFIED_SURFACE_SUMMARY =
  'Verified on July 15, 2026 that https://www.citiustech.com/ is the live first-party homepage for the backlog company name Citius, that https://www.citiustech.com/careers is the live first-party careers page, and that its Open Roles CTA hands off to the public RippleHire board at https://citiustech.ripplehire.com/candidate/?token=bCKlfz3OO8vQIgiM2vuI&source=CAREERSITE#list. Verified that the public board shell is live at https://citiustech.ripplehire.com/candidate/?token=bCKlfz3OO8vQIgiM2vuI&source=CAREERSITE and that the RippleHire jobs API at https://citiustech.ripplehire.com/candidate/candidatejobsearch returned 73 live listings on July 15, 2026.'

export const CITIUS_CATALOG = {
  source: 'citius',
  companyName: 'Citius',
  officialBrandName: 'CitiusTech',
  adapter: 'script',
  companyCareerPage: 'https://www.citiustech.com/careers',
  homepageUrl: 'https://www.citiustech.com/',
  portalOrigin: 'https://citiustech.ripplehire.com',
  officialCareersHandoffUrl:
    'https://citiustech.ripplehire.com/candidate/?token=bCKlfz3OO8vQIgiM2vuI&source=CAREERSITE#list',
  jobBoardUrl:
    'https://citiustech.ripplehire.com/candidate/?token=bCKlfz3OO8vQIgiM2vuI&source=CAREERSITE',
  jobsApiUrl: 'https://citiustech.ripplehire.com/candidate/candidatejobsearch',
  atsPlatform: 'ripplehire',
  countryFilter: 'India',
  paginationStrategy: 'page-param-on-public-ripplehire-board',
  extractionStrategy: 'official-careers-handoff+ripplehire-list-detail-api',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  companyDomain: 'citiustech.com',
  verifiedOn: '2026-07-15',
  verifiedSurfaceSummary: VERIFIED_SURFACE_SUMMARY,
  modulePath: path.join(currentDir, 'script.js'),
}

export default CITIUS_CATALOG
