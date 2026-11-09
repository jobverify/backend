import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const VERIFIED_SURFACE_SUMMARY =
  'Verified on Thursday, August 13, 2026 that https://www.biocon.com/ is the live official homepage, that https://www.biocon.com/careers/ is the first-party careers landing page, and that its Now Hiring link hands off to the public SAP SuccessFactors board at https://career10.successfactors.com/career?company=bioconlimi. The public search surface at https://career10.successfactors.com/career?company=bioconlimi&career_ns=job_listing_summary&navBarLevel=JOB_SEARCH& now boots through the public SuccessFactors DWR contract and returned 39 India postings, including ASSISTANT MANAGER and SENIOR MANAGER. A live sample detail page was verified at https://career10.successfactors.com/career?career_ns=job_listing&company=bioconlimi&navBarLevel=JOB_SEARCH&rcm_site_locale=en_US&career_job_req_id=20915&selected_lang=en_US&jobAlertController_jobAlertId=&jobAlertController_jobAlertName=&browserTimeZone=Asia/Calcutta for ASSISTANT MANAGER.'

export const BIOCON_CATALOG = {
  source: 'biocon',
  companyName: 'Biocon',
  officialBrandName: 'Biocon Limited',
  adapter: 'script',
  modulePath: path.join(currentDir, 'script.js'),
  dryRunFile: 'biocon/jobs.json',
  homepageUrl: 'https://www.biocon.com/',
  companyCareerPage: 'https://www.biocon.com/careers/',
  successFactorsCompanyToken: 'bioconlimi',
  successFactorsBoardUrl: 'https://career10.successfactors.com/career?company=bioconlimi',
  successFactorsSearchUrl:
    'https://career10.successfactors.com/career?company=bioconlimi&career_ns=job_listing_summary&navBarLevel=JOB_SEARCH&',
  verifiedSampleJobUrl:
    'https://career10.successfactors.com/career?career_ns=job_listing&company=bioconlimi&navBarLevel=JOB_SEARCH&rcm_site_locale=en_US&career_job_req_id=20915&selected_lang=en_US&jobAlertController_jobAlertId=&jobAlertController_jobAlertName=&browserTimeZone=Asia/Calcutta',
  companyDomain: 'biocon.com',
  atsPlatform: 'successfactors',
  countryFilter: 'India',
  paginationStrategy: 'successfactors-dwr-initial-search',
  extractionStrategy:
    'verified-first-party-biocon-careers-page+successfactors-bootstrap+dwr-search-results+detail-pages',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-08-13',
  verifiedSurfaceSummary: VERIFIED_SURFACE_SUMMARY,
}

export default BIOCON_CATALOG
