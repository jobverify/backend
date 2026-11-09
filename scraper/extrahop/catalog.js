import path from 'node:path'
import { fileURLToPath } from 'node:url'
const currentDir=path.dirname(fileURLToPath(import.meta.url))
export const PROVIDER_METADATA={...{
  "source": "extrahop",
  "companyName": "ExtraHop",
  "companyDomain": "extrahop.com",
  "adapter": "script",
  "catalogOverride": true,
  "modulePath": "../extrahop/script.js",
  "dryRunFile": "extrahop/jobs.json",
  "atsPlatform": "greenhouse-native-public-api",
  "boardToken": "extrahopnetworks",
  "companyCareerPage": "https://www.extrahop.com/careers",
  "jobsBoardUrl": "https://job-boards.greenhouse.io/extrahopnetworks",
  "countryFilter": "India",
  "parser": "extrahop-current-corporate-native-full-content-20261027",
  "normalizationProfile": "engineering-default",
  "paginationStrategy": "all-current-native-pages-before-caps;opening-and-closing-board-api-office-and-corporate-inventories",
  "extractionStrategy": "current-corporate-all-advertised-locales-and-hiring-channels;full-public-content;exact-post-internal-requisition-identities;explicit-worksite-countries",
  "sourceScopeComplete": null,
  "lifecycleCleanupAllowed": false,
  "zeroResultPolicy": "evidence-required",
  "runtimeInventoryVerification": false,
  "verifiedPublicJobCount": null,
  "verifiedIndiaJobCount": null,
  "verifiedAt": null,
  "verifiedOn": null,
  "backfillMode": "source-local-current-native-extraction",
  "sourceScopeNotes": "Each runtime independently verifies corporate handoff, all advertised corporate locales/hiring channels, complete native pages and API content, every primary and secondary worksite against the current native office graph, original publication and expiry, closing role and inventory states. Unknown country/fields, drift or denial retain unknown totals and disable cleanup. Catalog metadata never grants or permanently prevents completeness. Public GET only; no application or persistence actions."
},modulePath:path.join(currentDir,'script.js'),dryRunFile:path.join(currentDir,'jobs.json')}
export default PROVIDER_METADATA
