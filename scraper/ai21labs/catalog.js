import path from 'node:path'
import {fileURLToPath} from 'node:url'
const currentDir=path.dirname(fileURLToPath(import.meta.url))
const PROVIDER_METADATA={
 source:'ai21labs',companyName:'AI21 Labs',adapter:'script',modulePath:path.join(currentDir,'script.js'),dryRunFile:path.join(currentDir,'jobs.json'),
 companyCareerPage:'https://www.ai21.com/careers/',companyDomain:'ai21.com',atsPlatform:'official-company-careers',countryFilter:'India',
 paginationStrategy:'bounded-native-card-detail-traversal',extractionStrategy:'native-position-cards-and-canonical-role-sections',parser:'custom-script',normalizationProfile:'engineering-default',
 verifiedOn:null,verifiedPublicJobCount:null,verifiedIndiaJobCount:null,companyGlobalTotal:null,companyIndiaTotal:null,
 inventoryEvidenceStatus:'discovery-only',sourceScopeComplete:false,sourceCompanyWideScopeComplete:false,indiaScopeComplete:false,lifecycleCleanupAllowed:false,
 verifiedSurfaceSummary:'Native cards and full published role sections can be observed. City-only locations do not establish country eligibility; current company and India totals remain unknown.',
 backfillMode:'runtime-verification',
}
export default PROVIDER_METADATA
export {PROVIDER_METADATA}
