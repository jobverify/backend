import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const FIVETRAN_CATALOG = {
  source: 'fivetran',
  companyName: 'Fivetran',
  officialBrandName: 'Fivetran',
  adapter: 'script',
  modulePath: path.resolve(currentDir, 'script.js'),
  companyCareerPage: 'https://www.fivetran.com/careers',
  officialCareersLandingUrl: 'https://www.fivetran.com/careers',
  greenhouseAlertUrl: 'https://my.greenhouse.io/users/sign_in?job_board=fivetran',
  greenhouseBoardSlug: 'fivetran',
  greenhouseBoardUrl: 'https://job-boards.greenhouse.io/fivetran',
  greenhouseJobsApiUrl: 'https://boards-api.greenhouse.io/v1/boards/fivetran/jobs',
  atsPlatform: 'greenhouse',
  paginationStrategy: 'single-greenhouse-jobs-api-content-page',
  extractionStrategy:
    'verified-first-party-careers-page+greenhouse-alert-board-slug+greenhouse-board-redirect+derived-greenhouse-jobs-api',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  companyDomain: 'fivetran.com',
  verifiedOn: '2026-08-02',
  verifiedSurfaceSummary:
    'Verified on August 2, 2026 that https://www.fivetran.com/careers is the live first-party Fivetran careers page with the title "Experience ownership, impact, and recognition at Fivetran | Careers at Fivetran", Bengaluru | India and Sydney | Australia office location sections, and a public Greenhouse job-alert handoff at https://my.greenhouse.io/users/sign_in?job_board=fivetran. Verified that https://job-boards.greenhouse.io/fivetran currently resolves back to the same first-party careers page. From that official Greenhouse board slug, the scraper derives the standard public jobs API route https://boards-api.greenhouse.io/v1/boards/fivetran/jobs?content=true, and the returned jobs currently canonicalize to first-party detail pages at https://www.fivetran.com/careers/job?gh_jid=....',
}

export default FIVETRAN_CATALOG
