import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

const PROVIDER_METADATA = {
  "source": "amrutam",
  "companyName": "Amrutam",
  "adapter": "script",
  "modulePath": path.join(currentDir, 'script.js'),
  "dryRunFile": path.join(currentDir, 'jobs.json'),
  "companyCareerPage": "https://amrutam.co.in/",
  "companyDomain": "amrutam.co.in",
  "applicationFormUrl": "https://forms.gle/YCyYEZ5BLToeqw7u9",
  "atsPlatform": "official-company-site-no-public-careers",
  "countryFilter": "India",
  "paginationStrategy": "verified-homepage-plus-team-page-plus-story-page-plus-work-with-us-form-plus-branded-404-careers-routes-validation",
  "extractionStrategy": "verified-exact-name-homepage+verified-team-and-story-pages+verified-work-with-us-form+verified-missing-careers-routes-return-empty",
  "parser": "custom-script",
  "normalizationProfile": "engineering-default",
  "verifiedOn": "2026-07-30",
  "verifiedPublicJobCount": 0,
  "verifiedIndiaJobCount": 0,
  "verifiedSurfaceSummary": "Verified on Thursday, July 30, 2026 that https://amrutam.co.in/ was the live first-party Amrutam homepage, that https://amrutam.co.in/pages/meet-the-team and https://amrutam.co.in/pages/our-story-the-journey-of-amrutam-1 were live first-party identity pages, that the homepage Work with Us handoff at https://forms.gle/YCyYEZ5BLToeqw7u9 resolved to the public Google form titled Work with Amrutam, and that https://amrutam.co.in/careers plus https://amrutam.co.in/pages/careers both returned branded 404 pages with no public openings. This scraper validates those exact surfaces and returns zero jobs until first-party public role listings appear.",
  "backfillMode": "live-copy",
  "originalAdapter": "script",
  "originalAtsPlatform": "official-company-site-no-public-careers",
  "originalModulePath": "../workbookbatch02/amrutam.js",
  "originalDryRunFile": "C:\\Users\\mohv\\GitHub\\jobverify_Release_26.07.04\\jobverify-backend\\scraper\\workbookbatch02\\amrutam.jobs.json"
}

export default PROVIDER_METADATA
export { PROVIDER_METADATA }
