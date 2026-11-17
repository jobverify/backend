import path from 'node:path'
import { fileURLToPath } from 'node:url'
const currentDir = path.dirname(fileURLToPath(import.meta.url))
export const NOBROKERS_CATALOG = {
  "source": "nobrokers",
  "companyName": "NoBroker",
  "adapter": "script",
  "homepageUrl": "https://www.nobroker.in/",
  "companyCareerPage": "https://www.nobroker.in/careers",
  "jobsApiUrl": "https://no-broker-cbaa4.firebaseio.com/jobOpeningSheet.json",
  "companyDomain": "nobroker.in",
  "atsPlatform": "official-current-firebase-feed-observations-expired-details-scope-held",
  "countryFilter": "India",
  "paginationStrategy": "active-own-careers-programme-bound-feed-and-authored-handoff-opening-closing-stop-denied-host",
  "extractionStrategy": "current-executable-bound-native-feed-metadata+expired-detail-redirects-and-observed-denial-retained+full-criteria-active-application-and-company-scope-unqualified",
  "parser": "custom-script",
  "normalizationProfile": "engineering-default",
  "verifiedOn": "2026-10-03",
  "verifiedIndiaJobCount": 6,
  "verifiedSurfaceSummary": "Verified on October 3, 2026 that the official NoBroker homepage links to its careers page and the current first-party careers client still initializes the exact no-broker-cbaa4 Firebase project and reads jobOpeningSheet. The client now uses authDomain/databaseURL configuration keys. The public feed remains live and a full dry-run verified six India roles. The public sheet exposes role/location/team/apply-link metadata without job descriptions.",
  "dryRunFile": "nobrokers/jobs.json"
  ,"modulePath": path.resolve(currentDir, 'script.js')
}
export default NOBROKERS_CATALOG
