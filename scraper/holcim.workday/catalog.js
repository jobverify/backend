import path from 'node:path'
import {fileURLToPath} from 'node:url'
const currentDir=path.dirname(fileURLToPath(import.meta.url))
const PROVIDER_METADATA={...{
  "source": "holcim",
  "companyName": "Holcim",
  "adapter": "script",
  "catalogOverride": true,
  "atsPlatform": "successfactors-rmk",
  "parser": "shared-bounded-native-collector+existing-RMK-microdata-parser+declared-native-tile-contract",
  "normalizationProfile": "engineering-default",
  "companyDomain": "careers.holcimgroup.com",
  "companyCareerPage": "https://careers.holcimgroup.com/",
  "jobsBoardUrl": "https://careers.holcimgroup.com/search/",
  "countryFilter": "India",
  "paginationStrategy": "all25-row-native-tiles;declared-exact-query/category-scope;native-total/unique-ID-reconciliation;closing-firstpage-recheck",
  "extractionStrategy": "owned-native-portal;corporate-backlink/tenant/employer-binding;explicit-India-locations;native-full-description/requisition/post-date/application-validation",
  "backfillMode": "live-parser",
  "zeroResultPolicy": "coverage-gap",
  "sourceScopeComplete": false,
  "lifecycleCleanupAllowed": false,
  "originalModulePath": "../workbookbatch11b/failClosedSentinel.js",
  "originalAtsPlatform": "workbook-exact-name-sentinel",
  "originalAdapter": "script",
  "bindingEvidence": {
    "verified": true,
    "verifiedAt": "2026-10-23T01:28:49.278Z",
    "ownedNativePortal": "https://careers.holcimgroup.com/",
    "activeCorporateBacklink": "https://www.holcim.com/",
    "nativeTenant": "holcimgrou",
    "nativeEmployer": "HOLCIM Group",
    "nativeNamespace": null,
    "scriptsExecuted": false,
    "applicationsOpened": false
  },
  "verifiedOn": null,
  "verifiedAt": null,
  "verifiedPublicJobCount": null,
  "verifiedIndiaJobCount": null,
  "verifiedInventoryStatus": "unverified",
  "runtimeQualification": "actual-isolated-native-extraction-and-loopback-save-status-history-public-predicates-validated;positive-partial",
  "remediationStatus": "434global roles;17India listed;15GHBSdelegated;2parent-owned eligible/local saves;whole-employer/production unknown",
  "verifiedSurfaceSummary": "Actual isolated source attempt 2026-10-23T01:28:35.765Z to 2026-10-23T01:28:49.278Z retained22HTTP200 bodies;native pagination and closing recheck reconcile. Global434roles across18pages contain17India listings.15GHBS IDs exactly match the separately validated registered child source;parent publishes the remaining2HSSA roles. HSSA titles come from exact native document-head metadata,not invented visible headings or microdata titles. Existing publishing rules accept2jobs;local saves2,repeat0;experienced enabled2/disabled0. Native NaviMumbai labels preserved;existing public city filter Mumbai returns2. Prior inventory and complete-check clock/counts preserved. Ownedportal corporatebacklink,tenant holcimgrou and employer HOLCIM Group bind company identity;corporate403 retained separately. Whole-employer/legal/original-first-publication and production visibility remain unknown;cleanup forbidden.",
  "sourceScopeNotes": "One registered source owns each of17nativeIndia ads. GHBS namespace preserves child source/company;parent reports15delegated records and only publishes remaining2. Full native microdata descriptions retained,including AbouttheRole/DesiredProfile/JobPurpose sections;no fallback descriptions. Native post/expiry timestamps and distinct publicposting/requisition IDs preserved. HSSA document metadata supplies missing title while nativeMicrodata.title remainsnull. SourceNaviMumbai and existing storedMumbai labels retained separately without policy changes. No application,login,form,alert or script execution. No lifecycle cleanup.",
  "sourceOwnershipExclusions": [
    {
      "namespace": "holcim_ghbs",
      "source": "holcimglobalhubbusinessservices",
      "reason": "registered-native-business-unit-owner;avoid-duplicate-publication"
    }
  ],
  "inventoryDelegation": {
    "verified": true,
    "verifiedAt": "2026-10-23T01:30:33.230Z",
    "sources": [
      "holcimglobalhubbusinessservices"
    ],
    "preservesChildSourceAndCompany": true,
    "evidence": {
      "url": "https://careers.holcimgroup.com/holcim_ghbs/go/Job-at-Holcim-GHBS/8823002/",
      "artifact": "artifacts/full-catalog/holcim-family-native-091/trial-001/report.json",
      "sha256": "319283cb8058aa9c7d4ea0c722c64f09b467040976792d105692bc06e6f51efd"
    }
  },
  "verificationDisposition": "native-positive-partial;source-ownership-and-local-publication-validated;production-unknown",
  "sourceLatestLiveAttemptedAt": "2026-10-23T01:28:35.765Z",
  "sourceLatestLiveCompletedAt": "2026-10-23T01:28:49.278Z",
  "sourceLatestLiveOutcome": "positive-extraction-incomplete-evidence",
  "sourceLatestLiveNativeRawRoles": 434,
  "sourceLatestLivePages": 18,
  "sourceLatestLiveOwnedIndiaJobs": 2,
  "sourceLatestLiveEligibleJobs": 2,
  "sourceLatestLiveNativeFailures": 0,
  "sourceLatestLiveHTTP200Responses": 22,
  "sourceLatestLiveDelegatedGHBSJobs": 15,
  "localPersistenceSavedJobs": 2,
  "localPersistenceRepeatInserted": 0,
  "localVisibilityExperiencedEnabled": 2,
  "localVisibilityExperiencedDisabled": 0,
  "localCityVisibility": {
    "Mumbai": 2,
    "Navi Mumbai": 0,
    "Bangalore": 0,
    "Remote": 0
  }
},modulePath:path.join(currentDir,'script.js'),dryRunFile:path.join(currentDir,'jobs.json')}
export default PROVIDER_METADATA
export {PROVIDER_METADATA}
