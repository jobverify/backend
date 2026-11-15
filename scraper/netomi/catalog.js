import {publicLeverMetadata, PUBLIC_LEVER_PROFILES} from '../../scraper-support/native-sources/publicLeverChannels/nativeCareers.js'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const VERIFIED_SURFACE_SUMMARY =
  'Finite Netomi own-native text data observations only: the exact known Lever account, employer label/logo, full native feed and nine typed India single-location role HTML pairs are qualified against reviewed original bytes. Current corporate endorsement and formal legal entity remain unverified; the literal native http://netomi.com backlink is not equated with https://www.netomi.com/. Rendered/client/CSS/application authority, whole-company inventory and lifecycle cleanup remain held. Unknown changes or unavailable pairs are coverage gaps, never verified zero. Current live nine-pair completion requires separate acquisition evidence.'

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

export const NETOMI_CATALOG = {...publicLeverMetadata(PUBLIC_LEVER_PROFILES.netomi, NETOMI_CATALOG_HISTORICAL),
  modulePath: path.resolve(currentDir, 'nativeText20261115.js'),
  paginationStrategy: 'paired-whole-native-board-full-feed-and-nine-typed-india-html-pairs',
  extractionStrategy: 'finite-original-raw-entity-own-native-text-data-only-no-own-role-api-visits',
  verificationDisposition: 'own-native-text-data-observations-company-unverified',
  sourceEvidenceScope: 'own-native-text-data-only',
  verifiedSurfaceSummary: VERIFIED_SURFACE_SUMMARY,
  sourceCorporateBindingQualified: false,
  sourceFormalLegalEntityQualified: false,
  sourceActivationComplete: false,
  sourceRenderedCriteriaComplete: false,
  sourceApplicationQualificationComplete: false,
}

export default NETOMI_CATALOG
