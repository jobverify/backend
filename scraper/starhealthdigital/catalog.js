import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

const PROVIDER_METADATA = {
  "source": "starhealthdigital",
  "companyName": "StarHealth Digital",
  "adapter": "script",
  "modulePath": path.join(currentDir, 'script.js'),
  "companyCareerPage": "https://www.starhealth.in/careers/",
  "atsPlatform": "verified-non-enumerable-careers-cta",
  "paginationStrategy": "single-first-party-careers-page",
  "extractionStrategy": "verified-first-party-careers-page+non-enumerable-cta-without-public-openings+fail-closed",
  "verifiedOn": "2026-07-25",
  "verifiedSurfaceSummary": "Verified on Saturday, July 25, 2026 that https://www.starhealth.in/careers/ was the live Star Health careers surface and that it exposed the \"Explore job opportunities\" call to action alongside verified hero copy, but no trustworthy first-party public listings surface. This provider returns no jobs unless that contract changes and a stable openings feed becomes publicly enumerable.",
  "dryRunFile": path.join(currentDir, 'jobs.json'),
  "backfillMode": "live-copy",
  "originalAdapter": "script",
  "originalAtsPlatform": "verified-non-enumerable-careers-cta",
  "originalModulePath": "../workbookbatch05/starhealthdigital.js",
  "originalDryRunFile": null
}

export default PROVIDER_METADATA
export { PROVIDER_METADATA }
