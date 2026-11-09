import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const VERIFIED_SURFACE_SUMMARY =
  "Verified on October 9, 2026 that the first-party https://netcorecloud.com/careers redirects to https://netcore.ai/careers and delegates to the live https://careerpagenetcore.lovable.app/ presentation. Its https://netcorecloud.com/careers-list?job_category=engineering handoff redirects to https://netcore.ai/careers-list?job_category=engineering. Blocked marketing pages are not accepted as healthy listings or empty inventory. The public netcoreai MyNextHire board independently identifies clientId 1127, Netcore AI, https://netcore.ai/, and the official careers URL. The board's complete unfiltered array is reconciled with all current published details and a second stable inventory before India filtering; missing descriptions, unpublished roles, identity, country, count or field disagreement rejects the snapshot."

export const NETCORE_CLOUD_CATALOG = {
  source: 'netcorecloud',
  companyName: 'Netcore Cloud',
  officialBrandName: 'Netcore Cloud',
  adapter: 'script',
  modulePath: path.resolve(currentDir, 'script.js'),
  dryRunFile: 'netcorecloud/jobs.json',
  homepageUrl: 'https://netcorecloud.com/',
  companyCareerPage: 'https://netcoreai.mynexthire.com/employer/jobs/careers',
  companyCareersListUrl: 'https://netcorecloud.com/careers-list?job_category=engineering',
  companyDomain: 'netcorecloud.com',
  atsPlatform: 'mynexthire',
  countryFilter: 'India',
  paginationStrategy: 'complete-public-reqlist-and-published-detail-reconciliation',
  extractionStrategy:
    'verified-careers-presentation+tenant-identity+unfiltered-reqlist+all-published-details+stable-count+india-filter',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-10-09',
  verifiedSurfaceSummary: VERIFIED_SURFACE_SUMMARY,
}

export default NETCORE_CLOUD_CATALOG
