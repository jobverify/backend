import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const FCI_CCM_CATALOG = {
  source: 'fciccm',
  companyName: 'FCI CCM',
  officialBrandName: 'Friends Color Images Pvt Ltd',
  adapter: 'script',
  homepageUrl: 'https://www.fci-ccm.com/',
  companyCareerPage: 'https://www.fci-ccm.com/company/careers.php',
  officialZohoBoardUrl: 'https://fci-ccm.zohorecruit.in/jobs/Careers',
  companyDomain: 'fci-ccm.com',
  atsPlatform: 'zoho-recruit-careers-site',
  countryFilter: 'India',
  paginationStrategy: 'first-party-careers-handoff-plus-single-zoho-hidden-input-payload',
  extractionStrategy: 'verified-first-party-careers-page+official-zoho-careers-hidden-input-jobs-payload',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-18',
  verifiedPublicJobCount: 11,
  verifiedSurfaceSummary:
    'Verified on Saturday, July 18, 2026 that https://www.fci-ccm.com/company/careers.php remained the first-party FCI CCM careers page, that it linked candidates to the official public Zoho board at https://fci-ccm.zohorecruit.in/jobs/Careers, and that the live hidden-input payload exposed 11 published public openings including Team Lead/ Assistant manager- talent Aqusition in Noida, India.',
  modulePath: path.join(currentDir, 'script.js'),
}

export default FCI_CCM_CATALOG
