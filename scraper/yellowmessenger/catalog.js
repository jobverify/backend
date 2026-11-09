import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

const PROVIDER_METADATA = {
  "source": "yellowmessenger",
  "companyName": "Yellow Messenger",
  "adapter": "script",
  "modulePath": path.join(currentDir, 'script.js'),
  "dryRunFile": path.join(currentDir, 'jobs.json'),
  "atsPlatform": "verified-rebrand-careers-surface-plus-dead-zohorecruit-embed",
  "companyCareerPage": "https://yellow.ai/career/",
  "companyDomain": "yellow.ai",
  "countryFilter": "India",
  "paginationStrategy": "rendered-first-party-careers-page-validation",
  "extractionStrategy": "verified-rebrand-careers-surface+embedded-dead-zohorecruit-loader+return-empty",
  "parser": "custom-script",
  "normalizationProfile": "engineering-default",
  "verifiedOn": "2026-08-02",
  "verificationDisposition": "verified-embedded-zohorecruit-loader-with-no-live-public-openings",
  "verifiedPublicJobCount": 0,
  "verifiedIndiaJobCount": 0,
  "verifiedSurfaceSummary": "Verified on Sunday, August 2, 2026 that Yellow Messenger still presents careers through the rebranded Yellow.ai surface at https://yellow.ai/career/, and that the rendered page still embeds Zoho Recruit via rec_embed_js.load with site:\"https://careers.yellow.ai\" and empty_job_msg:\"No current Openings\". On the verified date, the embedded public Zoho site resolved to a \"does not exist\" page and no visible public openings were rendered on the first-party careers page, so this scraper now validates the current embedded contract and returns no India jobs.",
  "backfillMode": "live-copy",
  "originalAdapter": "script",
  "originalAtsPlatform": "verified-rebrand-careers-surface-plus-public-zohorecruit-board",
  "originalModulePath": "../workbookbatch06/yellowmessenger.js",
  "originalDryRunFile": "C:\\Users\\mohv\\GitHub\\jobverify_Release_26.07.04\\jobverify-backend\\scraper\\workbookbatch06\\yellowmessenger.jobs.json"
}

export default PROVIDER_METADATA
export { PROVIDER_METADATA }
