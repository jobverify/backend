import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const KUVERA_CATALOG = {
  source: 'kuvera',
  companyName: 'Kuvera',
  officialBrandName: 'Kuvera by CRED',
  adapter: 'script',
  modulePath: path.resolve(currentDir, 'script.js'),
  dryRunFile: 'kuvera/jobs.json',
  homepageUrl: 'https://kuvera.in/',
  companyCareerPage: 'https://kuvera.in/about',
  officialResumeSubmissionEmail: 'jobs@kuvera.in',
  companyDomain: 'kuvera.in',
  atsPlatform: 'official-company-site-no-public-careers',
  countryFilter: 'India',
  paginationStrategy: 'verified-first-party-about-page-resume-email-handoff',
  extractionStrategy:
    'verified-first-party-about-page+resume-email-handoff-without-public-listings-return-empty',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-16',
  verifiedSurfaceSummary:
    'Verified on July 16, 2026 that https://kuvera.in/about is the live exact-name first-party Kuvera by CRED about page and exposes a JOIN OUR TEAM / We\u2019re Hiring hiring handoff that instructs candidates to send resumes to jobs@kuvera.in. There is no trustworthy public jobs surface: the official page does not expose a public jobs board, public ATS listing feed, or public job detail pages, so this provider is a fail-closed sentinel that returns no jobs until the first-party surface publishes structured public listings.',
}

export default KUVERA_CATALOG
