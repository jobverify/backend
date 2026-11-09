import {publicLeverMetadata, PUBLIC_LEVER_PROFILES} from '../../scraper-support/native-sources/publicLeverChannels/nativeCareers.js'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const VERIFIED_SURFACE_SUMMARY =
  'Verified on Saturday, August 15, 2026 that https://www.netomi.com/careers now redirects to the live first-party homepage at https://www.netomi.com/, that the homepage exposes the referral-only marketing copy "We create intelligent experiences for the world\'s most ambitious companies." and "New engagements are by referral.", and that the first-party HTML no longer embeds or links a public careers or Lever handoff. The standalone Lever API at https://api.lever.co/v0/postings/netomi?mode=json remained reachable on Saturday, August 15, 2026 and exposed 22 public jobs including India roles, but without a current first-party careers proof this scraper returns [] until Netomi restores a trustworthy public jobs surface.'

const NETOMI_CATALOG_HISTORICAL = {
  source: 'netomi',
  companyName: 'Netomi',
  officialBrandName: 'Netomi',
  adapter: 'script',
  modulePath: path.resolve(currentDir, 'script.js'),
  dryRunFile: 'netomi/jobs.json',
  homepageUrl: 'https://www.netomi.com/',
  companyCareerPage: 'https://www.netomi.com/careers',
  companyDomain: 'netomi.com',
  officialLeverBoardUrl: 'https://jobs.lever.co/netomi',
  leverApiUrl: 'https://api.lever.co/v0/postings/netomi?mode=json',
  verifiedPublicJobCount: 0,
  verifiedIndiaJobCount: 0,
  verifiedSampleJobUrl: null,
  atsPlatform: 'lever',
  countryFilter: 'Global',
  paginationStrategy: 'official-careers-validation-plus-lever-api-or-referral-homepage-empty-state',
  extractionStrategy: 'verified-first-party-careers-page+embedded-lever-api+global-lever-postings|verified-referral-homepage-redirect-empty-state',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-08-15',
  verifiedSurfaceSummary: VERIFIED_SURFACE_SUMMARY,
}

export const NETOMI_CATALOG = publicLeverMetadata(PUBLIC_LEVER_PROFILES.netomi, NETOMI_CATALOG_HISTORICAL)

export default NETOMI_CATALOG
