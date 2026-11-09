import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

const PROVIDER_METADATA = {
  "source": "zivame",
  "companyName": "Zivame",
  "adapter": "script",
  "modulePath": path.join(currentDir, 'script.js'),
  "dryRunFile": path.join(currentDir, 'jobs.json'),
  "companyCareerPage": "https://www.zivame.com/careers",
  "blockedLegacyCareerPageUrl": "https://careers.zivame.com/",
  "companyDomain": "zivame.com",
  "atsPlatform": "official-company-careers-blocked-by-cloudflare",
  "countryFilter": "India",
  "paginationStrategy": "verified-blocked-homepage-plus-blocked-careers-route-and-dead-legacy-host",
  "extractionStrategy": "verified-cloudflare-blocked-homepage+verified-cloudflare-blocked-careers-route+verified-dead-legacy-careers-host-return-empty",
  "parser": "custom-script",
  "normalizationProfile": "engineering-default",
  "verifiedOn": "2026-08-13",
  "verifiedPublicJobCount": 0,
  "verifiedIndiaJobCount": 0,
  "verifiedSurfaceSummary": "Verified on Thursday, August 13, 2026 that both https://www.zivame.com/ and https://www.zivame.com/careers currently return HTTP 403 Cloudflare challenge pages titled Just a moment... from this environment, and that the legacy careers host at https://careers.zivame.com/ still fails DNS resolution. Because the live first-party homepage and careers route are both challenge-blocked here and the older careers subdomain is dead, this provider remains a fail-closed sentinel that returns no jobs until a trustworthy public jobs surface is re-verified.",
  "backfillMode": "live-copy",
  "originalAdapter": "script",
  "originalAtsPlatform": "verified-first-party-careers-page-plus-same-origin-detail-pages",
  "originalModulePath": "../workbookbatch02/zivame.js",
  "originalDryRunFile": "C:\\Users\\mohv\\GitHub\\jobverify_Release_26.07.04\\jobverify-backend\\scraper\\workbookbatch02\\zivame.jobs.json"
}

export default PROVIDER_METADATA
export { PROVIDER_METADATA }
