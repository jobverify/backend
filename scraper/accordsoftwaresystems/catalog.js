import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const ACCORD_SOFTWARE_AND_SYSTEMS_CATALOG = {
  source: 'accordsoftwaresystems',
  companyName: 'Accord Software & Systems',
  officialBrandName: 'Accord Software & Systems',
  adapter: 'script',
  homepageUrl: 'https://www.accord-soft.com/',
  companyCareerPage: 'https://www.accord-soft.com/career.php',
  applyFormUrl: 'https://www.accord-soft.com/career-form.php',
  atsPlatform: 'official-company-careers',
  countryFilter: 'India',
  paginationStrategy: 'single-first-party-careers-page',
  extractionStrategy:
    'verified-first-party-careers-page+shared-first-party-apply-form',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  companyDomain: 'accord-soft.com',
  verifiedOn: '2026-09-03',
  verifiedSurfaceSummary:
    'Verified on Thursday, September 3, 2026 that https://www.accord-soft.com/career.php is the live first-party Accord Software & Systems careers page, that it publicly lists current Bangalore roles including Embedded Software Engineer, Team Lead- Accounts Payable & Payroll, Purchase Executive, Systems Engineer FPGA, and Desktop Support Engineer, and that every opening hands applicants to the shared first-party apply form at https://www.accord-soft.com/career-form.php.',
  modulePath: path.resolve(currentDir, 'script.js'),
  dryRunFile: 'accordsoftwaresystems/jobs.json',
}

export default ACCORD_SOFTWARE_AND_SYSTEMS_CATALOG
