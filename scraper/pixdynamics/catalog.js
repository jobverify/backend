import path from 'node:path'
import {fileURLToPath} from 'node:url'
const currentDir=path.dirname(fileURLToPath(import.meta.url))
const PROVIDER_METADATA={
 source:'pixdynamics',companyName:'PixDynamics',officialBrandName:'PixDynamics',adapter:'script',
 companyCareerPage:'https://pixdynamics.com/career',companyDomain:'pixdynamics.com',atsPlatform:'official-company-careers',countryFilter:'India',parser:'custom-script',normalizationProfile:'engineering-default',
 authoritativeCurrentPublication:true,scraperTimeoutMs:180000,backfillMode:'live-parser',verifiedOn:null,verifiedPublicJobCount:null,verifiedGlobalJobCount:null,verifiedIndiaJobCount:null,
 nativePublicationScope:'unresolved-native-publication-visibility-country-application',sourceScopeComplete:false,companyInventoryComplete:false,lifecycleCleanupAllowed:false,
 paginationStrategy:'bounded-own-home-career-opening-closing-scope-observations',
 extractionStrategy:'current-own-native-SSR-observation-controlled-hold+raw-card-visibility-and-unqualified-resume-carrier-retention',
 verifiedSurfaceSummary:'Current original own publisher and career documents are qualified twice, while native card publication, CSS/program visibility, workplace country and application membership remain unresolved. Raw inactive-marked and active unknown cards, criteria, owners, the current section notice and separate resume instructions are retained as observations. No India jobs, configured/company empty count, legal employer, public job/requisition IDs, native date projection, municipal country mapping, UI/email activation, backend or cleanup claim is made.',
 modulePath:path.join(currentDir,'script.js'),dryRunFile:path.join(currentDir,'jobs.json'),
}
export default PROVIDER_METADATA
export {PROVIDER_METADATA}
