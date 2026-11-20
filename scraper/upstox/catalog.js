import path from 'node:path'
import {fileURLToPath} from 'node:url'
const currentDir=path.dirname(fileURLToPath(import.meta.url))
export const PROVIDER_METADATA={
 source:'upstox',companyName:'Upstox',officialBrandName:'Upstox',adapter:'script',modulePath:path.resolve(currentDir,'script.js'),
 homepageUrl:'https://upstox.com/',companyCareerPage:'https://upstox.com/careers/',officialCareersPageUrl:'https://upstox.com/careers/',companyDomain:'upstox.com',
 atsPlatform:'first-party-current-native-server-publication-and-declared-Darwinbox-ID-public-handoff',countryFilter:'India',parser:'custom-script',normalizationProfile:'engineering-default',
 authoritativeCurrentPublication:true,backfillMode:'live-parser',scraperTimeoutMs:180000,verifiedOn:null,verifiedJobCount:null,verifiedIndiaJobCount:null,
 paginationStrategy:'independently-paired-current-own-server-published-rows-and-visible-cards;company-allchannels-unverified',
 extractionStrategy:'current-own-publisher-and-reachable-initialJobs;finite-current-renderer-input-to-public-ID-handoff-static-proof;exact-whole-government-municipal-state-labels;actual-authored-dates-and-all-native-criteria-models-retained-as-partials',
 verifiedSurfaceSummary:'Pairs the current own Upstox homepage, careers publication, reachable literal server role models and actual visible role cards. The currently declared own client is inspected without execution only for connected original input/default-filter/returned-card/native-ID-to-public-application semantics; unrelated whole UI builds are not pinned. Exact whole Mumbai, Maharashtra and Bangalore, Karnataka workplaces use retained independent government city/state evidence. All original alternatives, summaries and exact postedDate values remain preserved as partials. Native public Darwinbox ID is separate from null formal requisition and legal employer; the delegated origin is not fetched again. Full criteria, ATS tenant/backend activation, all application controls, company/all-channel totals and cleanup remain unverified.',
 zeroResultPolicy:'evidence-required',dryRunFile:'upstox/jobs.json'
}
export default PROVIDER_METADATA
