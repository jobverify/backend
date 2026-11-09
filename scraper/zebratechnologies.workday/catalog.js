import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const VERIFIED_SURFACE_SUMMARY =
  'Revalidated on Saturday, August 1, 2026 that https://www.zebra.com/us/en/about-zebra/careers.html is the live first-party Zebra careers page with the Better Every Day and Join the Herd hero sections and that it still links to the official public Workday board at https://zebra.wd501.myworkdayjobs.com/Zebra_careers. Official Zebra Workday results still exposed public India openings including Software Engineer Lead (IN/LK), Professional Senior, Senior Manager, Technical Program Management, and Technical Customer Support II-2, so this local provider delegates to the shared Workday runner with India filtering.'

export const ZEBRA_TECHNOLOGIES_CATALOG = {
  source: 'zebratechnologies',
  companyName: 'Zebra Technologies',
  officialBrandName: 'Zebra',
  adapter: 'script',
  homepageUrl: 'https://www.zebra.com/',
  companyCareerPage: 'https://www.zebra.com/us/en/about-zebra/careers.html',
  officialCareersPageUrl: 'https://www.zebra.com/us/en/about-zebra/careers.html',
  officialWorkdayBoardUrl: 'https://zebra.wd501.myworkdayjobs.com/Zebra_careers',
  companyDomain: 'zebra.com',
  atsPlatform: 'workday',
  countryFilter: 'India',
  paginationStrategy: 'verified-first-party-careers-handoff-plus-workday-india-filter',
  extractionStrategy:
    'current-first-party-careers-handoff+full-native-workday-role+reviewed-employer+explicit-own-country+incomplete-source-scope',
  nativeEmployerNames: ['Symbol Technologies India Private Limited','Zebra Technologies Corporation','Zebra Technologies India Private Limited'],
  nativeEmployerNameEvidence: {
    field: 'hiringOrganization.name',
    entityReviewURL: 'https://www.sec.gov/Archives/edgar/data/877212/000162828026007668/exhibit21-subsidiariesofth.htm',
    entityReviewSHA256: 'f78153d36c1a1216cd65562d6ccbaa2a0ac64516576a5c632a09d348f68f6e74',
    scopeRule: 'exact-observed-native-entity-labels-in-Zebra-bound-account;no-blanket-group-employer-alias',
  },
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-08-01',
  verifiedIndiaCountryFacetId: 'c4f78be1a8f14da0ab49ce1162348a5e',
  verifiedSurfaceSummary: VERIFIED_SURFACE_SUMMARY,
  dryRunFile: 'zebratechnologies.workday/jobs.json',
  modulePath: path.resolve(currentDir, 'script.js'),
}

export default ZEBRA_TECHNOLOGIES_CATALOG
