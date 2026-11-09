import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

const PROVIDER_METADATA = {
  "source": "bestexresearch",
  "companyName": "BestEx Research",
  "adapter": "script",
  "modulePath": path.join(currentDir, 'script.js'),
  "dryRunFile": path.join(currentDir, 'jobs.json'),
  "companyCareerPage": "https://www.bestexresearch.com/careers",
  "companyDomain": "bestexresearch.com",
  "officialHomepageUrl": "https://www.bestexresearch.com/",
  "atsPlatform": "workable-native-api",
  "boardToken": "bestex-research",
  "accountUid": "15159d62-62e0-4df7-a2f4-f3d7d33855e5",
  "countryFilter": "India",
  "paginationStrategy": "native-workable-stable-total-and-terminal-cursor-reconciliation",
  "extractionStrategy": "official-widget-account540348-and-native-canonical-binding+complete-workable-inventory+full-india-job-details",
  "parser": "custom-script",
  "normalizationProfile": "engineering-default",
  "verifiedOn": null,
  "verifiedPublicJobCount": null,
  "verifiedIndiaJobCount": null,
  "zeroResultPolicy": "evidence-required",
  "verifiedSurfaceSummary": "The current corporate careers page embeds Workable account540348. The exact linked native shortcode3B47AFBD68 declares canonical tenant bestex-research and API account UUID15159d62-62e0-4df7-a2f4-f3d7d33855e5. That role has full unified description with empty separate requirements/benefits; other roles retain their provided nonempty sections. Current runtime counts remain in extraction and persistence evidence.",
  "bindingEvidence": {
    "verified": true,
    "checkedAt": "2026-10-20T21:04:00.055Z",
    "officialURL": "https://www.bestexresearch.com/careers",
    "evidenceOrigin": "official-linked-workable-embed-and-native-canonical-shortcode",
    "matchedLinks": ["https://www.workable.com/assets/embed.js", "https://apply.workable.com/j/3B47AFBD68", "https://apply.workable.com/bestex-research/j/3B47AFBD68"],
    "discoveryArtifact": "../artifacts/full-catalog/official-discovery/batch-011.json",
    "discoverySha256": "57767ddf212dc84b0a99dd239dbb97ab0234b2ffcbd118d42c86efaa0250a192"
  },
  "backfillMode": "live-parser",
  "originalAdapter": "script",
  "originalAtsPlatform": "workbook-exact-name-sentinel",
  "originalModulePath": "../workbookbatch08/failClosedSentinel.js",
  "originalDryRunFile": "C:\\Users\\mohv\\GitHub\\jobverify_Release_26.07.04\\jobverify-backend\\scraper\\workbookbatch08\\bestexresearch.jobs.json"
}

export default PROVIDER_METADATA
export { PROVIDER_METADATA }
