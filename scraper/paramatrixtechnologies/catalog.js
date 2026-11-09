import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PARAMATRIX_TECHNOLOGIES_CATALOG = {
  source: 'paramatrixtechnologies',
  companyName: 'Paramatrix Technologies',
  officialBrandName: 'Paramatrix Technologies Ltd.',
  adapter: 'script',
  modulePath: path.join(currentDir, 'script.js'),
  homepageUrl: 'https://www.paramatrix.com/',
  companyCareerPage: 'https://www.paramatrix.com/careers',
  atsPlatform: 'first-party-careers-page-with-inline-apply-modals',
  countryFilter: 'India',
  paginationStrategy: 'first-party-careers-page-validation-return-empty-until-parser-is-promoted',
  extractionStrategy: 'verified-first-party-careers-listings+inline-apply-modal-surface-return-empty-until-parser-is-promoted',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  companyDomain: 'paramatrix.com',
  dryRunFile: 'paramatrixtechnologies/jobs.json',
  verifiedOn: '2026-07-25',
  verifiedSurfaceSummary:
    'Verified on Saturday, July 25, 2026 that https://www.paramatrix.com/careers was the live first-party Paramatrix Technologies careers page, that it advertised "Be a part of our talent network", and that it exposed inline Apply actions for listed roles such as AI Engineer (Gen AI, RAG, Agentic AI, LLM) and IT Recruiter through first-party modal forms rather than separate public job detail URLs.',
}

export default PARAMATRIX_TECHNOLOGIES_CATALOG
