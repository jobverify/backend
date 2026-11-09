import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const BOOKUWARUNG_CATALOG = {
  source: 'bukuwarung',
  companyName: 'Bukuwarung',
  officialBrandName: 'BukuWarung',
  legalEntityName: 'PT Buku Usaha Digital',
  adapter: 'script',
  companyCareerPage: 'https://www.bukuwarung.com/career/',
  homepageUrl: 'https://www.bukuwarung.com/',
  legacyHomepageUrl: 'https://bukuwarung.com/',
  officialCareersHandoffUrl: 'https://bukuwarung.darwinbox.com/ms/candidate/careers',
  darwinboxJobsUrl: 'https://bukuwarung.darwinbox.com/jobs',
  darwinboxShellRouteUrls: [
    'https://bukuwarung.darwinbox.com/ms/candidate/careers',
    'https://bukuwarung.darwinbox.com/ms/candidatev2/main/careers/home',
    'https://bukuwarung.darwinbox.com/ms/candidatev2/main/careers/allJobs',
  ],
  darwinboxListingApiUrl: 'https://bukuwarung.darwinbox.com/ms/candidateapi/job/alljobs?companyId=main',
  companyDomain: 'bukuwarung.com',
  atsPlatform: 'darwinbox-public-native',
  countryFilter: 'India',
  paginationStrategy: 'full-native-board+all-public-details+final-listing-after-closing-details',
  extractionStrategy:
    'current-active-corporate-handoff+strict-native-identity-country-and-public-criteria+blocked-host-cache',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: null,
  verifiedAt: null,
  sourceScopeComplete: false,
  sourceListingComplete: false,
  lifecycleCleanupAllowed: false,
  verifiedPublicJobCount: null,
  verifiedIndiaJobCount: null,
  verifiedInventoryStatus: 'unverified',
  verifiedSurfaceSummary:
    'The current https://www.bukuwarung.com/career/ actively advertises See Open Positions at https://bukuwarung.darwinbox.com/ms/candidate/careers. Runtime uses the declared tenant native inventory API and retains all raw roles, public details, native countries and publisher dates, with a final inventory after all closing details. Current native HTTP403 is unavailable inventory with unknown totals, never verified empty. A run-local denied-host cache prevents further denied-host requests; broader company scope and cleanup remain unverified.',
  modulePath: path.resolve(currentDir, 'script.js'),
}

export default BOOKUWARUNG_CATALOG
