import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const DATA_CORE_SYSTEMS_CATALOG = {
  source: 'datacoresystems',
  companyName: 'Data-Core Systems',
  officialBrandName: 'Data-Core Systems',
  adapter: 'script',
  homepageUrl: 'https://datacoresystems.com/',
  companyCareerPage: 'https://datacoresystems.com/careers/',
  officialJobsBoardUrl: 'https://datacoresystems.bamboohr.com/careers',
  jobsApiUrl: 'https://datacoresystems.bamboohr.com/careers/list',
  companyDomain: 'datacoresystems.com',
  atsPlatform: 'bamboohr',
  countryFilter: 'United States',
  paginationStrategy: 'single-bamboohr-json-list',
  extractionStrategy: 'verified-official-bamboohr-board+json-list',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-18',
  verifiedPublicJobCount: 21,
  verifiedSurfaceSummary:
    'Verified on Saturday, July 18, 2026 that direct automated fetches to https://datacoresystems.com/careers/ returned a Cloudflare 403 interstitial, while the currently indexed first-party careers surface and its Apply Now CTA hand off to the official BambooHR board at https://datacoresystems.bamboohr.com/careers. The public BambooHR list endpoint at https://datacoresystems.bamboohr.com/careers/list returned 21 openings including Customer Relationship Management (CRM) Lead in Harrisburg, Pennsylvania and SAP ABAP-Fiori Consultant in Middletown, Pennsylvania on the verified date.',
  modulePath: path.join(currentDir, 'script.js'),
  dryRunFile: path.join(currentDir, 'jobs.json'),
}

export default DATA_CORE_SYSTEMS_CATALOG
