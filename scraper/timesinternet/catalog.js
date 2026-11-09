import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const TIMES_INTERNET_CATALOG = {
  source: 'timesinternet',
  companyName: 'Times Internet',
  officialBrandName: 'Times Internet',
  adapter: 'script',
  modulePath: path.resolve(currentDir, 'script.js'),
  dryRunFile: 'timesinternet/jobs.json',
  companyCareerPage: 'https://timesinternet.in/careers/job-list',
  officialCareersPageUrl: 'https://timesinternet.in/careers/job-list',
  verifiedJobDetailUrls: [
    'https://timesinternet.in/careers/job-detail/6abb601846c5d2b24a35bd82',
    'https://timesinternet.in/careers/job-detail/644b66c280bea7e80b7a229d',
  ],
  companyDomain: 'timesinternet.in',
  atsPlatform: 'official-company-careers',
  countryFilter: 'India',
  paginationStrategy: 'single-first-party-job-list-page',
  extractionStrategy: 'verified-first-party-job-list+same-domain-detail-pages',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-10-03',
  verifiedSurfaceSummary:
    'Verified on October 3, 2026 that https://timesinternet.in/careers/job-list lists 10 current roles in India. Same-domain detail pages including https://timesinternet.in/careers/job-detail/6abb601846c5d2b24a35bd82 and https://timesinternet.in/careers/job-detail/644b66c280bea7e80b7a229d expose job descriptions and Apply now actions. The latter has an unstructured job description without an About Times Internet section; its branded title and page structure were verified.',
}

export default TIMES_INTERNET_CATALOG
