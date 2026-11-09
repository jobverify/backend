import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const KISSFLOW_CATALOG = {
  source: 'kissflow',
  companyName: 'Kissflow',
  officialBrandName: 'Kissflow',
  adapter: 'script',
  modulePath: path.join(currentDir, 'script.js'),
  companyCareerPage: 'https://careers.kissflow.com/',
  homepageUrl: 'https://kissflow.com/',
  verifiedRoleUrls: [
    'https://careers.kissflow.com/solution-advisor',
    'https://careers.kissflow.com/client-director',
  ],
  companyDomain: 'kissflow.com',
  atsPlatform: 'official-company-site',
  countryFilter: 'India',
  paginationStrategy: 'single-first-party-open-positions-page-plus-detail-pages',
  extractionStrategy: 'verified-careers-page+listing-card-links+detail-pages-with-inline-apply-form',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  dryRunFile: 'kissflow/jobs.json',
  verifiedOn: '2026-08-15',
  verifiedSurfaceSummary:
    'Verified on Saturday, August 15, 2026 that the official Kissflow careers route at https://kissflow.com/careers/ redirects to the first-party jobs site https://careers.kissflow.com/, and that the live Open Positions section on that same first-party careers domain currently exposes 2 public role cards with detail pages: Solution Advisor and Client Director. Each verified role detail page exposes a title, experience band, India work location, job description, and inline apply form on the same first-party domain.',
}

export default KISSFLOW_CATALOG
