import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const VERIFIED_SURFACE_SUMMARY =
  'Reviewed October 23, 2026: https://www.policybazaar.com/careers/ displays 4 inline role cards: Associate Sales Consultant, Associate Service Consultant, Relationship Manager, and Careers in Technology, plus a position-select resume upload form. The 7 general hiring-city office entries do not bind locations or an explicit country to individual roles, and the generic technology/resume pool does not establish a finite vacancy inventory. Runtime checks retain native observations and report an explicit coverage gap; they never infer four verified vacancies or a verified empty inventory. Fresh independent native employer303524 is linked by the current corporate careers footer and reciprocates policybazaar.com. The India search reports156 roles with60 observed cards. Two captured active explicit-India details reconcile title, employer, country, canonical URL and same-role Apply:4430667875 published2026-07-13 and4451237087 published2026-09-15. Both remain old under unchanged filters; no eligible recovery claimed. Third detail429 stops collection, not retried. Generic footer identity does not establish explicit ATS delegation, so firstParty remains false. Missing JD stays nullable; whole-company scope and totals unknown, cleanup disabled. Unbound HireZapp/Trakstar boards are not substituted.'

export const POLICYBAZAAR_CATALOG = {
  source: 'policybazaar',
  companyName: 'Policybazaar',
  officialBrandName: 'Policybazaar',
  adapter: 'script',
  homepageUrl: 'https://www.policybazaar.com/',
  companyCareerPage: 'https://www.policybazaar.com/careers/',
  publicBoardUrl: 'https://www.policybazaar.com/careers/',
  companyDomain: 'policybazaar.com',
  verifiedHiringCities: [
    'Gurugram',
    'Mumbai',
    'Pune',
    'Kolkata',
    'Chennai',
    'Bangalore',
    'Hyderabad',
  ],
  countryFilter: 'India',
  exactCompanyMatchOnly: true,
  atsPlatform: 'native-employer-linkedin',
  nativeEmployerUrl: 'https://www.linkedin.com/company/policybazaar/',
  nativeEmployerOrganizationId: '303524',
  nativeObservedRecordCount: 60,
  nativeReportedIndiaFilteredCount: 156,
  nativeValidatedIndiaDetailCount: 2,
  observedEligibleCount: 0,
  sourceListingComplete: false,
  sourceScopeComplete: false,
  lifecycleCleanupAllowed: false,
  firstParty: false,
  paginationStrategy: 'bounded-native-exact-employer-india-list-and-detail-reading;incomplete',
  extractionStrategy:
    'official-employer-identity+native-enabled-application+explicit-India+original-public-dates',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-10-23',
  verifiedPublicOpeningCount: null,
  observedRoleCardCount: 4,
  currentInventoryStatus: 'coverage-gap',
  verifiedSurfaceSummary: VERIFIED_SURFACE_SUMMARY,
  dryRunFile: 'policybazaar/jobs.json',
  modulePath: path.resolve(currentDir, 'script.js'),
}

export default POLICYBAZAAR_CATALOG
