import { fileURLToPath } from 'node:url'
export const NATIVE_CONFIG = {
  "source": "sapiens",
  "company": "Sapiens",
  "domain": "sapiens.com",
  "careers": "https://sapiens.com/careers/",
  "board": "https://sapiens.careers.hibob.com/",
  "redirectHandoff": true
}
export const CATALOG = {
  "source": "sapiens",
  "companyName": "Sapiens",
  "adapter": "script",
  "modulePath": fileURLToPath(new URL('./script.js', import.meta.url)),
  "companyCareerPage": "https://sapiens.com/careers/",
  "companyDomain": "sapiens.com",
  "atsPlatform": "hibob",
  "countryFilter": "India",
  "parser": "custom-script",
  "normalizationProfile": "engineering-default",
  "zeroResultPolicy": "evidence-required",
  "paginationStrategy": "current-public-hibob-entire-feed+closing-feed-reconciliation",
  "extractionStrategy": "first-party-handoff+bound-public-tenant-header+native-full-sections+typed-country+public-role-document",
  "verifiedOn": "2026-10-26",
  "verifiedPublicPostingCount": null,
  "verifiedIndiaRoleCount": null,
  "verifiedSurfaceSummary": "Current public HiBob API requires the public companyIdentifier tenant-routing header used by its anonymous client. Verify employer binding, current client contract, every feed row and native country/filter identity, complete role sections, original publishedAt with nanosecond precision provenance, actual expiry if supplied and separate public application-form definitions for India roles. Reconcile all feeds, employer configuration and India role documents before caps. Preserve unknown city and requisition; unknown countries, hidden/incomplete content, other active hiring scopes, schema/pagination drift or closing changes retain partial evidence."
}
export default CATALOG
