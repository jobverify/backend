import path from 'node:path'
import {fileURLToPath} from 'node:url'
const dir=path.dirname(fileURLToPath(import.meta.url))
const PROVIDER_METADATA={source:'target',companyName:'Target',adapter:'script',atsPlatform:'workday',companyCareerPage:'https://indiajobs.target.com/',companyDomain:'indiajobs.target.com',countryFilter:'India',paginationStrategy:'bounded-first15-current-own-public-SSR;remaining-native-pagination-and-company-inventory-held',extractionStrategy:'current-own-Target-Brands-publisher-and-literal-native-GET-form;exact-TARGET-brand-typed-India-same-role-ATS-requisition-Apply-controls;two-pass-closing;valid-partial-records;legal-entity-and-activation-unverified',parser:'custom-script',normalizationProfile:'engineering-default',backfillMode:'live-parser',scraperTimeoutMs:180000,authoritativeCurrentPublication:true,verifiedOn:null,verifiedPublicJobCount:null,verifiedIndiaJobCount:null,modulePath:path.join(dir,'script.js'),dryRunFile:path.join(dir,'jobs.json')}
export default PROVIDER_METADATA
export {PROVIDER_METADATA}
