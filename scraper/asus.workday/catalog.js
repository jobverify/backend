import path from 'node:path'
import {fileURLToPath} from 'node:url'
const currentDir=path.dirname(fileURLToPath(import.meta.url))
export const ASUS_CATALOG={
  "source": "asus",
  "companyName": "Asus",
  "adapter": "script",
  "atsPlatform": "first-party-nuxt-regional-directory-and-jobvite-native-html",
  "countryFilter": "India",
  "paginationStrategy": "all-observed-declared-US-postings-and-paired-native-company-routing;other-regions-unresolved",
  "extractionStrategy": "full-native-SSR-reference-graph+declared-US-Jobvite+own-posting-ID-employer-country+full-visible-and-structured-main/supplemental-criteria",
  "parser": "live-parser",
  "normalizationProfile": "engineering-default",
  "catalogOverride": true,
  "companyCareerPage": "https://careers.asus.com/",
  "officialHomepageUrl": "https://www.asus.com/",
  "companyDomain": "asus.com",
  "verifiedOn": null,
  "verifiedPublicJobCount": null,
  "verifiedIndiaJobCount": null,
  "backfillMode": null,
  "runtimeValidation": null,
  "verifiedAt": null,
  "bindingEvidence": null,
  "sourceScopeComplete": false,
  "sourceListingComplete": false,
  "lifecycleCleanupAllowed": false,
  "zeroResultPolicy": "evidence-required",
  "verificationDisposition": "native-US-regional-extraction;India-and-other-regions-unresolved",
  "verifiedSurfaceSummary": "The current ASUS SSR careers directory declares14 regional hiring routes and4 occupational families;neither are vacancies or authoritative totals. Its exact US Jobvite handoff supplies all28 observed native posting models with own employer/country/ID/date and complete main/supplemental hiring criteria. India routing and thirteen other regional routes remain unresolved/unvisited. All originals and models survive selection,caps and failures. No application,rendered-visibility,whole-company,India-zero or cleanup authority is asserted."
}
ASUS_CATALOG.modulePath=path.join(currentDir,'script.js')
ASUS_CATALOG.dryRunFile=path.join(currentDir,'jobs.json')
export const PROVIDER_METADATA=ASUS_CATALOG
export default ASUS_CATALOG
