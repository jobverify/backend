import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const FEDORA_SOLUTIONS_CATALOG = {
  source: 'fedorasolutions',
  companyName: 'Fedora Solutions',
  officialBrandName: 'Fedora Healthcare Solutions',
  adapter: 'script',
  companyCareerPage: 'https://www.ifedora.com/careers/',
  officialCareersPageUrl: 'https://www.ifedora.com/careers/',
  companyDomain: 'ifedora.com',
  contactPageUrl: 'https://www.ifedora.com/contact-in/',
  atsPlatform: 'official-company-site-no-public-careers',
  countryFilter: 'India',
  paginationStrategy: 'careers-plus-contact-page-validation',
  extractionStrategy: 'verified-first-party-careers-page+resume-email-only-return-empty',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-18',
  verifiedSurfaceSummary:
    'Verified on Saturday, July 18, 2026 that https://www.ifedora.com/careers/ is the live first-party Fedora Healthcare Solutions careers page for Fedora Solutions and that it currently asks candidates to email resumes to recruitment@ifedora.com. There is no trustworthy public jobs surface or structured role listing on the verified first-party page.',
  dryRunFile: 'fedorasolutions/jobs.json',
  modulePath: path.resolve(currentDir, 'script.js'),
}

export default FEDORA_SOLUTIONS_CATALOG
