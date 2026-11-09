import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const STRIDES_PHARMA_CATALOG = {
  source: 'stridespharma',
  companyName: 'Strides Pharma',
  officialBrandName: 'Strides Pharma Science Limited',
  adapter: 'script',
  modulePath: path.resolve(currentDir, 'script.js'),
  dryRunFile: 'stridespharma/jobs.json',
  officialHomepageUrl: 'https://www.strides.com/',
  companyCareerPage: 'https://www.strides.com/careers',
  officialCareersHandoffUrl: 'https://portal.arcolab.com/careerportal/',
  portalJobServiceUrl: 'https://portal.arcolab.com/careerportal/ServiceHandler.svc/GenericMethod',
  applicationStatusUrl: 'https://portal.arcolab.com/careerportal/main.aspx?loc=002',
  portalCompanyToken: 'Strides',
  listingKey: '300000100001',
  detailKey: '300000100003',
  companyDomain: 'strides.com',
  atsPlatform: 'arcolab-careerportal',
  countryFilter: 'India',
  paginationStrategy: 'verified-careers-page-plus-public-servicehandler-xml-listing',
  extractionStrategy:
    'verified-first-party-careers-page+arcolab-portal+public-servicexml-job-list-and-detail',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-17',
  verifiedSurfaceSummary:
    'Verified on Friday, July 17, 2026 that https://www.strides.com/careers is the live first-party Strides careers page, that it links directly to https://portal.arcolab.com/careerportal/ as the official public openings portal, and that the same portal exposes a first-party public XML-backed job contract at https://portal.arcolab.com/careerportal/ServiceHandler.svc/GenericMethod. The live inline portal script uses company token Strides with listing key 300000100001 and detail key 300000100003, and the live service returned current Strides job rows on July 17, 2026, so this provider is pinned to that verified first-party careers page plus public portal service contract.',
}

export default STRIDES_PHARMA_CATALOG
