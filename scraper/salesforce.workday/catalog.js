import path from 'node:path'
import {fileURLToPath} from 'node:url'
const dir=path.dirname(fileURLToPath(import.meta.url))
const PROVIDER_METADATA={source:'salesforce',companyName:'Salesforce',adapter:'script',atsPlatform:'workday',companyCareerPage:'https://careers.salesforce.com/',companyDomain:'salesforce.com',countryFilter:'India',paginationStrategy:'current-declared-prod-primary+full-native-model-union;all-original-models;other-channels-company-inventory-held',extractionStrategy:'current-own-corporate-redirects+literal-jobs-page+active-PROD-client+connected-native-primary-full-feed-and-Apply-consumer-semantics+same-JR-authored-application+explicit-India;paired-closing;valid-partials;all-criteria-and-original-dates-preserved;legal-entity-renderer-backend-cleanup-held',parser:'custom-script',normalizationProfile:'engineering-default',backfillMode:'live-parser',scraperTimeoutMs:180000,authoritativeCurrentPublication:true,verifiedOn:null,verifiedPublicJobCount:null,verifiedIndiaJobCount:null,modulePath:path.join(dir,'script.js'),dryRunFile:path.join(dir,'jobs.json')}
export default PROVIDER_METADATA
export {PROVIDER_METADATA}
