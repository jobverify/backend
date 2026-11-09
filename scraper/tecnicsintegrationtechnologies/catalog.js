import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const TECNICS_INTEGRATION_TECHNOLOGIES_CATALOG = {
  source: 'tecnicsintegrationtechnologies',
  companyName: 'Tecnics Integration Technologies',
  officialBrandName: 'Tecnics',
  adapter: 'script',
  homepageUrl: 'https://tecnics.com/',
  companyCareerPage: 'https://tecnics.com/',
  applyUrl: null,
  atsPlatform: 'official-company-website-discovery-only',
  countryFilter: 'India',
  paginationStrategy: 'current-company-pages-and-published-sitemap',
  extractionStrategy: 'verified-company-discovery-without-authoritative-job-inventory',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  companyDomain: 'tecnics.com',
  verifiedOn: '2026-10-08',
  sourceListingComplete: false,
  verifiedPublicJobCount: null,
  verifiedIndiaJobCount: null,
  verificationDisposition: 'current-company-discovery-only-jobs-unverified',
  legacyCareerPage: 'https://tecnics.com/careers/',
  legacyVerifiedOn: '2026-07-17',
  verifiedSurfaceSummary:
    "Verified on October 8, 2026 that Tecnics now publishes a first-party identity security and managed IAM company site. Homepage, about, contact, robots and49-URL sitemap verify current company continuity and Hyderabad presence; no authoritative careers/ATS handoff was observed in these discovery surfaces. The former APAC careers route returns404. Discovery-only evidence remains listingComplete:false with unknown global and India job counts; no public-job or zero-inventory claim.",
  modulePath: path.resolve(currentDir, 'script.js'),
}

export default TECNICS_INTEGRATION_TECHNOLOGIES_CATALOG
