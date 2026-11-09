import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const ALMONDS_AI_CATALOG = {
  source: 'almondsai',
  companyName: 'Almonds Ai',
  officialBrandName: 'Almonds Ai',
  adapter: 'script',
  modulePath: path.resolve(currentDir, 'script.js'),
  dryRunFile: 'almondsai/jobs.json',
  companyCareerPage: 'https://almondsdev.almonds.ai/career/',
  officialCareersPageUrl: 'https://almondsdev.almonds.ai/career/',
  companyDomain: 'almondsdev.almonds.ai',
  atsPlatform: 'official-company-careers',
  countryFilter: 'India',
  paginationStrategy: 'single-first-party-careers-page',
  extractionStrategy: 'verified-first-party-role-sections+mailto-apply',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-17',
  verifiedSurfaceSummary:
    'Verified on Friday, July 17, 2026 that https://almondsdev.almonds.ai/career/ is the live first-party Almonds Ai careers page and that it publicly exposes same-page role sections including Automation Tester, Business Analyst, and Tech Lead (Head of Technology), with India locations such as Gurugram and Bangalore plus Apply Now mailto handoffs to hireme@almonds.ai.',
}

export default ALMONDS_AI_CATALOG
