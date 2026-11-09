import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

const PROVIDER_METADATA = {
  "source": "urbanpiper",
  "companyName": "UrbanPiper",
  "adapter": "script",
  "modulePath": path.join(currentDir, 'script.js'),
  "companyCareerPage": "https://urbanpiper.keka.com/careers",
  "companyDomain": "urbanpiper.com",
  "atsPlatform": "keka-embed-api",
  "paginationStrategy": "single-keka-active-feed",
  "extractionStrategy": "verified-homepage-plus-about-handoff+document-backed-keka-config+active-feed",
  "verifiedOn": "2026-08-01",
  "verifiedSurfaceSummary": "Verified on Saturday, August 1, 2026 that https://www.urbanpiper.com/ and https://www.urbanpiper.com/about-us both expose an official Careers handoff to https://urbanpiper.keka.com/careers, that the Keka shell resolves the embedded document /ats/documents/896a0ed2-971f-4888-bc9b-d412677c6b9a/careerportal/6df1e3efa9b84016afc495a498d98599.html, and that the trusted active feed at https://urbanpiper.keka.com/careers/api/embedjobs/default/active/896a0ed2-971f-4888-bc9b-d412677c6b9a currently returns zero public jobs.",
  "jobsBoardUrl": "https://urbanpiper.keka.com/careers",
  "careerPortalInfoUrl": "https://urbanpiper.keka.com/careers/api/organization/default/careerportalinfo",
  "activeJobsUrl": "https://urbanpiper.keka.com/careers/api/embedjobs/default/active/896a0ed2-971f-4888-bc9b-d412677c6b9a",
  "dryRunFile": path.join(currentDir, 'jobs.json'),
  "backfillMode": "live-copy",
  "originalAdapter": "script",
  "originalAtsPlatform": "verified-browse-all-jobs-handoff-sentinel",
  "originalModulePath": "../workbookbatch05/urbanpiper.js",
  "originalDryRunFile": null
}

export default PROVIDER_METADATA
export { PROVIDER_METADATA }
