import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SYNCFUSION_CATALOG = {
  source: 'syncfusion',
  companyName: 'Syncfusion',
  officialBrandName: 'Syncfusion',
  adapter: 'script',
  modulePath: path.resolve(currentDir, 'script.js'),
  dryRunFile: 'syncfusion/jobs.json',
  companyCareerPage: 'https://www.syncfusion.com/careers/',
  officialCareersPageUrl: 'https://www.syncfusion.com/careers/',
  verifiedJobDetailUrls: [
    'https://www.syncfusion.com/careers/dotnet-developer-fresher/',
    'https://www.syncfusion.com/careers/dotnet-developer-experience/',
    'https://www.syncfusion.com/careers/testing-engineer-fresher/',
  ],
  companyDomain: 'syncfusion.com',
  atsPlatform: 'official-careers-page-relevant-job-details',
  countryFilter: 'India',
  paginationStrategy: 'single-careers-page-relevant-job-links',
  extractionStrategy: 'verified-careers-page+relevant-job-links+same-domain-job-detail-pages',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-08-05',
  verifiedSurfaceSummary:
    'Verified on Wednesday, August 5, 2026 that https://www.syncfusion.com/careers/ is still the live first-party Syncfusion careers page, that it explicitly shows "There are no current openings" while still publishing a Relevant Jobs section, and that the same-domain job detail pages at https://www.syncfusion.com/careers/dotnet-developer-fresher/, https://www.syncfusion.com/careers/dotnet-developer-experience/, and https://www.syncfusion.com/careers/testing-engineer-fresher/ still expose public role details and application links for Chennai, India. This provider uses the verified same-domain Relevant Jobs detail pages rather than inventing openings from third-party sources.',
}

export default SYNCFUSION_CATALOG
