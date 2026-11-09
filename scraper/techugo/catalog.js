import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const TECHUGO_CATALOG = {
  source: 'techugo',
  companyName: 'Techugo',
  officialBrandName: 'Techugo',
  adapter: 'script',
  modulePath: path.join(currentDir, 'script.js'),
  dryRunFile: 'techugo/jobs.json',
  companyCareerPage: 'https://www.techugo.com/career',
  companyDomain: 'techugo.com',
  atsPlatform: 'official-first-party-role-pages',
  countryFilter: 'India',
  paginationStrategy: 'single-careers-page-plus-linked-role-pages',
  extractionStrategy:
    'verified-official-careers-page+verified-linked-role-pages+remote-role-normalization',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-18',
  verifiedSurfaceSummary:
    'Verified on Saturday, July 18, 2026 that https://www.techugo.com/career is the live first-party Techugo careers page and that it publicly lists current openings including Node.js developer, QA Manual Engineer, and Content Writer. Verified that linked first-party role pages under https://www.techugo.com/career/job_openings expose public descriptions, skills, and responsibilities, so the local scraper follows those role pages and normalizes the remote jobs to India.',
}

export default TECHUGO_CATALOG
