import {readFileSync} from 'node:fs'
import {createDeclaredJobFeedScraper} from '../declaredJobFeeds/nativeCareers.js'
export const PUBLIC_LEVER_PROFILES=JSON.parse(readFileSync(new URL('./profiles.json',import.meta.url)))
export const publicLeverMetadata=(profile,previous={})=>({...previous,source:profile.source,companyName:profile.companyName,
 companyCareerPage:profile.primaryURL,countryFilter:profile.countryFilter,verifiedOn:null,verifiedAt:null,
 verifiedPublicJobCount:null,verifiedIndiaJobCount:null,verifiedInventoryStatus:'unverified',sourceScopeComplete:false,
 lifecycleCleanupAllowed:false,zeroResultPolicy:'coverage-gap',backfillMode:'discovery-only',
 atsPlatform:profile.platform,boardIdentityVerified:false,officialBindingVerifiedAt:null,bindingEvidence:null,
 runtimeInventoryVerification:false,verifiedSampleJobUrl:null,verificationDisposition:'discovery-only-native-channel',
 paginationStrategy:'original-selected-native-collections-and-owned-records-before-country-selection',
 extractionStrategy:'paired-public-native-role-models-and-advertised-channel-availability',
 verifiedSurfaceSummary:'Original public native and selected-channel observations only. Current publisher binding may remain held; whole employer/India-zero, recruitment, browser/application activation, persistence and publication remain unqualified.'})
export const createPublicLeverSource=(profile,defaults={})=>({name:profile.source,async run(options={}){
 const passed={...defaults,...options};if(passed.maxJobs===Infinity)passed.maxJobs=null
 return createDeclaredJobFeedScraper(profile).run(passed)
}})
