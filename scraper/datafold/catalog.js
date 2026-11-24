import path from 'node:path'
import {fileURLToPath} from 'node:url'
const currentDir=path.dirname(fileURLToPath(import.meta.url))
const PROVIDER_METADATA={
 source:'datafold',companyName:'Datafold',officialBrandName:'Datafold',companyDomain:'datafold.com',
 adapter:'script',catalogOverride:true,modulePath:path.join(currentDir,'script.js'),dryRunFile:path.join(currentDir,'jobs.json'),
 homepageUrl:'https://www.datafold.com/',companyCareerPage:'https://www.datafold.com/careers/',jobsBoardUrl:'https://jobs.ashbyhq.com/datafold',boardToken:'datafold',
 atsPlatform:'ashby',countryFilter:'India',parser:'custom-script',normalizationProfile:'engineering-default',
 currentProgrammeZeroProfile:null,authoritativeCurrentPublication:true,backfillMode:'live-parser',scraperTimeoutMs:180000,
 paginationStrategy:'paired-current-own-native-board-documented-feed-and-every-full-public-role',
 extractionStrategy:'own-static-connected-GQL-account-and-same-record-native-links;literal-native-board-and-role-state;documented-listed-feed;explicit-work-applicant-and-criteria-country;configured-listed-India-projection',
 verifiedOn:null,verifiedAt:null,verifiedPublicJobCount:null,verifiedGlobalJobCount:null,verifiedIndiaJobCount:null,
 sourceScopeComplete:false,lifecycleCleanupAllowed:false,
 verifiedSurfaceSummary:'Current Datafold careers source must statically connect its actual account, anonymous GraphQL operations, same-record native links, title consumer and recruitment mount without executing publisher JavaScript. Paired original native board and documented listed-feed GETs must reconcile every full public role, original criteria, compensation, explicit work/applicant country, publication and public handoff. Only the configured native listed India projection can qualify as empty when every current role is explicitly foreign. The own GraphQL backend response, browser/renderer activation and membership, application/screening controls, legal employer, company totals, India facet and lifecycle cleanup remain unverified. No whole page, programme, client, CSS, ID or roster hashes provide runtime qualification.'
}
export default PROVIDER_METADATA
export{PROVIDER_METADATA}
