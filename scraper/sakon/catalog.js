import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SAKON_CATALOG = {
  source: 'sakon',
  companyName: 'Sakon',
  adapter: 'script',
  companyCareerPage: 'https://www.sakon.com/join-us',
  companyDomain: 'sakon.com',
  atsPlatform: 'official-company-site-no-public-careers',
  countryFilter: 'India',
  paginationStrategy: 'verified-first-party-join-us-page-with-empty-job-listing-state',
  extractionStrategy: 'verified-first-party-join-us-page+verified-empty-job-listing-state+lets-talk-handoff-return-empty',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-18',
  verifiedSurfaceSummary:
    'Verified on Saturday, July 18, 2026 that https://www.sakon.com/join-us was the live first-party Sakon careers page, that it still carried the Join the Team Powering the Intelligence Behind Global Telecom branding, and that its embedded jobs section rendered the empty-state text "No job listing available. Please change the filters or the Search criteria." instead of any public openings. The verified page only exposed generic CTA handoffs such as "Let\'s Talk" and "Get A Demo", so there was no trustworthy public jobs surface for Sakon on the verified date.',
  modulePath: path.join(currentDir, 'script.js'),
}

export default SAKON_CATALOG
