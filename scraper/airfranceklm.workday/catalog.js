import path from 'node:path'
import {fileURLToPath} from 'node:url'
const currentDir=path.dirname(fileURLToPath(import.meta.url))
const PROVIDER_METADATA={
 source:'airfranceklm',companyName:'Air France-KLM',companyDomain:'airfranceklm.com',
 companyCareerPage:'https://recrutement.airfrance.com/accueil.aspx?lcid=2057',
 officialHomepageUrl:'https://www.airfranceklm.com/',adapter:'script',countryFilter:'India',
 atsPlatform:'talentsoft-visible-native-context',parser:'custom-script',normalizationProfile:'engineering-default',
 paginationStrategy:'bounded-literal-listing-and-details;pagination-retained-unfollowed',
 extractionStrategy:'literal-English-French-native-role-links+reference-title-reconciliation+full-visible-criteria+typed-native-country',
 modulePath:path.join(currentDir,'script.js'),dryRunFile:path.join(currentDir,'jobs.json'),backfillMode:'workday',
 verifiedOn:null,verifiedPublicJobCount:null,verifiedIndiaJobCount:null,
 verificationDisposition:'partial-native-publisher-context;exact-employer-and-company-scope-unverified',
 verifiedSurfaceSummary:'Reads the configured public document, a current literal all-vacancies listing and at most five literal full details. Mixed-publisher listing totals and shared group prose do not establish exact employer ownership, company inventory or India completeness.',
 zeroResultPolicy:'evidence-required',sourceScopeComplete:false,lifecycleCleanupAllowed:false,
}
export default PROVIDER_METADATA
export {PROVIDER_METADATA}
