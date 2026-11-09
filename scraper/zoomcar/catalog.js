import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

const PROVIDER_METADATA = {
  "source": "zoomcar",
  "companyName": "ZoomCar",
  "adapter": "script",
  "modulePath": path.join(currentDir, 'script.js'),
  "dryRunFile": path.join(currentDir, 'jobs.json'),
  "companyCareerPage": "https://www.zoomcar.com/careers",
  "companyDomain": "zoomcar.com",
  "atsPlatform": "official-company-site-no-public-careers",
  "countryFilter": "India",
  "paginationStrategy": "verified-homepage-plus-careers-route-plus-jobs-route-marketing-shell-validation",
  "extractionStrategy": "verified-exact-name-homepage+verified-careers-and-jobs-routes-serving-consumer-marketing-shell-return-empty",
  "parser": "custom-script",
  "normalizationProfile": "engineering-default",
  "verifiedOn": "2026-07-30",
  "verifiedPublicJobCount": 0,
  "verifiedIndiaJobCount": 0,
  "verifiedSurfaceSummary": "Verified on Thursday, July 30, 2026 that https://www.zoomcar.com/, https://www.zoomcar.com/careers, and https://www.zoomcar.com/jobs all served the same consumer booking shell with the title Zoomcar Self Drive Car Rentals in India | Book Online, product metadata, and a canonical root URL of https://www.zoomcar.com/ instead of exposing trustworthy public job listings. The non-www alias at https://zoomcar.com/careers also resolved to the same consumer booking shell. This provider now uses a verified exact-name no-public-careers scraper instead of a generic sentinel until ZoomCar publishes a real public careers surface.",
  "backfillMode": "live-copy",
  "originalAdapter": "script",
  "originalAtsPlatform": "official-company-site-no-public-careers",
  "originalModulePath": "../workbookbatch02/zoomcar.js",
  "originalDryRunFile": "C:\\Users\\mohv\\GitHub\\jobverify_Release_26.07.04\\jobverify-backend\\scraper\\workbookbatch02\\zoomcar.jobs.json"
}

export default PROVIDER_METADATA
export { PROVIDER_METADATA }
