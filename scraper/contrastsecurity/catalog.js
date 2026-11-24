import path from 'node:path'
import {fileURLToPath} from 'node:url'
const currentDir=path.dirname(fileURLToPath(import.meta.url))
const PROVIDER_METADATA={
 source:'contrastsecurity',companyName:'Contrast Security',officialBrandName:'Contrast Security',companyDomain:'contrastsecurity.com',
 adapter:'script',modulePath:path.join(currentDir,'script.js'),dryRunFile:path.join(currentDir,'jobs.json'),
 homepageUrl:'https://www.contrastsecurity.com/',companyCareerPage:'https://www.contrastsecurity.com/contrast-careers',
 atsPlatform:'ashby',boardToken:'contrast-security',jobsBoardUrl:'https://jobs.ashbyhq.com/contrast-security',officialHomepageUrl:'https://www.contrastsecurity.com/',countryFilter:'India',parser:'custom-script',normalizationProfile:'engineering-default',
 authoritativeCurrentPublication:true,backfillMode:'live-parser',scraperTimeoutMs:180000,
 paginationStrategy:'paired-current-own-native-unfiltered-listed-collection',
 extractionStrategy:'current-own-publisher-and-direct-unfiltered-handoff+separate-filtered-navigation+native-board-literal-state+documented-public-feed+typed-primary-and-secondary-foreign-workplaces+configured-India-projection',
 verifiedOn:null,verifiedPublicJobCount:null,verifiedGlobalJobCount:null,verifiedIndiaJobCount:null,
 sourceScopeComplete:false,lifecycleCleanupAllowed:false,
 verifiedSurfaceSummary:'Current own publisher Contrast Security directly declares this exact Contrast Security source native account. Original unfiltered public state and officially documented anonymous GET must agree on every listed native identity, title, workplace, publisher, publication and same-role handoff in both observations. Only the configured typed-India collection projection can qualify as empty when every known primary and secondary workplace is explicitly foreign. No page, build, CSS, ID or roster pins; no publisher JavaScript execution. Whole company and India facet totals, legal employing entity, browser/application activation, backend and cleanup remain unverified.'
}
export default PROVIDER_METADATA
export{PROVIDER_METADATA}
