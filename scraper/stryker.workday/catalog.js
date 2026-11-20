import path from 'node:path'
import {fileURLToPath} from 'node:url'
const dir=path.dirname(fileURLToPath(import.meta.url))
const PROVIDER_METADATA={source:'stryker',companyName:'Stryker',adapter:'script',atsPlatform:'workday',companyCareerPage:'https://careers.stryker.com/jobs',companyDomain:'careers.stryker.com',countryFilter:'India',paginationStrategy:'bounded-first10-current-own-filtered-native-SSR-publications;remaining-inventory-held',extractionStrategy:'current-native-country-control-and-independent-selected-country-SSR-echo;exact-own-company-Open-external-role-workplace-application-models;two-pass-closing;partial-records',parser:'custom-script',normalizationProfile:'engineering-default',backfillMode:'live-parser',scraperTimeoutMs:180000,authoritativeCurrentPublication:true,verifiedOn:null,verifiedPublicJobCount:null,verifiedIndiaJobCount:null,modulePath:path.join(dir,'script.js'),dryRunFile:path.join(dir,'jobs.json')}
export default PROVIDER_METADATA
export {PROVIDER_METADATA}
