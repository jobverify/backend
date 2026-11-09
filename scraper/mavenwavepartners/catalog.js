import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const MAVEN_WAVE_PARTNERS_CATALOG = {
  source: 'mavenwavepartners',
  companyName: 'Maven Wave Partners',
  officialBrandName: 'Maven Wave Partners',
  adapter: 'script',
  homepageUrl: 'https://www.mavenwave.com/',
  companyCareerPage: 'https://jobs.jobvite.com/maven-wave-partners/jobs',
  companyDomain: 'mavenwave.com',
  atsPlatform: 'jobvite-public-careers',
  countryFilter: 'India',
  paginationStrategy: 'unfiltered-board-explicit-empty',
  extractionStrategy:
    'verified-jobvite-alerts-handoff+unfiltered-branded-openings+explicit-empty-evidence',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-10-03',
  verifiedSurfaceSummary:
    'Verified on October 3, 2026: the established branded Jobvite job-alerts page links to the unfiltered Maven Wave Partners current-openings board, which returns HTTP 200, the exact public tenant companyEId qWH9Vfwr and an explicit no-open-jobs message. The legacy Maven Wave homepage has a TLS hostname mismatch; it is not required to re-fetch this already verified native tenant. Job-alert signup and general applications do not establish inventory. The current native board supports verified-empty evidence; new role markup requires re-verification.',
  modulePath: path.join(currentDir, 'script.js'),
  dryRunFile: 'mavenwavepartners/jobs.json',
}

export default MAVEN_WAVE_PARTNERS_CATALOG
