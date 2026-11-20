import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

const PROVIDER_METADATA = {
  "source": "bayer",
  "companyName": "Bayer",
  "adapter": "script",
  "atsPlatform": "first-party-current-native-Paradox-server-publication",
  "companyCareerPage": "https://jobs.bayer.com/",
  "companyDomain": "jobs.bayer.com",
  "countryFilter": "India",
  "paginationStrategy": "current-literal-public-Next-links-bounded25pages-two-observations;other-channels-company-inventory-held",
  "extractionStrategy": "current-own-Bayer-publisher-Organization+active-original-native-model+matching-current-visible-SSR+typed-India+literal-same-requisition-standard-and-separate-chat-handoffs;optional-paired-native-role-criteria;all-original-dates-and-variants;valid-partials;corporate-India-unavailable-legal-entity-renderer-backend-cleanup-held",
  "parser": "custom-script",
  "normalizationProfile": "engineering-default",
  "verifiedOn": null,
  "verifiedPublicJobCount": null,
  "verifiedIndiaJobCount": null,
  "verificationDisposition": "current-native-publication-assessment-required",
  "verifiedSurfaceSummary": "Own current Bayer native SSR and paired typed India role publication only; current corporate India403 unavailable and never retried. Legal entity, renderer/ATS/chat activation, other channels/company inventory and cleanup unverified.",
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
