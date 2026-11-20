import path from 'node:path'
import {fileURLToPath} from 'node:url'
const dir=path.dirname(fileURLToPath(import.meta.url))
const PROVIDER_METADATA={source:'dxc',companyName:'DXC Technology',adapter:'script',atsPlatform:'workday',companyCareerPage:'https://careers.dxc.com/',companyDomain:'careers.dxc.com',countryFilter:'India',paginationStrategy:'bounded-current-own-homepage-native-vacancy-cards;dynamic-global-search-and-remaining-company-inventory-held',extractionStrategy:'current-own-DXC-prod-account+literal-active-home-cards+same-native-job-and-JobPosting+explicit-India+original-same-reference-application;two-pass-closing;valid-partials;formal-requisition-legal-entity-and-renderer-backend-unverified',parser:'custom-script',normalizationProfile:'engineering-default',backfillMode:'live-parser',scraperTimeoutMs:180000,authoritativeCurrentPublication:true,verifiedOn:null,verifiedPublicJobCount:null,verifiedIndiaJobCount:null,modulePath:path.join(dir,'script.js'),dryRunFile:path.join(dir,'jobs.json')}
export default PROVIDER_METADATA
export {PROVIDER_METADATA}
