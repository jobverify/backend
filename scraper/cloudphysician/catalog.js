import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

const PROVIDER_METADATA = {
  "source": "cloudphysician",
  "companyName": "Cloudphysician",
  "adapter": "script",
  "modulePath": path.join(currentDir, 'script.js'),
  "dryRunFile": path.join(currentDir, 'jobs.json'),
  "atsPlatform": "verified-first-party-careers-surface-with-dead-same-origin-jd-handoffs",
  "companyCareerPage": "https://www.cloudphysician.net/careers/",
  "companyDomain": "cloudphysician.net",
  "countryFilter": "India",
  "paginationStrategy": "fail-closed-sentinel",
  "extractionStrategy": "verified-first-party-careers-surface+dead-same-origin-jd-handoffs+mailto-sentinel",
  "parser": "custom-script",
  "normalizationProfile": "engineering-default",
  "verifiedOn": "2026-07-25",
  "verificationDisposition": "no-trustworthy-exact-name-public-jobs-flow-verified-locally",
  "verifiedPublicJobCount": 0,
  "verifiedIndiaJobCount": 0,
  "verifiedSurfaceSummary": "Verified on Sunday, July 26, 2026 that https://www.cloudphysician.net/careers/ was the live exact-company Cloudphysician careers page, that its Apply now CTA pointed to mailto:careers@cloudphysician.net, and that it publicly enumerated 17 role titles across Clinical, Technology, Business, and Business Enablers. Each currently linked first-party JD handoff under https://www.cloudphysician.net/careers/assets/jds/ returned 404 instead of a trustworthy role-details or application flow, so no trustworthy enumerable public jobs contract was verified and this company-local scraper stays fail-closed until Cloudphysician exposes a stable first-party openings surface.",
  "backfillMode": "live-copy",
  "originalAdapter": "script",
  "originalAtsPlatform": "verified-first-party-careers-surface-with-dead-same-origin-jd-handoffs",
  "originalModulePath": "../workbookbatch06/cloudphysician.js",
  "originalDryRunFile": "C:\\Users\\mohv\\GitHub\\jobverify_Release_26.07.04\\jobverify-backend\\scraper\\workbookbatch06\\cloudphysician.jobs.json"
}

export default PROVIDER_METADATA
export { PROVIDER_METADATA }
