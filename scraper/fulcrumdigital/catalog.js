import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const FULCRUM_DIGITAL_CATALOG = {
  source: 'fulcrumdigital',
  companyName: 'Fulcrum Digital',
  officialBrandName: 'Fulcrum Digital',
  adapter: 'script',
  companyCareerPage: 'https://fulcrumdigital.zohorecruit.com/careers',
  jobsBoardUrl: 'https://fulcrumdigital.zohorecruit.com/jobs/Careers',
  atsPlatform: 'zohorecruit-hidden-jobs-input',
  countryFilter: 'India',
  paginationStrategy: 'single-hidden-jobs-input',
  extractionStrategy: 'verified-company-branded-zohorecruit-board+hidden-jobs-input',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  companyDomain: 'fulcrumdigital.com',
  verifiedOn: '2026-07-18',
  verifiedSurfaceSummary:
    'Verified on Saturday, July 18, 2026 that https://fulcrumdigital.zohorecruit.com/careers was the live company-branded Fulcrum Digital Zoho Recruit board, that its hidden jobs input exposed public India openings even when Keep_on_Career_Site was false, and that verified records included SOC Analyst, AI QA Engineer, Claims Team Lead, and IT - Business Analyst in Pune.',
  modulePath: path.join(currentDir, 'script.js'),
}

export default FULCRUM_DIGITAL_CATALOG
