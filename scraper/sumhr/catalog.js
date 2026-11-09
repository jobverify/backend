import path from 'node:path'
import { fileURLToPath } from 'node:url'
const currentDir = path.dirname(fileURLToPath(import.meta.url))
export const SUMHR_CATALOG = {
  source: 'sumhr', companyName: 'SumHR', officialBrandName: 'sumHR', exactCompanyMatchOnly: true,
  adapter: 'script', modulePath: path.resolve(currentDir, 'script.js'), dryRunFile: 'sumhr/jobs.json',
  companyCareerPage: 'https://sumhr.com/about-us/', officialCareersPageUrl: 'https://sumhr.com/about-us/',
  companyDomain: 'sumhr.com', atsPlatform: 'trakstar-independent-native-employer-tenant',
  countryFilter: 'India', parser: 'custom-script', normalizationProfile: 'engineering-default',
  paginationStrategy: 'native-visible-opening-count-and-unique-role-cards+all-native-details',
  extractionStrategy: 'fresh-official-employer-domain+reviewed-native-client-and-configured-contact+active-forms+explicit-India+partial-only',
  inventoryVerificationPolicy: 'live-parser-evidence-required', verifiedOn: '2026-10-23',
  verifiedPublicJobCount: null, verifiedIndiaJobCount: null, nativeBoardObservedJobCount: 1,
  nativeRecruitingBoard: 'https://sumhr.hire.trakstar.com/',
  verifiedSurfaceSummary: 'Actual 2026-10-23 HTTP 200 captures establish one active Sr. Software Developer (LAMP), Mumbai MH India role in independent Sumhr Trakstar tenant/client u0mr5. Native detail confirms employer Sumhr, position @sumHR, exact fk03ii form/canonical identity and employer-configured accommodation contact sid@sumhr.com, matching the fresh official invitation email domain humans@sumhr.com. Full substantive JD is present. No public posting date or expiry is exposed, so postingDate remains null. The corporate site provides no outbound ATS authorization and whole-company coverage is unknown. Recovery is partial, firstParty false and listing/scope incomplete, never eligible for cleanup. Observed native count 1 is not a verified global or India total. Missing/hidden/heading-only/placeholder descriptions retain eligible active roles with null JD and incomplete evidence; employer/form/country/schema/date contradictions reject.',
}
export default SUMHR_CATALOG
