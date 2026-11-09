import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const EXPLEO_CATALOG = {
  source: 'expleo',
  companyName: 'Expleo',
  officialBrandName: 'Expleo',
  adapter: 'script',
  companyCareerPage: 'https://careers.expleo.com/en/',
  indiaJobsRootUrl: 'https://expleo-jobs-in-en.icims.com/',
  indiaJobsSearchWrapperUrl: 'https://expleo-jobs-in-en.icims.com/jobs/search?hashed=-435712793',
  indiaJobsSearchIframeUrl: 'https://expleo-jobs-in-en.icims.com/jobs/search?hashed=-435712793&in_iframe=1',
  officialJobDetailExampleUrl: 'https://expleo-jobs-in-en.icims.com/jobs/54246/cae-modeller/job',
  atsPlatform: 'icims',
  countryFilter: 'India',
  paginationStrategy: 'icims-next-page-search',
  extractionStrategy:
    'verified-first-party-careers-page+verified-india-icims-wrapper+iframe-listings+detail-pages',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  companyDomain: 'expleo.com',
  verifiedOn: '2026-08-02',
  verifiedSurfaceSummary:
    'Verified on Sunday, August 2, 2026 that the live first-party Expleo careers page at https://careers.expleo.com/en/ links India to the public iCIMS root https://expleo-jobs-in-en.icims.com/, that the live India jobs wrapper is https://expleo-jobs-in-en.icims.com/jobs/search?hashed=-435712793, that the wrapper still embeds the public listings iframe at https://expleo-jobs-in-en.icims.com/jobs/search?hashed=-435712793&in_iframe=1, and that the public detail contract remains live at https://expleo-jobs-in-en.icims.com/jobs/54246/cae-modeller/job for the role "CAE Modeller" in Chennai.',
  modulePath: path.join(currentDir, 'script.js'),
}

export default EXPLEO_CATALOG
