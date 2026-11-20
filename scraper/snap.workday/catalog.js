import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

const PROVIDER_METADATA = {
  "source": "snap",
  "companyName": "Snap",
  "adapter": "script",
  "officialBrandName": "Snap",
  "homepageUrl": "https://careers.snap.com/",
  "companyCareerPage": "https://careers.snap.com/jobs",
  "companyDomain": "snap.com",
  "atsPlatform": "current-own-native-Snap-publication-with-declared-Workday-handoffs",
  "countryFilter": "India",
  "paginationStrategy": "independently-paired-own-current-native-cache-and-actual-table-rows;optional-own-per-ID-detail-models;company-allchannels-unverified",
  "extractionStrategy": "current-own-publisher-handoff-and-unconditional-literal-cache;native-external-posting-exact-employer-ID-title-office-country-and-own-row;declared-same-ID-application;streamed-native-criteria-as-unreviewed-partials",
  "parser": "custom-script",
  "normalizationProfile": "engineering-default",
  "authoritativeCurrentPublication": true,
  "scraperTimeoutMs": 180000,
  "verifiedOn": null,
  "verifiedPublicJobCount": null,
  "verifiedJobCount": null,
  "verifiedIndiaJobCount": null,
  "verificationDisposition": "current-own-published-India-partials-company-inventory-and-activation-unverified",
  "verifiedSurfaceSummary": "Pairs the current own Snap careers homepage, jobs table and original literal native cache records. Exact native External_Posting, jobPostingSite Snap Inc., public ID, title and every whole office workplace are qualified; literal India in a same-role office qualifies country without HQ or defaults. Optional own per-ID models retain full original criteria, actual same-ID declared Apply URL and both observations. React streamed hidden controls and criteria remain unreviewed partials with no rendering or activation claim. Native public IDs, including R-prefixed strings, do not imply formal requisitions. Native startDate/lastUpdateDateTime/cache expiry retain unasserted date semantics; recognized explicitly authored posting/expiry dates are preserved. No delegated ATS requests, alias to snapinc, parent/subsidiary relabelling, legal-employer assertion, company/allchannel/facet totals or lifecycle replacement.",
  "backfillMode": "live-parser",
  "zeroResultPolicy": "evidence-required",
  "modulePath": path.join(currentDir, 'script.js'),
  "dryRunFile": path.join(currentDir, 'jobs.json')
}

export default PROVIDER_METADATA
export { PROVIDER_METADATA }
