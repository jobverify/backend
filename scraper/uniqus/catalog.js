import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

const PROVIDER_METADATA = {
  "source": "uniqus",
  "companyName": "Uniqus",
  "adapter": "script",
  "modulePath": path.join(currentDir, 'script.js'),
  "companyCareerPage": "https://uniqus.com/careers/",
  "atsPlatform": "verified-first-party-email-handoff-surface",
  "paginationStrategy": "single-first-party-careers-page",
  "extractionStrategy": "verified-first-party-careers-surface+email-invitation-without-first-party-openings+fail-closed",
  "verifiedOn": "2026-07-25",
  "verifiedSurfaceSummary": "Verified on Saturday, July 25, 2026 that https://uniqus.com/careers/ was the live Uniqus public careers surface. The verified page invited candidates to write to careers@uniqus.com and exposed a View Opportunities call to action, but no verified same-origin public openings inventory was confirmed. This provider remains fail-closed until a trustworthy public openings surface is verified.",
  "dryRunFile": path.join(currentDir, 'jobs.json'),
  "backfillMode": "live-copy",
  "originalAdapter": "script",
  "originalAtsPlatform": "verified-first-party-email-handoff-surface",
  "originalModulePath": "../workbookbatch05/uniqus.js",
  "originalDryRunFile": null
}

export default PROVIDER_METADATA
export { PROVIDER_METADATA }
