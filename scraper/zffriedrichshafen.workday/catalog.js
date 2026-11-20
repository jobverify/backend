import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

const PROVIDER_METADATA = {
  "source": "zffriedrichshafen",
  "companyName": "ZF Friedrichshafen",
  "adapter": "script",
  "atsPlatform": "successfactors-rmk",
  "countryFilter": "India",
  "paginationStrategy": "current-corporate-declared-India-facet-and-native-relative-pagination",
  "extractionStrategy": "own-ZF-group-publisher+typed-native-India-workplaces+original-criteria-dates-and-authored-application;explicit-partials",
  "parser": "custom-script",
  "normalizationProfile": "engineering-default",
  "verifiedOn": null,
  "verifiedPublicJobCount": null,
  "verifiedIndiaJobCount": null,
  "verificationDisposition": "current-native-publication-assessment-required",
  "verifiedSurfaceSummary": "Follows the current corporate-declared ZF India search and own ZF group publisher. Original role employer/operating/legal labels are retained, with no legal employer relabeling to the canonical source name. Typed India addresses, whole visible/listed workplaces, dates/criteria and exact own applications must reconcile. Bounded records remain explicit partials; full company inventory, renderer/application controls, backend activation and cleanup remain held.",
  "authoritativeCurrentPublication": true,
  "sourceScopeComplete": false,
  "lifecycleCleanupAllowed": false,
  "scraperTimeoutMs": 180000,
  "companyCareerPage": "https://www.zf.com/india/en/careers/careers.html",
  "globalJobBoardUrl": "https://jobs.zf.com/",
  "backfillMode": "live-parser",
  "modulePath": path.join(currentDir, 'script.js'),
  "dryRunFile": path.join(currentDir, 'jobs.json')
}

export default PROVIDER_METADATA
export { PROVIDER_METADATA }
