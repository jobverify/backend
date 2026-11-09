import path from 'node:path'
import { fileURLToPath } from 'node:url'
const currentDir = path.dirname(fileURLToPath(import.meta.url))
export const SKAN_CATALOG = {
  source: 'skan', companyName: 'Skan', officialBrandName: 'Skan AI', exactCompanyMatchOnly: true,
  adapter: 'script', modulePath: path.resolve(currentDir, 'script.js'), dryRunFile: 'skan/jobs.json',
  companyCareerPage: 'https://www.skan.ai/careers', officialCareersPageUrl: 'https://www.skan.ai/careers',
  officialCurrentOpeningsPageUrl: 'https://www.skan.ai/current-openings', companyDomain: 'skan.ai',
  atsPlatform: 'keka', countryFilter: 'India', parser: 'custom-script', normalizationProfile: 'engineering-default',
  paginationStrategy: 'full-first-party-react-flight-inventory+visible-department-counts+native-active-api-crosscheck+all-confirmed-keka-details',
  extractionStrategy: 'fresh-first-party-job-payload+exact-keka-active-api-identities+native-publication-dates+all-location-scope+india-details',
  inventoryVerificationPolicy: 'live-parser-evidence-required', verifiedOn: '2026-10-23',
  verifiedPublicJobCount: null, verifiedIndiaJobCount: null,
  observedNativePublicJobCount: 64, observedIndiaCandidates: 16, officialEmbeddedCount: 65,
  sourceListingComplete: false, sourceScopeComplete: false, lifecycleCleanupAllowed: false,
  verifiedSurfaceSummary: 'Verified on 2026-10-23 that the official careers payload embeds 65 Keka roles across nine departments (32 initially visible; 17 explicitly India), while the exact-tenant public active API confirms only 64 roles and 16 explicit India roles. Embedded India role 42722 (Site Reliability Engineer (SRE) & Support) is absent from the active API and excluded as unconfirmed active, without asserting closure. Matched roles reconcile exact IDs, titles, departments and location labels before native detail verification. Native publishedOn timestamps supply postingDate with their original source values retained; the public client uses publishedSinceDays for dateofposting, corroborating publication semantics. The existing age gate leaves three of 16 India roles eligible as of 2026-10-23. Native country fields are preserved, including contradictory USA/Canada/United Kingdom labels with IN/India and London GB/Gabon; these conflicts and city-only labels never promote India coverage. Listing disagreement keeps discovery-only evidence, indiaFacetCount null and cleanup unauthorized. Each run reads fresh data; missing descriptions retain otherwise eligible jobs with incomplete detail health. Unknown empty contracts or changed identity/handoffs fail closed.',
}
export default SKAN_CATALOG
