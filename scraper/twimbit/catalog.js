import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

const PROVIDER_METADATA = {
  "source": "twimbit",
  "companyName": "Twimbit",
  "adapter": "script",
  "modulePath": path.join(currentDir, 'script.js'),
  "companyCareerPage": "https://twimbit.com/careers",
  "atsPlatform": "verified-public-careers-detail-pages",
  "paginationStrategy": "single-verified-public-openings-surface+same-origin-detail-pages",
  "extractionStrategy": "verified-exact-name-public-openings-surface+same-origin-about-careers-detail-pages+india-filter+verified-external-apply-link",
  "verifiedOn": "2026-07-25",
  "verifiedSurfaceSummary": "Verified on Saturday, July 25, 2026 that https://twimbit.com/careers was the live first-party Twimbit careers surface and exposed same-origin /about-careers/ role detail pages. The batch parser discovers those details, emits only roles whose detail page explicitly identifies India, and permits a public external Apply Now URL only when it is linked from the verified Twimbit detail page; it returns no jobs when this narrow contract is absent.",
  "dryRunFile": path.join(currentDir, 'jobs.json'),
  "backfillMode": "live-copy",
  "originalAdapter": "script",
  "originalAtsPlatform": "verified-public-careers-detail-pages",
  "originalModulePath": "../workbookbatch05/twimbit.js",
  "originalDryRunFile": null
}

export default PROVIDER_METADATA
export { PROVIDER_METADATA }
