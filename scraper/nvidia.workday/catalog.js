import path from 'node:path'
import {fileURLToPath} from 'node:url'
const dir=path.dirname(fileURLToPath(import.meta.url))
const PROVIDER_METADATA={source:'nvidia',companyName:'NVIDIA',adapter:'script',atsPlatform:'workday',companyCareerPage:'https://www.nvidia.com/en-us/about-nvidia/careers/',companyDomain:'nvidia.com',countryFilter:'India',paginationStrategy:'bounded-first10-current-native-India-location-query;every-returned-role-independently-qualified;remaining-inventory-held',extractionStrategy:'own-corporate-careers-delegation;current-native-GET-query-and-external-link-action-programmes;exact-NVIDIA-Corporation-own-role-India-workplace-and-same-JR-application-models;two-pass-closing;explicit-partial-records',parser:'custom-script',normalizationProfile:'engineering-default',backfillMode:'live-parser',scraperTimeoutMs:180000,authoritativeCurrentPublication:true,verifiedOn:null,verifiedPublicJobCount:null,verifiedIndiaJobCount:null,modulePath:path.join(dir,'script.js'),dryRunFile:path.join(dir,'jobs.json')}
export default PROVIDER_METADATA
export {PROVIDER_METADATA}
