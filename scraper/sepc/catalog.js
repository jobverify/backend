import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SEPC_CATALOG = {
  source: 'sepc',
  companyName: 'SEPC',
  officialBrandName: 'SEPC Limited',
  adapter: 'script',
  homepageUrl: 'https://www.sepc.in/',
  companyCareerPage: 'https://www.sepc.in/careers.aspx',
  companyDomain: 'sepc.in',
  atsPlatform: 'official-company-site-no-public-careers',
  countryFilter: 'India',
  paginationStrategy: 'verified-empty-current-openings-page',
  extractionStrategy: 'verified-current-openings-shell+empty-fypdf-list-return-empty',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-17',
  verifiedSurfaceSummary:
    'Verified on Friday, July 17, 2026 that https://www.sepc.in/careers.aspx is the live official SEPC careers page, that it still renders the CURRENT OPENINGS heading under the first-party title Shriram EPC | Careers, and that the openings container remains an empty <ul class="FYpdf"></ul> with no public role entries, ATS handoff, or JobPosting markup. No trustworthy public jobs surface was verifiable for SEPC on the official first-party domain.',
  dryRunFile: 'sepc/jobs.json',
  modulePath: path.resolve(currentDir, 'script.js'),
}

export default SEPC_CATALOG
