import { fileURLToPath } from 'node:url'
export const CATALOG = {
  "source": "bito",
  "companyName": "Bito",
  "adapter": "script",
  "modulePath": fileURLToPath(new URL('./script.js', import.meta.url)),
  "companyCareerPage": "https://bito.ai/careers/",
  "companyDomain": "bito.ai",
  "atsPlatform": "freshteam",
  "countryFilter": "India",
  "parser": "custom-script",
  "normalizationProfile": "engineering-default",
  "zeroResultPolicy": "evidence-required",
  "paginationStrategy": "whole-public-widget-feed+native-board+closing-all-role-reconciliation",
  "extractionStrategy": "verified-employer-widget+native-full-role-documents+explicit-work-country+publication-and-application-identity",
  "verifiedOn": "2026-10-26",
  "verifiedPublicPostingCount": null,
  "verifiedIndiaRoleCount": null,
  "verifiedSurfaceSummary": "Current normal public Bito careers navigation activates its declared Rocket/Freshteam widget and renders the first widget on all four breakpoints. Read the entire public native jobs feed, corresponding native board and all full public role documents twice before caps. Verify employer, native numeric/opaque identity, full description, actual datePosted and application form; do not substitute internal created_at or use posting IDs as requisitions. Current one remote role has explicit preferred USA locations while its structured job country and office say India; retain this conflict and partial inventory rather than inventing an India vacancy or certifying India absence. Unknown fields/countries, additional hiring scopes, client drift, expiry and closing changes retain partial scope."
}
export default CATALOG
