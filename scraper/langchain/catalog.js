import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

const PROVIDER_METADATA = {
  "source": "langchain",
  "companyName": "LangChain",
  "adapter": "script",
  "modulePath": path.join(currentDir, 'script.js'),
  "dryRunFile": path.join(currentDir, 'jobs.json'),
  "atsPlatform": "ashby",
  "countryFilter": "India",
  "paginationStrategy": "reviewed-native-board-array+full-api-models+closing-reconciliation",
  "extractionStrategy": "current-corporate-handoff+reciprocal-native-employer+all-role-content-and-country-validation+typed-india-projection",
  "parser": "langchain-native-public-board",
  "normalizationProfile": "engineering-default",
  "companyDomain": "langchain.com",
  "companyCareerPage": "https://www.langchain.com/careers",
  "officialHomepageUrl": "https://langchain.com/",
  "sourceScopeComplete": false,
  "zeroResultPolicy": "evidence-required",
  "verifiedOn": null,
  "verifiedPublicJobCount": null,
  "verifiedIndiaJobCount": null,
  "verifiedSurfaceSummary": "Each attempt validates the current corporate hiring handoff, reciprocal native employer, reviewed public board array, every native full-content role, typed primary and secondary countries, and closing responses. This qualifies the configured board only; whole-company inventory, other hiring channels, company India totals, persistence and public visibility remain unverified.",
  "backfillMode": "live-parser"
}

export default PROVIDER_METADATA
export { PROVIDER_METADATA }
