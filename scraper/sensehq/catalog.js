import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SENSEHQ_CATALOG = {
  source: 'sensehq',
  companyName: 'SenseHQ',
  officialBrandName: 'Sense HQ',
  adapter: 'script',
  homepageUrl: 'https://www.sensehq.com/',
  companyCareerPage: 'https://www.sensehq.com/careers',
  verifiedJobsPageUrl: 'https://sensehr.sensehq.com/careers',
  sampleJobUrl: 'https://sensehr.sensehq.com/careers/jobs/217',
  companyDomain: 'sensehq.com',
  atsPlatform: 'sensehq',
  countryFilter: 'India',
  jobsDataSource: '__NEXT_DATA__.props.pageProps.jobsData.rows',
  paginationStrategy: 'verified-sensehq-board-next-data-rows-root-page-only',
  extractionStrategy:
    'verified-sensehq-next-data-rows+open-job-filter+india-country-filter+first-party-detail-url-build',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-08-04',
  verifiedSurfaceSummary:
    'Verified on Tuesday, August 4, 2026 that https://www.sensehq.com/careers is the live first-party Sense careers page and that its View Jobs embed loads the public SenseHQ board from https://sensehr.sensehq.com/careers/js/sense-career-inject.js. Verified that the public board at https://sensehr.sensehq.com/careers exposes 10 open India roles through the embedded __NEXT_DATA__.props.pageProps.jobsData.rows payload, including Technical Support Representative, DevOps Engineer, and Lead Software Engineer II - Backend. Verified sample India role: DevOps Engineer at https://sensehr.sensehq.com/careers/jobs/217. The public board metadata currently reports count 11, but the embedded rows array exposes 10 open roles and https://sensehr.sensehq.com/careers?page=2 does not expose additional public rows, so this provider conservatively materializes the verified first-page rows only.',
  dryRunFile: 'sensehq/jobs.json',
  modulePath: path.resolve(currentDir, 'script.js'),
}

export default SENSEHQ_CATALOG
