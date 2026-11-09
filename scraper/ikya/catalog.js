import {nativeGetMetadata} from '../../scraper-support/native-sources/publicNativeGetSources/nativeCareers.js'
const LEGACY_IKYA_CATALOG = {
  source: 'ikya',
  companyName: 'Ikya',
  officialBrandName: 'Ikya',
  adapter: 'script',
  homepageUrl: 'http://www.ikya.com/',
  companyCareerPage: 'https://careers.smartrecruiters.com/Ikya1',
  companyDomain: 'ikya.com',
  atsPlatform: 'smartrecruiters-empty-board',
  countryFilter: 'India',
  paginationStrategy: 'single-smartrecruiters-board-verification-plus-homepage-browser-check',
  extractionStrategy: 'verified-empty-smartrecruiters-board+homepage-browser-check-return-empty',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  modulePath: '../../scraper/ikya/script.js',
  dryRunFile: 'ikya/jobs.json',
  verifiedOn: '2026-09-03',
  verifiedSurfaceSummary:
    'Verified on September 3, 2026 that https://careers.smartrecruiters.com/Ikya1 is still the live first-party Ikya public careers board and that it explicitly says "No job postings are currently available." The linked homepage at http://www.ikya.com/ now serves a browser-verification challenge titled "Checking your browser..." rather than a real company careers site, so this provider still returns an empty array until a trustworthy public jobs surface appears.',
}

export const IKYA_CATALOG = nativeGetMetadata('ikya', LEGACY_IKYA_CATALOG)
export const VERIFIED_SURFACE_SUMMARY = IKYA_CATALOG.verifiedSurfaceSummary

export default IKYA_CATALOG

