import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const MIRACLE_SOFTWARE_SYSTEMS_CATALOG = {
  source: 'miraclesoftwaresystems',
  companyName: 'Miracle Software Systems',
  officialBrandName: 'Miracle Software Systems, Inc.',
  adapter: 'script',
  homepageUrl: 'https://www.miraclesoft.com/',
  companyCareerPage: 'https://careers.miraclesoft.com/',
  companyDomain: 'miraclesoft.com',
  atsPlatform: 'first-party-careers-site',
  countryFilter: 'India',
  paginationStrategy: 'single-first-party-open-positions-page',
  extractionStrategy: 'verified-first-party-careers-page+visible-open-position-cards',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-08-03',
  verifiedSurfaceSummary:
    'Verified on Monday, August 3, 2026 that https://careers.miraclesoft.com/ is the live first-party Miracle Software Systems careers page and that it still publicly lists visible open positions on the first-party page, now in the current oc-item markup, including ServiceNow ITSM Architect, Microsoft Dynamics 365 (D365) Technical Consultant, SAP FI/ABAP Support Consultant, and SQL/UKG Developer at Miracle Heights, India with Apply Now links to first-party detail pages.',
  modulePath: path.join(currentDir, 'script.js'),
  dryRunFile: 'miraclesoftwaresystems/jobs.json',
}

export default MIRACLE_SOFTWARE_SYSTEMS_CATALOG
