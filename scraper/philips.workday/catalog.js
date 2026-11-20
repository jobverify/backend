import path from 'node:path'
import {fileURLToPath} from 'node:url'
const dir=path.dirname(fileURLToPath(import.meta.url))
const PROVIDER_METADATA={source:'philips',companyName:'Philips',adapter:'script',atsPlatform:'workday',companyCareerPage:'https://www.careers.philips.com/in/en/home',companyDomain:'www.careers.philips.com',countryFilter:'India',paginationStrategy:'bounded-first10-native-India-SSR+literal-current-own-XML-role-URLs;remaining-pagination-company-inventory-held',extractionStrategy:'current-own-Philips-Phenom-context+declared-India-GET-search+literal-own-public-sitemap-role-URLs+same-native-ID-active-public-JobPosting+explicit-India+authored-application;paired-closing;valid-partials;all-original-dates-and-classification-ambiguities-retained',parser:'custom-script',normalizationProfile:'engineering-default',backfillMode:'live-parser',scraperTimeoutMs:180000,authoritativeCurrentPublication:true,verifiedOn:null,verifiedPublicJobCount:null,verifiedIndiaJobCount:null,modulePath:path.join(dir,'script.js'),dryRunFile:path.join(dir,'jobs.json')}
export default PROVIDER_METADATA
export {PROVIDER_METADATA}
