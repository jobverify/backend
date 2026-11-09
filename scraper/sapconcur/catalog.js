import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SAP_CONCUR_CATALOG = {
  source: 'sapconcur',
  companyName: 'SAP-Concur',
  adapter: 'script',
  companyCareerPage: 'https://jobs.sap.com/go/India/8807201/',
  companyDomain: 'jobs.sap.com',
  atsPlatform: 'sap-careers',
  countryFilter: 'India',
  paginationStrategy: 'sap-country-listing-pages',
  extractionStrategy: 'verified-sap-india-listings+concur-title-filter+india-location-filter',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-18',
  verifiedSurfaceSummary:
    'Verified on Saturday, July 18, 2026 that https://jobs.sap.com/go/India/8807201/ remained the official SAP India jobs surface and listed India roles including AI Product Manager, SAP Concur Spend in Bangalore and Development Expert (Java/ Kotlin/ Go/ Dot Net), SAP Concur Travel in Bangalore. SAP-Concur coverage is limited to Concur-branded India roles visible on the parent SAP careers surface.',
  modulePath: path.join(currentDir, 'script.js'),
}

export default SAP_CONCUR_CATALOG
