import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const RAIN_INSTANT_PAY_CATALOG = {
  source: 'raininstantpay',
  companyName: 'Rain Instant Pay',
  officialBrandName: 'Rain',
  adapter: 'script',
  modulePath: path.resolve(currentDir, 'script.js'),
  dryRunFile: 'raininstantpay/jobs.json',
  companyCareerPage: 'https://www.rainapp.com/careers',
  ashbyPublicBoardUrl: 'https://jobs.ashbyhq.com/rain-technologies',
  ashbyJobBoardUrl: 'https://api.ashbyhq.com/posting-api/job-board/rain-technologies',
  companyDomain: 'rainapp.com',
  verifiedPublicJobCount: 8,
  verifiedSampleJobTitle: 'Business Development Representative',
  verifiedSampleSecondaryJobTitle: 'Engineering Lead',
  atsPlatform: 'ashby',
  countryFilter: 'Global',
  paginationStrategy: 'single-public-ashby-job-board-get',
  extractionStrategy:
    'verified-first-party-careers-page+ashby-handoff+public-ashby-get-feed',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-17',
  verifiedSurfaceSummary:
    'Verified on Friday, July 17, 2026 that https://www.rainapp.com/careers is the live official Rain careers page for the exact-name backlog company Rain Instant Pay, that it hands off applicants through a first-party See open roles button to the public Ashby board at https://jobs.ashbyhq.com/rain-technologies, and that the companion public Ashby GET feed at https://api.ashbyhq.com/posting-api/job-board/rain-technologies returned 8 live listed jobs. Verified live samples included Business Development Representative in the United States and Engineering Lead with a remote Lisbon, Portugal primary location.',
}

export default RAIN_INSTANT_PAY_CATALOG
