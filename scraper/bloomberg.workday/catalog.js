import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

const PROVIDER_METADATA = {
  "source": "bloomberg",
  "companyName": "Bloomberg",
  "adapter": "script",
  "atsPlatform": "current-own-native-Avature-public-form-and-server-publication",
  "companyCareerPage": "https://bloomberg.avature.net/careers/SearchJobs",
  "companyDomain": "bloomberg.avature.net",
  "countryFilter": "India",
  "paginationStrategy": "current-literal-anonymous-native-search-form+302-keyword-query+own-Next-links-bounded10pages-two-observations;query-not-India-facet-company-scope-held",
  "extractionStrategy": "own-current-Bloomberg-Avature-account-and-publisher+current-form-controls+declared-redirect+matching-visible-native-publicID-title-whole-India-workplace-Apply-handoff;optional-paired-same-role-canonical-criteria-reference-and-same-publicID-Login-URI;all-authored-dates-criteria-variants;valid-partials;formal-requisition-legal-entity-Login-backend-company-cleanup-held",
  "parser": "custom-script",
  "normalizationProfile": "engineering-default",
  "verifiedOn": null,
  "verifiedPublicJobCount": null,
  "verifiedIndiaJobCount": null,
  "verificationDisposition": "current-native-publication-assessment-required",
  "verifiedSurfaceSummary": "Current own native anonymous search form and declared keyword publication with explicit whole India workplaces and exact publicID role/application handoffs. Native labelled Ref# is separate from publicID; formal requisition and legal employer unproven. Native dates remain unavailable when unauthored; Login/backend, company/all-channel inventory and cleanup held.",
  "backfillMode": "live-parser",
  "scraperTimeoutMs": 180000,
  "authoritativeCurrentPublication": true,
  "sourceScopeComplete": false,
  "lifecycleCleanupAllowed": false,
  "modulePath": path.join(currentDir, 'script.js'),
  "dryRunFile": path.join(currentDir, 'jobs.json')
}

export default PROVIDER_METADATA
export { PROVIDER_METADATA }
