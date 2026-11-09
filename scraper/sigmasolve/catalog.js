import path from 'node:path'
import {fileURLToPath} from 'node:url'
const currentDir=path.dirname(fileURLToPath(import.meta.url))
export const SIGMA_SOLVE_CATALOG={...{
  "source": "sigmasolve",
  "companyName": "Sigma Solve",
  "officialBrandName": "Sigma Solve",
  "adapter": "script",
  "catalogOverride": true,
  "atsPlatform": "official-company-careers",
  "countryFilter": "Global",
  "companyCareerPage": "https://www.sigmasolve.com/who-we-are/openings",
  "officialCareersPageUrl": "https://www.sigmasolve.com/who-we-are/openings",
  "officialHomepageUrl": "https://www.sigmasolve.com/",
  "companyDomain": "sigmasolve.com",
  "parser": "live-parser",
  "normalizationProfile": "engineering-default",
  "paginationStrategy": "complete-current-active-native-cards-and-paired-own-role-HTML-before-selection-and-caps",
  "extractionStrategy": "all-original-role-header-fields-and-full-own-criteria;paired-native-publisher-canonical-cohort-location-and-employment-proof",
  "scraperTimeoutMs": 900000,
  "backfillMode": null,
  "verifiedOn": null,
  "verifiedAt": null,
  "verifiedPublicJobCount": null,
  "verifiedIndiaJobCount": null,
  "verifiedInventoryStatus": "unverified",
  "zeroResultPolicy": "evidence-required",
  "sourceScopeComplete": false,
  "lifecycleCleanupAllowed": false,
  "verificationDisposition": "native-full-criteria-and-country-observations;no-unqualified-company-India-zero-hiring-applications-or-persistence",
  "remediationStatus": "native-full-criteria-and-original-metadata-implemented;fresh-source-qualification-required",
  "verifiedSurfaceSummary": "Preserve complete original server-rendered job header fields, full own visible criteria, exact outer HTML, head metadata and raw public responses. Reconcile current native listing and own role models before observers, country selection and caps. URL slugs are observation keys, not invented posting/requisition IDs. Missing native workplace and dates remain unknown. An application link is retained without requesting its endpoint. Source/company/India-zero scope, actual hiring, application activation, persistence and public visibility stay unqualified.",
  "runtimeValidation": {
    "checkedAt": null,
    "outcome": "fresh-registered-native-publication-and-full-criteria-verification-required",
    "sourceScopeComplete": false,
    "lifecycleCleanupAllowed": false
  }
},modulePath:path.join(currentDir,'script.js'),dryRunFile:path.join(currentDir,'jobs.json')}
export default SIGMA_SOLVE_CATALOG
