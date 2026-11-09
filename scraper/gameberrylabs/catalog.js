import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const GAMEBERRY_LABS_CATALOG = {
  source: 'gameberrylabs',
  companyName: 'Gameberry Labs',
  officialBrandName: 'Gameberry Labs',
  adapter: 'script',
  homepageUrl: 'https://gameberrylabs.com/',
  companyCareerPage: 'https://gameberrylabs.com/jobs',
  externalHandoffUrl: 'https://gameberry.keka.com/careers',
  companyDomain: 'gameberrylabs.com',
  atsPlatform: 'official-company-careers',
  countryFilter: 'India',
  paginationStrategy: 'single-first-party-homepage-with-external-keka-handoff',
  extractionStrategy:
    'verified-first-party-homepage+verified-jobs-redirect+external-keka-handoff-no-verifiable-public-job-records',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-15',
  verifiedSurfaceSummary:
    'Verified on July 15, 2026 that https://gameberrylabs.com/ is the live official Gameberry Labs homepage, that its Careers / Join Us handoff points to the first-party route https://gameberrylabs.com/jobs, and that browser-backed verification of https://gameberrylabs.com/jobs redirects to https://gameberry.keka.com/careers. Direct probe verification on the verified date confirmed gameberry.keka.com publicly resolves, but HTTPS connections to https://gameberry.keka.com/careers timed out during direct probe and no trustworthy public job records or stable public Keka jobs contract could be verified. There is no trustworthy public jobs surface for Gameberry Labs on the verified date.',
  dryRunFile: 'gameberrylabs/jobs.json',
  modulePath: path.resolve(currentDir, 'script.js'),
}

export default GAMEBERRY_LABS_CATALOG
