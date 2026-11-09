import path from 'node:path'
import {fileURLToPath} from 'node:url'
const currentDir=path.dirname(fileURLToPath(import.meta.url))
export const SLICE_CATALOG={
  source:'slice',companyName:'Slice',officialBrandName:'Slice',adapter:'script',
  companyCareerPage:'https://slice.bank.in/careers/',officialBankOpenPositionsUrl:'https://slice.bank.in/careers/open-positions',
  publicBoardUrl:'https://careers.kula.ai/slice?jobs=true',jobsApiUrl:'https://careers.kula.ai/api/internal/ats_job_posts',
  bankCompanyLegalName:'slice small finance bank ltd',companyDomain:'slice.bank.in',atsPlatform:'kula-public-api',countryFilter:'India',
  paginationStrategy:'native-api-99-item-pages-with-reported-count-and-page-completeness',
  extractionStrategy:'verified-bank-kula-handoff+native-public-jobs+full-descriptions+explicit-india-office-filter',
  parser:'custom-script',normalizationProfile:'engineering-default',verifiedOn:'2026-10-03',verifiedPublicJobCount:40,verifiedIndiaJobCount:40,
  verifiedSurfaceSummary:'Verified on 2026-10-03: slice small finance bank ltd official careers/open-positions page publishes the exact careers.kula.ai/slice handoff. Kula Organization JSON-LD points to slice.bank.in. The published client GET /api/internal/ats_job_posts with accountName=slice, type=ats_job_post.index, items=99 returns 40 jobs, count 40, page 1, pages 1; all 40 visible IDs/apply URLs and India office records match. API descriptions match sample first/last official JobPosting descriptions exactly. Unrelated pizza-company careers are excluded.',
  modulePath:path.join(currentDir,'script.js'),dryRunFile:path.join(currentDir,'jobs.json'),
}
export default SLICE_CATALOG
