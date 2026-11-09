import path from 'node:path'
import {fileURLToPath} from 'node:url'
const currentDir=path.dirname(fileURLToPath(import.meta.url))
const PROVIDER_METADATA={
 source:'enphaseenergy',companyName:'Enphase Energy',adapter:'script',
 modulePath:path.join(currentDir,'script.js'),dryRunFile:path.join(currentDir,'jobs.json'),
 companyDomain:'enphase.com',officialHomepageUrl:'https://enphase.com/',companyCareerPage:'https://enphase.com/careers',
 jobsBoardUrl:'https://enphase.com/api/v2/jobs',atsPlatform:'enphase-native-corporate-api',
 countryFilter:'India',parser:'custom-script',normalizationProfile:'engineering-default',
 paginationStrategy:'all-finite-zero-based-native-pages-and-full-final-recheck',
 extractionStrategy:'explicit-India-native-IDs-matching-full-corporate-JDs-and-exact-configured-Jobvite-links',
 verifiedOn:null,verifiedAt:null,verifiedPublicJobCount:null,verifiedIndiaJobCount:null,verifiedInventoryStatus:'unverified',
 sourceScopeComplete:false,zeroResultPolicy:'coverage-gap',backfillMode:'implemented',remediationStatus:'implemented-awaiting-ordinary-audit-and-independent-review',
 verifiedSurfaceSummary:'Corporate client, API records, full India role identity and configured native links are checked each run. Original dates, legal employer, posting status and company-wide totals remain null. Application control does not validate application form access.',
}
export default PROVIDER_METADATA
export {PROVIDER_METADATA}
