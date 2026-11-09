import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const CODE_BREW_LABS_CATALOG = {
  source: 'codebrewlabs',
  companyName: 'Code Brew Labs',
  officialBrandName: 'Code Brew Labs',
  adapter: 'script',
  homepageUrl: 'https://www.code-brew.com/',
  companyCareerPage: 'https://www.code-brew.com/careers/',
  atsPlatform: 'official-first-party-role-sections',
  countryFilter: 'India',
  paginationStrategy: 'single-page',
  extractionStrategy: 'same-page-role-sections',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  companyDomain: 'code-brew.com',
  verifiedOn: '2026-07-18',
  verifiedSurfaceSummary:
    'Verified on Saturday, July 18, 2026 that https://www.code-brew.com/careers/ is the live first-party Code Brew Labs careers page and that it publicly exposes same-page role sections including Nodejs Developer Lead, Angular Developer Lead, and Business Development Manager, each listed for Chandigarh on the same first-party surface.',
  modulePath: path.resolve(currentDir, 'script.js'),
}

export default CODE_BREW_LABS_CATALOG
