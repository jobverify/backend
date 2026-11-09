import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const LEXMARK_INDIA_CATALOG = {
  "source": "lexmarkindia",
  "companyName": "Lexmark India",
  "officialBrandName": "Lexmark India",
  "companyCareerPage": "https://origin-www.lexmark.com/en_in/careers.html",
  "jobSearchUrl": "https://origin-www.lexmark.com/en_in/careers/job-search.html",
  "companyDomain": "lexmark.com",
  "atsPlatform": "workday-jobs-api",
  "officialJobsBoardUrl": "https://lexmark.wd1.myworkdayjobs.com/Lexmark",
  "publicJobsApiUrl": "https://lexmark.wd1.myworkdayjobs.com/wday/cxs/lexmark/Lexmark/jobs",
  "countryFilter": "India",
  "paginationStrategy": "workday-offset-limit-and-native-country-facets",
  "extractionStrategy": "verified-first-party-careers-handoff+verified-workday-tenant+unfiltered-zero-payload-or-native-workday-india-details",
  "verificationDisposition": "verified-empty-public-workday-inventory",
  "verifiedPublicJobCount": 0,
  "verifiedIndiaJobCount": 0,
  "verifiedSurfaceSummary": "Verified October 3, 2026: the official Lexmark India careers View Jobs Now CTA points to the exact Lexmark Workday board. The board identifies tenant lexmark and site Lexmark; its unfiltered public jobs POST explicitly reports total 0 with an empty jobPostings array and facets. Runtime inventory evidence establishes globally empty inventory. The legacy job-search table remains visible but its linked job details report unavailable data, so it is superseded by the current official handoff.",
  "adapter": "script",
  "parser": "custom-script",
  "normalizationProfile": "engineering-default",
  "verifiedOn": "2026-10-03",
  "dryRunFile": "lexmarkindia/jobs.json",
  modulePath: path.join(currentDir, 'script.js'),
}

export default LEXMARK_INDIA_CATALOG
