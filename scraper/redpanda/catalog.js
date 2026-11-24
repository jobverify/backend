import path from 'node:path'
import {fileURLToPath} from 'node:url'
const currentDir=path.dirname(fileURLToPath(import.meta.url))
export const REDPANDA_CATALOG={
...{
  "source": "redpanda",
  "companyName": "Redpanda",
  "officialBrandName": "Redpanda",
  "adapter": "script",
  "companyCareerPage": "https://www.redpanda.com/jobs",
  "ashbyBoardSlug": "redpanda-data",
  "ashbyJobBoardUrl": "https://api.ashbyhq.com/posting-api/job-board/redpanda-data",
  "companyDomain": "redpanda.com",
  "atsPlatform": "current-own-connected-ashby-public-feed",
  "countryFilter": "India",
  "paginationStrategy": "paired-current-own-connected-browser-feed-consumer-and-documented-unfiltered-feed",
  "extractionStrategy": "original-own-publisher-and-static-connected-feed-consumer-plus-all-listed-explicit-foreign-workplaces",
  "parser": "custom-script",
  "normalizationProfile": "engineering-default",
  "verifiedOn": null,
  "verifiedSurfaceSummary": "The current own careers page must statically connect its DOM-ready callback to the declared public JSON feed, listed collection, native role URLs and titles, and actual jobs list. Original own HTML and documented unfiltered feed are read twice. Every listed primary, secondary and explicit country alternative must consistently exclude India. Positive India, unknown geography, malformed data, publication/employer/application conflicts and changed membership refuse empty proof. Company totals, legal employing entities, application/renderer activation and cleanup remain unverified.",
  "officialHomepageUrl": "https://www.redpanda.com/",
  "authoritativeCurrentPublication": true,
  "scraperTimeoutMs": 180000,
  "sourceScopeComplete": false,
  "lifecycleCleanupAllowed": false,
  "verifiedAt": null,
  "verifiedPublicJobCount": null,
  "verifiedGlobalJobCount": null,
  "verifiedIndiaJobCount": null,
  "backfillMode": "live-parser"
},
modulePath:path.join(currentDir,'script.js'),dryRunFile:path.join(currentDir,'jobs.json')
}
export default REDPANDA_CATALOG
