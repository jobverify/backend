import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const AERIES_TECHNOLOGY_CATALOG = {
  source: 'aeriestechnology',
  companyName: 'Aeries Technology',
  officialBrandName: 'Aeries Technology',
  adapter: 'script',
  homepageUrl: 'https://aeriestechnology.com/',
  companyCareerPage: 'https://aeriestechnology.com/careers/',
  jobsBoardUrl: 'https://aeriestechnology.talentrecruit.com/Search/',
  atsPlatform: 'talentrecruit',
  countryFilter: 'India',
  paginationStrategy: 'single-talentrecruit-search-service-request',
  extractionStrategy: 'verified-first-party-careers-page+talentrecruit-search-board+searchjobsservice-api+india-listings',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  companyDomain: 'aeriestechnology.com',
  verifiedOn: '2026-08-01',
  verifiedSurfaceSummary:
    'Verified on Saturday, August 1, 2026 that https://aeriestechnology.com/careers/ remained the exact first-party Aeries Technology careers page, that its View Current Openings CTA now hands applicants to https://aeriestechnology.talentrecruit.com/Search/, and that the live TalentRecruit SearchJobsService public API exposed India roles including Senior Executive/Assistant Manager - Billing and Cash Application and Senior Cybersecurity Analyst.',
  modulePath: path.resolve(currentDir, 'script.js'),
}

export default AERIES_TECHNOLOGY_CATALOG
