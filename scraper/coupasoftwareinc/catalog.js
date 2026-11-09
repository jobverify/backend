import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const COUPA_SOFTWARE_INC_CATALOG = {
  source: 'coupasoftwareinc',
  companyName: 'Coupa Software Inc',
  officialBrandName: 'Coupa',
  adapter: 'script',
  companyCareerPage: 'https://careers.coupa.com/en/jobs/',
  jobsPageUrl: 'https://careers.coupa.com/en/jobs/',
  companyDomain: 'careers.coupa.com',
  atsPlatform: 'coupa-careers-site',
  countryFilter: 'India',
  paginationStrategy: 'first-party-html-pagination',
  extractionStrategy: 'verified-cloudflare-challenge-empty+preserve-first-party-html-job-card-parser',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-08-14',
  verifiedSurfaceSummary:
    'Verified on Friday, August 14, 2026 that https://careers.coupa.com/en/jobs/ currently returns a Cloudflare "Just a moment..." challenge with HTTP 403, cf-mitigated=challenge, and the visible "Enable JavaScript and cookies to continue" blocker instead of the previously public Coupa jobs listings page. This provider preserves the verified first-party route and returns an honest empty result while that blocked contract remains in place.',
  modulePath: path.resolve(currentDir, 'script.js'),
  dryRunFile: 'coupasoftwareinc/jobs.json',
}

export default COUPA_SOFTWARE_INC_CATALOG
