import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const VERIFIED_SURFACE_SUMMARY =
  'Verified on October 3, 2026 that https://www.auxilo.com/ and https://www.auxilo.com/careers remain first-party Auxilo pages. The careers page now has the title Careers at Auxilo | Join Our Education Finance Team and still links to https://app1176.workline.hr/candidate, which resolves to https://app1176.workline.hr/Cportal/GeneralOpening.aspx. The public Workline API https://app1176.workline.hr/CPortal/generalopening.aspx/GetCurrentopening returned 16 live job records; each detail and apply route was verified, including https://app1176.workline.hr/CandidatePortal/56dc33ad-1f13-475c-958d-7c7dcb92df9f/Senior-Executive---Customer-Service-Job-in-Mumbai---Corporate-Office-1-1391 and its SignInv1.aspx application handoff.'

export const AUXILO_CATALOG = {
  source: 'auxilo',
  companyName: 'Auxilo',
  officialBrandName: 'Auxilo Finserve',
  adapter: 'script',
  modulePath: path.resolve(currentDir, 'script.js'),
  dryRunFile: 'auxilo/jobs.json',
  companyCareerPage: 'https://www.auxilo.com/careers',
  homepageUrl: 'https://www.auxilo.com/',
  jobsBoardEntryUrl: 'https://app1176.workline.hr/candidate',
  jobsBoardUrl: 'https://app1176.workline.hr/Cportal/GeneralOpening.aspx',
  jobsApiUrl: 'https://app1176.workline.hr/CPortal/generalopening.aspx/GetCurrentopening',
  sampleDetailUrl:
    'https://app1176.workline.hr/CandidatePortal/56dc33ad-1f13-475c-958d-7c7dcb92df9f/Senior-Executive---Customer-Service-Job-in-Mumbai---Corporate-Office-1-1391',
  sampleApplyUrl:
    'https://app1176.workline.hr/Candidate/SignInv1.aspx?PRFCode=56dc33ad-1f13-475c-958d-7c7dcb92df9f&Flag=C&DirectApply=1',
  companyDomain: 'auxilo.com',
  atsPlatform: 'workline-public-jobs-api',
  countryFilter: 'India',
  paginationStrategy: 'verified-careers-page-handoff-plus-single-workline-current-opening-api',
  extractionStrategy:
    'verified-homepage+verified-first-party-careers-page+workline-handoff+currentopening-json-api+detail-page-apply-validation',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-10-03',
  verifiedSurfaceSummary: VERIFIED_SURFACE_SUMMARY,
}

export default AUXILO_CATALOG
