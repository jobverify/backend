import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SETU_CATALOG = {
  "source": "setu",
  "companyName": "Setu",
  "officialBrandName": "BrokenTusk Technologies Pvt. Ltd.",
  "adapter": "script",
  "companyCareerPage": "https://setu.co/careers/",
  "officialCareersPageUrl": "https://setu.co/careers/",
  "currentOpeningsCsvUrl": "https://raw.githubusercontent.com/SetuHQ/website-content/refs/heads/main/careers/Setu%20Website%20-%20CurrentOpenings.csv",
  "categoryDescriptionsCsvUrl": "https://raw.githubusercontent.com/SetuHQ/website-content/refs/heads/main/careers/Setu%20Website%20-%20CategoryDescriptions.csv",
  "companyDomain": "setu.co",
  "atsPlatform": "first-party-careers-plus-turbohire-links",
  "countryFilter": "India",
  "paginationStrategy": "complete-first-party-inline-role-links",
  "extractionStrategy": "verified-first-party-framer-careers+exact-linked-turbohire-role+public-detail",
  "parser": "custom-script",
  "normalizationProfile": "engineering-default",
  "verifiedOn": "2026-09-13",
  "verifiedSurfaceSummary": "Verified September 13, 2026: https://setu.co/careers/ now serves a Framer careers page titled Careers at Setu - Fintech Jobs in India. Its Open roles section links one unique Manager - Customer Success position to https://pinelabsgroup.turbohire.co/get/bG9zTFJ; duplicate responsive links are reconciled, and the public detail explicitly describes Setu. The current page no longer uses the historical GitHub CSV inventory. Malformed or conflicting role cards fail closed and caller-limited positive snapshots disable lifecycle reconciliation.",
  "dryRunFile": "setu/jobs.json",
  "verifiedPublicJobCount": 1,
  "verifiedIndiaJobCount": 1,
  modulePath: path.join(currentDir, 'script.js'),
}

export default SETU_CATALOG
