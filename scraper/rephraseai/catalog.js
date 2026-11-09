import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const VERIFIED_SURFACE_SUMMARY =
  'Verified on Thursday, August 13, 2026 that https://www.rephraseai.com/ and the common first-party routes https://www.rephraseai.com/about, https://www.rephraseai.com/careers, and https://www.rephraseai.com/jobs all returned the same HTTP 429 Vercel Security Checkpoint interstitial from this environment instead of a fetchable public careers surface. Because the current first-party site is checkpointed across those routes and exposes no trustworthy public jobs inventory, this provider remains a fail-closed sentinel that returns an empty array until an official public hiring surface can be re-verified.'

export const REPHRASE_AI_CATALOG = {
  source: 'rephraseai',
  companyName: 'Rephrase.ai',
  officialBrandName: 'Rephrase AI',
  adapter: 'script',
  modulePath: path.resolve(currentDir, 'script.js'),
  dryRunFile: 'rephraseai/jobs.json',
  officialHomepageUrl: 'https://www.rephraseai.com/',
  aboutPageUrl: 'https://www.rephraseai.com/about',
  companyCareerPage: 'https://www.rephraseai.com/careers',
  jobsPageUrl: 'https://www.rephraseai.com/jobs',
  companyDomain: 'rephraseai.com',
  atsPlatform: 'official-company-site-blocked-by-vercel-security-checkpoint',
  countryFilter: 'India',
  paginationStrategy: 'sitewide-vercel-security-checkpoint-on-homepage-and-common-careers-routes',
  extractionStrategy:
    'verified-homepage-vercel-checkpoint+verified-about-careers-jobs-vercel-checkpoints+return-empty',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-08-13',
  verifiedSurfaceSummary: VERIFIED_SURFACE_SUMMARY,
}

export default REPHRASE_AI_CATALOG
