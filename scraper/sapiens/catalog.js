import { fileURLToPath } from 'node:url'
export const NATIVE_CONFIG = {
  "source": "sapiens",
  "company": "Sapiens",
  "domain": "sapiens.com",
  "careers": "https://sapiens.com/careers/",
  "board": "https://sapiens.careers.hibob.com/",
  "redirectHandoff": true
}
export const LEGACY_CATALOG = {
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


export const CATALOG = {
  ...LEGACY_CATALOG,
  modulePath: fileURLToPath(new URL('./nativeData20261115.js', import.meta.url)),
  "parser": "runtime-native-data-20261115",
  "paginationStrategy": "whole-current-feed;two-native-india-criteria-and-intake-pairs;seven-whole-opening-closing-bodies",
  "extractionStrategy": "typed-live-native-feed-and-form;whole-current-closure;criteria-and-intake-as-data-only",
  "verifiedOn": null,
  "verifiedPublicPostingCount": null,
  "verifiedIndiaRoleCount": null,
  "firstParty": false,
  "sourceCorporateBindingQualified": false,
  "formalLegalEmployerQualified": false,
  "sourceActivationComplete": false,
  "sourceRenderedCriteriaComplete": false,
  "sourceApplicationQualificationComplete": false,
  "sourceScopeComplete": false,
  "sourceListingComplete": false,
  "lifecycleCleanupAllowed": false,
  "verifiedSurfaceSummary": "Own Sapiens public HiBob tenant and exact native protocol/configuration expose complete live24-field feed records plus two distinct native India forms, each with full actual intake and supported original rich criteria. Select the first two safe native India records without fixing example counts, role UUIDs or business values forever. All seven whole current original bodies must independently close within the existing source bounds. Full raw form metadata is reference evidence; companyLists are lookup options, not additional screening requirements. Preserve six-fraction publishedAt and omitted/null fields. Static public role landings identify actual200 source routes only. Current corporate/formallegal/program/CSS/rendered/application/company scope and cleanup remain unqualified; all action and canonical URLs stay null.",
}
export default CATALOG
