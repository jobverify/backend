import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

const KEKA_IDENTIFIER = '1d58bf68-c78d-495e-8a38-d17ff1298707'

export const XOXODAY_CATALOG = {
  source: 'xoxoday',
  companyName: 'Xoxoday',
  officialBrandName: 'Xoxoday',
  adapter: 'script',
  companyCareerPage: 'https://www.xoxoday.com/careers',
  kekaCareerPageUrl: 'https://nreach.keka.com/careers/',
  kekaIdentifier: KEKA_IDENTIFIER,
  jobsApiUrl: `https://nreach.keka.com/careers/api/embedjobs/default/active/${KEKA_IDENTIFIER}`,
  companyDomain: 'xoxoday.com',
  atsPlatform: 'keka-embed-api',
  countryFilter: 'Global',
  paginationStrategy: 'first-party-careers-shell-plus-keka-embed-jobs-api',
  extractionStrategy: 'verified-first-party-careers-page+verified-keka-shell+official-keka-embed-jobs-api+global-roles',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-08-13',
  verifiedPublicJobCount: 51,
  verifiedSurfaceSummary:
    'Verified on Thursday, August 13, 2026 that https://www.xoxoday.com/careers currently returns a Vercel Security Checkpoint shell with HTTP 429, while the public Keka shell at https://nreach.keka.com/careers/ remains tied to identifier 1d58bf68-c78d-495e-8a38-d17ff1298707 and the live Keka embed jobs payload returns 51 public openings including Product Manager - Empuls and Senior Manager - Business & Commercial Intelligence.',
  modulePath: path.join(currentDir, 'script.js'),
}

export default XOXODAY_CATALOG
