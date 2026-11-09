import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const INSIDEVIEW_CATALOG = {
  source: 'insideview',
  companyName: 'InsideView',
  adapter: 'script',
  companyCareerPage: 'https://www.insideview.com/',
  redirectedHomepageUrl: 'https://www.demandbase.com/',
  legacyLoginUrl: 'https://my.insideview.com/iv/login/forgot_password.jsp',
  atsPlatform: 'official-company-site-no-public-careers',
  countryFilter: 'India',
  paginationStrategy: 'verified-legacy-brand-root-redirect-plus-legacy-login-surface-validation',
  extractionStrategy:
    'verified-insideview-root-redirect-to-demandbase+verified-legacy-login-surface-without-public-jobs-return-empty',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  companyDomain: 'insideview.com',
  verifiedOn: '2026-08-02',
  verifiedSurfaceSummary:
    'Verified on August 2, 2026 that https://www.insideview.com/ still redirects to the live Demandbase homepage at https://www.demandbase.com/, while the exact-name legacy page at https://my.insideview.com/iv/login/forgot_password.jsp remains publicly reachable as an InsideView set-password / forgot-password account surface. There is no trustworthy public jobs surface on the exact-name InsideView domain, so the provider remains pinned as a fail-closed sentinel that returns no jobs until a trustworthy exact-name first-party careers surface reappears.',
  dryRunFile: 'insideview/jobs.json',
  modulePath: path.resolve(currentDir, 'script.js'),
}

export default INSIDEVIEW_CATALOG
