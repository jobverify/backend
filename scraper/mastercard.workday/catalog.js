import path from 'node:path'
import {fileURLToPath} from 'node:url'
const dir=path.dirname(fileURLToPath(import.meta.url))
const PROVIDER_METADATA={source:'mastercard',companyName:'Mastercard',adapter:'script',atsPlatform:'workday',companyCareerPage:'https://careers.mastercard.com/us/en/',companyDomain:'careers.mastercard.com',countryFilter:'India',paginationStrategy:'bounded-first10-current-public-SSR;literal-native-sitemaps-bind-own-role-URLs-only;remaining-pagination-and-company-inventory-held',extractionStrategy:'current-own-MASRUS-publisher-model-and-declared-GET-search-route;robots-declared-sitemap-literal-same-R-public-URLs;exact-Mastercard-brand-current-role-and-JobPosting-India-application-binding;two-pass-closing;valid-partial-records;legal-entity-renderer-and-backend-activation-unverified',parser:'custom-script',normalizationProfile:'engineering-default',backfillMode:'live-parser',scraperTimeoutMs:180000,authoritativeCurrentPublication:true,verifiedOn:null,verifiedPublicJobCount:null,verifiedIndiaJobCount:null,modulePath:path.join(dir,'script.js'),dryRunFile:path.join(dir,'jobs.json')}
export default PROVIDER_METADATA
export {PROVIDER_METADATA}
