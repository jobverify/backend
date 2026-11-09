import path from 'node:path'
import { fileURLToPath } from 'node:url'
const currentDir=path.dirname(fileURLToPath(import.meta.url))
export const RENEWBUY_CATALOG={
 source:'renewbuy',companyName:'RenewBuy',officialBrandName:'RenewBuy',exactCompanyMatchOnly:true,
 adapter:'script',modulePath:path.resolve(currentDir,'script.js'),dryRunFile:'renewbuy/jobs.json',companyDomain:'renewbuy.com',
 companyCareerPage:'https://www.linkedin.com/company/renewbuyofficial/',officialCareersPageUrl:'https://www.renewbuy.com/careers',
 atsPlatform:'linkedin-employer-published-partial',countryFilter:'India',parser:'custom-script',normalizationProfile:'engineering-default',
 paginationStrategy:'bounded-native-60-card-subset; reported139; guest-offsets-rate-limited; incomplete',
 extractionStrategy:'official403-check+native-exact-company9350817-profile-website+visible-card/ItemList-parity+canonical-active-JobPosting-details+explicit-India-geography',
 inventoryVerificationPolicy:'live-parser-evidence-required',verifiedOn:'2026-10-23',
 verifiedPublicPostingCount:null,verifiedIndiaJobCount:null,nativeReportedJobCount:139,observedPublicJobCount:60,verifiedRecoveredIndiaJobs:7,
 verifiedSurfaceSummary:'On October 23, current official homepage and careers plus legitimate about-us, about-us/careers and p/careers aliases return HTTP 403. Native RenewBuy LinkedIn profile publishes www.renewbuy.com and exact company 9350817 search. India board reports 139 with 60 actual visible cards matching ItemList. Guest offsets 0 and 25 each return 10 cards, offset 50 returns HTTP 429; no stride or full enumeration inferred. Seven native active India job facts with full descriptions are verified from newest observed cards before detail HTTP 429. Their earliest public dates are 2026-08-23, so existing freshness policy remains applicable. Corporate outbound hiring handoff remains unverified: firstParty=false, discovery-only, listingComplete=false, unknown whole-employer totals, no cleanup. Native employer, title, URL, card, schema, country, state and application identity checked on every run; descriptions may be null or partial; whole-run fetch and body timeout and exact caller abort bounded.',
}
export default RENEWBUY_CATALOG
