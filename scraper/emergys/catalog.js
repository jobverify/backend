import path from 'node:path'
import {fileURLToPath} from 'node:url'
const currentDir=path.dirname(fileURLToPath(import.meta.url))
export const EMERGYS_CATALOG={source:'emergys',companyName:'Emergys',adapter:'script',companyDomain:'emergys.com',homepageUrl:'https://www.emergys.com/',companyCareerPage:'https://www.emergys.com/careers/',modulePath:path.join(currentDir,'script.js'),dryRunFile:path.join(currentDir,'jobs.json'),
 backfillMode:'live-parser',zeroResultPolicy:'coverage-gap',sourceScopeComplete:false,lifecycleCleanupAllowed:false,
 parser:'Existing firstPartyHTML collector with a bounded native WordPress role-page parser',countryFilter:'India',
 nativePostingDatePolicy:'Original Article.datePublished of the exact public role page,corroborated by WebPage.datePublished;not an explicit JobPosting.datePosted or first-ever requisition publication;edits and observations never refresh age',
 descriptionPolicy:'Complete authored role content preserved as native HTML;application forms and generic resume text excluded',
 locationPolicy:'Explicit written country in the authored job location;city-only country remains unresolved and separately retained as a gap',
 applicationLinkPolicy:'Public role-page fallback retained;no application endpoint or form actions',
 verifiedOn:null,verifiedAt:null,verifiedPublicJobCount:null,verifiedIndiaJobCount:null,verifiedInventoryStatus:'unverified',runtimeQualification:'awaiting-restricted-live-and-local-publishing-checks',
 verifiedSurfaceSummary:'Research retained15advertised native roles with full authored content and matching original Article/WebPage publication metadata. All page publications are old. Two explicitIndia workplace labels,oneUSA,and12country-unresolved labels;not zero openings. Current source/runtime/local publishing qualification pending;whole employer unknown;cleanup forbidden.'}
export default EMERGYS_CATALOG
