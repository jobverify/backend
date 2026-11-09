import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

const PROVIDER_METADATA = {
  "source": "covalensedigital",
  "companyName": "Covalensedigital",
  "adapter": "script",
  "modulePath": path.join(currentDir, 'script.js'),
  "dryRunFile": path.join(currentDir, 'jobs.json'),
  "atsPlatform": "verified-first-party-careers-page-plus-public-careers-api",
  "companyCareerPage": "https://covalensedigital.com/careers",
  "companyDomain": "covalensedigital.com",
  "countryFilter": "India",
  "paginationStrategy": "verified-public-jobs-api",
  "extractionStrategy": "verified-first-party-careers-page+public-careers-api+india-filter",
  "parser": "custom-script",
  "normalizationProfile": "engineering-default",
  "verifiedOn": "2026-07-25",
  "verificationDisposition": "verified-public-careers-api",
  "verifiedPublicJobCount": 9,
  "verifiedIndiaJobCount": 9,
  "verifiedSurfaceSummary": "Verified on Saturday, July 25, 2026 that https://covalensedigital.com/careers was the live first-party Covalense Digital careers surface, that its public client-side bundle resolved the careers API contract to https://testingbe.covalensedigital.com/api/auth/getlistof-career, and that the public API exposed current openings including India roles such as GenAI & LLM Engineer, Machine Learning Engineer, Oracle BRM Developer, and Java Developer. The same public inventory also included a US-only Software Architect role in Herndon, Virginia, so this scraper validates the verified page-plus-bundle contract and returns India jobs only from the public careers API.",
  "backfillMode": "live-copy",
  "originalAdapter": "script",
  "originalAtsPlatform": "verified-first-party-careers-page-plus-public-careers-api",
  "originalModulePath": "../workbookbatch06/covalensedigital.js",
  "originalDryRunFile": "C:\\Users\\mohv\\GitHub\\jobverify_Release_26.07.04\\jobverify-backend\\scraper\\workbookbatch06\\covalensedigital.jobs.json"
}

export default PROVIDER_METADATA
export { PROVIDER_METADATA }
