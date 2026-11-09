export const VERIFIED_SURFACE_SUMMARY =
  'Verified on Sunday, August 2, 2026 that direct non-browser requests to https://www.dremio.com/careers/ and https://www.dremio.com/careers/job-postings/ returned first-party Cloudflare 403 block pages, while the public Greenhouse jobs feed at https://boards-api.greenhouse.io/v1/boards/dremio/jobs?content=true remained live and returned 1 public role. The live role verified on that date was Future Opportunities at https://www.dremio.com/careers/job-postings/?gh_jid=6314003003.'

export const DREMIO_CATALOG = {
  source: 'dremio',
  companyName: 'Dremio',
  adapter: 'script',
  modulePath: '../../scraper/dremio/script.js',
  companyCareerPage: 'https://www.dremio.com/careers/job-postings/',
  officialCareersLandingUrl: 'https://www.dremio.com/careers/',
  greenhouseEmbedScriptUrl: 'https://boards.greenhouse.io/embed/job_board/js?for=dremio',
  greenhouseJobsApiUrl: 'https://boards-api.greenhouse.io/v1/boards/dremio/jobs',
  sampleJobUrl: 'https://www.dremio.com/careers/job-postings/?gh_jid=6314003003',
  atsPlatform: 'greenhouse',
  paginationStrategy: 'single-greenhouse-jobs-api-content-page',
  extractionStrategy:
    'verified-first-party-careers-page-or-cloudflare-block+verified-first-party-job-postings-page-or-cloudflare-block+greenhouse-jobs-api+first-party-detail-urls',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  companyDomain: 'dremio.com',
  verifiedOn: '2026-08-02',
  verifiedSurfaceSummary: VERIFIED_SURFACE_SUMMARY,
}

export default DREMIO_CATALOG

