import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const VERIFIED_SURFACE_SUMMARY =
  'Verified on July 16, 2026 that https://www.indusind.bank.in/ is the live official IndusInd Bank homepage, that its Careers link points to the public Workline landing page at https://app1100.workline.hr/careers/, and that the public jobs board shell lives at https://app1100.workline.hr/Cportal/GeneralOpening.aspx. Verified the public Workline listings API at https://app1100.workline.hr/rec/TAServices.asmx/GetCurrentopening returned 11 live job records after the normal board-page session handshake, and verified the public detail route pattern on https://app1100.workline.hr/CandidatePortal/1f788ee8-158a-43ce-bab2-839248e14729/HR-Analyst-Job-in-One-World-Centre-9th-Floor-Office-86797.'

export const INDUSIND_BANK_CATALOG = {
  source: 'indusindbank',
  companyName: 'IndusInd Bank',
  officialBrandName: 'IndusInd Bank',
  adapter: 'script',
  companyCareerPage: 'https://app1100.workline.hr/careers/',
  homepageUrl: 'https://www.indusind.bank.in/',
  jobsBoardUrl: 'https://app1100.workline.hr/Cportal/GeneralOpening.aspx',
  jobsApiUrl: 'https://app1100.workline.hr/rec/TAServices.asmx/GetCurrentopening',
  sampleDetailUrl:
    'https://app1100.workline.hr/CandidatePortal/1f788ee8-158a-43ce-bab2-839248e14729/HR-Analyst-Job-in-One-World-Centre-9th-Floor-Office-86797',
  companyDomain: 'indusind.bank.in',
  atsPlatform: 'workline-public-jobs-api',
  countryFilter: 'India',
  paginationStrategy: 'verified-homepage-handoff-plus-single-workline-current-opening-api',
  extractionStrategy:
    'verified-homepage+verified-workline-careers-landing+workline-board-page+currentopening-json-api+public-detail-pages',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-16',
  verifiedSurfaceSummary: VERIFIED_SURFACE_SUMMARY,
  dryRunFile: 'indusindbank/jobs.json',
  modulePath: path.resolve(currentDir, 'script.js'),
}

export default INDUSIND_BANK_CATALOG
