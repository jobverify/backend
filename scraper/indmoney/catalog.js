import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const VERIFIED_SURFACE_SUMMARY =
  'Verified on Thursday, August 13, 2026 that both https://www.indmoney.com/ and https://www.indmoney.com/about currently resolve to the same first-party Cloudflare challenge page titled Just a moment..., blocking public access to the historical INDmoney about-page handoff. The scraper still tolerates the previously verified about-page LinkedIn handoff when it reappears, but the currently reachable first-party surface does not expose a trustworthy first-party public jobs page.'

export const INDMONEY_CATALOG = {
  source: 'indmoney',
  companyName: 'INDmoney',
  officialBrandName: 'INDmoney',
  adapter: 'script',
  homepageUrl: 'https://www.indmoney.com/',
  companyCareerPage: 'https://www.indmoney.com/about',
  aboutPageUrl: 'https://www.indmoney.com/about',
  linkedinJobsUrl: 'https://www.linkedin.com/company/indmoney/jobs/',
  companyDomain: 'indmoney.com',
  atsPlatform: 'official-company-site-no-public-careers',
  countryFilter: 'India',
  paginationStrategy: 'verified-about-page-plus-linkedin-handoff-validation',
  extractionStrategy:
    'verified-cloudflare-challenge-on-homepage-and-about-page+legacy-official-about-page-linkedin-handoff+no-first-party-public-jobs-return-empty',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-08-13',
  verifiedSurfaceSummary: VERIFIED_SURFACE_SUMMARY,
  dryRunFile: 'indmoney/jobs.json',
  modulePath: path.resolve(currentDir, 'script.js'),
}

export default INDMONEY_CATALOG
