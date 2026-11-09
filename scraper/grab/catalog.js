import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const GRAB_CATALOG = {
  source: 'grab',
  companyName: 'Grab',
  officialBrandName: 'Grab',
  adapter: 'script',
  homepageUrl: 'https://www.grab.careers/en/',
  companyCareerPage: 'https://www.grab.careers/jobs',
  jobsRssFeedUrl: 'https://www.grab.careers/en/jobs/xml/?rss=true',
  indiaLocationPageUrl: 'https://www.grab.careers/en/locations/india/',
  sampleIndiaJobUrl:
    'https://www.grab.careers/en/jobs/744000143229150/lead-software-engineer-backend/',
  sampleSecondaryIndiaJobUrl:
    'https://www.grab.careers/en/jobs/744000138554499/solutions-specialist-epm-finance-systems/',
  atsPlatform: 'official-company-careers',
  countryFilter: 'India',
  paginationStrategy: 'first-party-jobs-board-plus-jobs-rss-feed-plus-india-location-overview-page',
  extractionStrategy:
    'verified-first-party-jobs-board+verified-jobs-rss-feed+verified-india-location-page+india-location-filter',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  companyDomain: 'grab.careers',
  verifiedOn: '2026-08-14',
  verifiedSurfaceSummary:
    'Verified on Friday, August 14, 2026 that https://www.grab.careers/en/ remains the live first-party Grab careers homepage, that https://www.grab.careers/jobs remains the live first-party jobs board, that the same-domain feed at https://www.grab.careers/en/jobs/xml/?rss=true exposed current India roles including https://www.grab.careers/en/jobs/744000143229150/lead-software-engineer-backend/ and https://www.grab.careers/en/jobs/744000138554499/solutions-specialist-epm-finance-systems/, and that https://www.grab.careers/en/locations/india/ now acts as a first-party India location overview page with Bangalore workplace and team information rather than an inline jobs list.',
  modulePath: path.join(currentDir, 'script.js'),
  dryRunFile: path.join(currentDir, 'jobs.json'),
}

export default GRAB_CATALOG
