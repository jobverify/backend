import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const provider = {
  source: 'mawaiinfotech',
  companyName: 'Mawai Infotech',
  officialBrandName: 'Mawai Infotech Limited',
  adapter: 'script',
  homepageUrl: 'https://www.mawai.com/',
  companyCareerPage: 'https://www.mawai.com/carrer-sap',
  atsPlatform: 'official-company-careers-form-only',
  countryFilter: 'India',
  paginationStrategy: 'single-first-party-careers-page-validation',
  extractionStrategy:
    'verified-careers-form+generic-role-categories-without-openings+fail-closed-sentinel',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  companyDomain: 'mawai.com',
  verifiedOn: '2026-07-18',
  verifiedSurfaceSummary:
    'Verified on Saturday, July 18, 2026 that https://www.mawai.com/carrer-sap remained Mawai Infotech Limited’s first-party careers page, but the surface only advertised broad categories such as SAP Consultants, Project Managers, Sales and Business Development Professionals, and Technical Experts alongside a generic contact form. Because it did not publish trustworthy current openings, job codes, or per-role detail links, this provider remains fail-closed.',
  modulePath: path.resolve(currentDir, 'script.js'),
  dryRunFile: path.resolve(currentDir, 'jobs.json'),
}

export default provider
