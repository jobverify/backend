import path from 'node:path'
import {fileURLToPath} from 'node:url'
const dir=path.dirname(fileURLToPath(import.meta.url))
const PROVIDER_METADATA={source:'thales',companyName:'Thales',adapter:'script',atsPlatform:'workday',companyCareerPage:'https://careers.thalesgroup.com/global/en/',companyDomain:'careers.thalesgroup.com',countryFilter:'India',paginationStrategy:'bounded-first10-native-India-landing-SSR+literal-published-sitemap-role-URLs;remaining-pagination-company-inventory-held',extractionStrategy:'current-own-Thales-Phenom-context+robots-declared-sitemaps+literal-India-landing+same-R-native-Open-and-JobPosting+explicit-India+authored-same-R-application;paired-closing;valid-partials;all-original-dates-and-ambiguity-retained',parser:'custom-script',normalizationProfile:'engineering-default',backfillMode:'live-parser',scraperTimeoutMs:180000,authoritativeCurrentPublication:true,verifiedOn:null,verifiedPublicJobCount:null,verifiedIndiaJobCount:null,modulePath:path.join(dir,'script.js'),dryRunFile:path.join(dir,'jobs.json')}
export default PROVIDER_METADATA
export {PROVIDER_METADATA}
