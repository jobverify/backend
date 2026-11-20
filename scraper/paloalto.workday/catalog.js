import path from 'node:path'
import {fileURLToPath} from 'node:url'
const dir=path.dirname(fileURLToPath(import.meta.url))
const PROVIDER_METADATA={source:'paloalto',companyName:'Palo Alto Networks',adapter:'script',atsPlatform:'workday',companyCareerPage:'https://jobs.paloaltonetworks.com/en',companyDomain:'jobs.paloaltonetworks.com',countryFilter:'India',paginationStrategy:'bounded-first15-current-own-India-SSR-from-literal-native-landing-link;remaining-pagination-and-company-inventory-held',extractionStrategy:'current-own-PANW-publisher-literal-India-navigation;exact-Palo-Alto-Networks-India-Technologies-entity-or-exact-own-PANW-display-brand-with-legal-null;typed-India-and-same-JR-native-Apply;CyberArk-and-other-employers-held;two-pass-closing;valid-partial-records',parser:'custom-script',normalizationProfile:'engineering-default',backfillMode:'live-parser',scraperTimeoutMs:180000,authoritativeCurrentPublication:true,verifiedOn:null,verifiedPublicJobCount:null,verifiedIndiaJobCount:null,modulePath:path.join(dir,'script.js'),dryRunFile:path.join(dir,'jobs.json')}
export default PROVIDER_METADATA
export {PROVIDER_METADATA}
