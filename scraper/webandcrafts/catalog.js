import path from 'node:path'
import {fileURLToPath} from 'node:url'
const directory=path.dirname(fileURLToPath(import.meta.url))
export const WEBANDCRAFTS_CATALOG={
 source:'webandcrafts',companyName:'Webandcrafts',officialBrandName:'Webandcrafts',adapter:'script',modulePath:path.resolve(directory,'script.js'),
 homepageUrl:'https://webandcrafts.com/',companyCareerPage:'https://webandcrafts.com/careers/job-openings',companyDomain:'webandcrafts.com',
 atsPlatform:'first-party-current-declared-read-only-careers-department-api',countryFilter:'India',parser:'custom-script',normalizationProfile:'engineering-default',
 authoritativeCurrentPublication:true,backfillMode:'live-parser',scraperTimeoutMs:180000,verifiedOn:null,verifiedJobCount:null,verifiedIndiaJobCount:null,
 paginationStrategy:'paired-current-own-Flight-department-export-and-current-declared-single-page-read-only-POST-per-active-category;company-inventory-unverified',
 extractionStrategy:'current-own-publisher→live-Flight-input/export→connected-department-query-response-state-returned-role-and-public-title-link;whole-role-Koratty-government-proof;all-original-records-and-partials-retained',
 verifiedSurfaceSummary:'Pairs current WAC/Webandcrafts corporate careers authority and current declared listing protocol, then original read-only department API responses per actual category. Public numeric role IDs and separately authored formal requisition fields retained; created_at and updated_at are unasserted timestamps. Current whole Koratty workplaces qualify with retained independent district-government geography, with all alternatives retained. Actual declared title query routes provide partial public handoffs; only the first two native detail pairs are optional enrichment. Every job remains partial: full application controls/backend, legal employing entity, whole-company/all-channel/India-facet totals and lifecycle replacement remain unverified. The no-query canonical Apply alternative remains an unqualified alternative rather than an activation claim.',
 zeroResultPolicy:'evidence-required',dryRunFile:'webandcrafts/jobs.json'
}
export default WEBANDCRAFTS_CATALOG
