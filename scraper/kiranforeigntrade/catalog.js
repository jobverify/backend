import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const KIRAN_FOREIGN_TRADE_CATALOG = {
  source: 'kiranforeigntrade',
  companyName: 'Kiran Foreign Trade',
  officialBrandName: 'KFT',
  adapter: 'script',
  homepageUrl: 'https://kft.co.in/',
  companyCareerPage: 'https://kft.co.in/software/',
  companyDomain: 'kft.co.in',
  atsPlatform: 'official-first-party-application-form',
  countryFilter: 'India',
  paginationStrategy: 'single-first-party-application-form',
  extractionStrategy: 'verified-first-party-position-dropdown+shared-apply-form',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-18',
  verifiedSurfaceSummary:
    'Verified on Saturday, July 18, 2026 that https://kft.co.in/software/ is the live first-party KFT jobs/contact surface, that it publishes the "Apply For Jobs" modal with "Taking your career to the next level", and that the verified position dropdown exposes PHP Developer, Web Designer, Sharepoint Developer, Ios Developer, Android Developer, SEO Executive, and Software Tester for the Mohali office.',
  dryRunFile: 'kiranforeigntrade/jobs.json',
  modulePath: path.resolve(currentDir, 'script.js'),
}

export default KIRAN_FOREIGN_TRADE_CATALOG
