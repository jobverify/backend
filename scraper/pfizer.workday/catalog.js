import path from 'node:path'
import {fileURLToPath} from 'node:url'
const dir=path.dirname(fileURLToPath(import.meta.url))
const PROVIDER_METADATA={source:'pfizer',companyName:'Pfizer',adapter:'script',atsPlatform:'workday',companyCareerPage:'https://www.pfizer.com/about/careers/search-results',companyDomain:'pfizer.com',countryFilter:'India',paginationStrategy:'bounded-first2-current-declared-native-India-region-query-pages;company-scope-held',extractionStrategy:'current-own-selected-region-serializer-and-POST;whole-native-Open-external-role-country-criteria-date-application-models;two-pass-closing;partial-records',parser:'custom-script',normalizationProfile:'engineering-default',backfillMode:'live-parser',scraperTimeoutMs:180000,authoritativeCurrentPublication:true,verifiedOn:null,verifiedPublicJobCount:null,verifiedIndiaJobCount:null,modulePath:path.join(dir,'script.js'),dryRunFile:path.join(dir,'jobs.json')}
export default PROVIDER_METADATA
export {PROVIDER_METADATA}
