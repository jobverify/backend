import path from 'node:path'
import {fileURLToPath} from 'node:url'
const currentDir=path.dirname(fileURLToPath(import.meta.url))
export const VERIFIED_SURFACE_SUMMARY='Pairs the current own Nihilent homepage, careers handoff and public openings page. Exact own native accordion role titles, whole workplaces, original criteria and same-card published job-selection name plus same-page resume intake are retained. Literal Pan India or exact whole Pune alternatives with independent district-government proof qualify India; ambiguous and foreign-only workplaces stay held. No native public job ID or formal requisition is invented. Every role remains partial: legal employing entity, company-wide/all-channel inventory, full form controls, autofill/backend activation and cleanup remain unverified.'
export const NIHILENT_CATALOG={
 source:'nihilent',companyName:'Nihilent',officialBrandName:'Nihilent',adapter:'script',modulePath:path.resolve(currentDir,'script.js'),
 homepageUrl:'https://www.nihilent.com/',companyCareerPage:'https://www.nihilent.com/careers/',officialCareersPageUrl:'https://www.nihilent.com/job-openings/',companyDomain:'nihilent.com',
 atsPlatform:'first-party-current-native-accordion-and-public-job-selection-intake',countryFilter:'India',parser:'custom-script',normalizationProfile:'engineering-default',
 authoritativeCurrentPublication:true,backfillMode:'live-parser',scraperTimeoutMs:180000,verifiedOn:null,verifiedJobCount:null,verifiedIndiaJobCount:null,
 paginationStrategy:'independently-paired-own-current-native-openings-surface;company-allchannels-unverified',
 extractionStrategy:'current-own-publisher-careers-handoff-and-whole-native-role-record;independent-municipal-geography;public-role-selection-intake;all-original-criteria-and-dates-as-partials',
 verifiedSurfaceSummary:VERIFIED_SURFACE_SUMMARY,zeroResultPolicy:'evidence-required',dryRunFile:'nihilent/jobs.json'
}
export default NIHILENT_CATALOG
