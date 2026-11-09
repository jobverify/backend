import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

const PROVIDER_METADATA = {
  "source": "filo",
  "companyName": "Filo",
  "adapter": "script",
  "modulePath": path.join(currentDir, 'script.js'),
  "dryRunFile": path.join(currentDir, 'jobs.json'),
  "atsPlatform": "verified-first-party-careers-page-plus-public-role-details",
  "companyCareerPage": "https://askfilo.com/careers",
  "companyDomain": "askfilo.com",
  "countryFilter": "India",
  "paginationStrategy": "verified-first-party-next-data-payload",
  "extractionStrategy": "verified-first-party-careers-page+next-data-openings-payload+public-role-pages",
  "parser": "custom-script",
  "normalizationProfile": "engineering-default",
  "verifiedOn": "2026-10-03",
  "verificationDisposition": "verified-first-party-next-data-openings-payload",
  "verifiedPublicJobCount": 16,
  "verifiedIndiaJobCount": 16,
  "verifiedSurfaceSummary": "Verified on October 3, 2026 that https://askfilo.com/careers exposes department-grouped openings in public __NEXT_DATA__ and that each opening has a public Filo role page containing its title, India location, description, and application URL. The page repeated one Maharashtra opening under four IDs with the same application URL; the scraper validates each detail and publishes that application once. The previous Google Docs payload remains supported for historical compatibility.",
  "backfillMode": "live-copy",
  "originalAdapter": "script",
  "originalAtsPlatform": "verified-first-party-careers-page-plus-public-google-doc-role-descriptions",
  "originalModulePath": "../workbookbatch06/filo.js",
  "originalDryRunFile": "C:\\Users\\mohv\\GitHub\\jobverify_Release_26.07.04\\jobverify-backend\\scraper\\workbookbatch06\\filo.jobs.json"
}

export default PROVIDER_METADATA
export { PROVIDER_METADATA }
