import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

const PROVIDER_METADATA = {
  "source": "tricog",
  "companyName": "Tricog",
  "adapter": "script",
  "modulePath": path.join(currentDir, 'script.js'),
  "companyCareerPage": "https://tricog.com/careers/",
  "atsPlatform": "verified-first-party-resume-intake-surface",
  "paginationStrategy": "fail-closed-resume-intake-only-surface",
  "extractionStrategy": "verified-first-party-careers-surface+resume-intake-only-without-public-openings+fail-closed",
  "verifiedOn": "2026-07-25",
  "verifiedSurfaceSummary": "Verified on Saturday, July 25, 2026 that https://tricog.com/careers/ was the live Tricog public careers surface. The verified page exposed a Share your resume flow and Job Application Form, but no trustworthy public openings inventory. This provider returns no jobs while that resume-intake-only contract remains unchanged.",
  "dryRunFile": path.join(currentDir, 'jobs.json'),
  "backfillMode": "live-copy",
  "originalAdapter": "script",
  "originalAtsPlatform": "verified-first-party-resume-intake-surface",
  "originalModulePath": "../workbookbatch05/tricog.js",
  "originalDryRunFile": null
}

export default PROVIDER_METADATA
export { PROVIDER_METADATA }
