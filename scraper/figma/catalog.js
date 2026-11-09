export const VERIFIED_SURFACE_SUMMARY =
  "Verified on July 15, 2026 that https://www.figma.com/careers/ is Figma's live first-party careers page with a Job openings anchor at https://www.figma.com/careers/#job-openings and inline public Greenhouse job detail URLs under https://boards.greenhouse.io/figma/jobs/. Verified that the public jobs feed is https://boards-api.greenhouse.io/v1/boards/figma/jobs?content=true, which returned 166 live roles including Account Executive, Enterprise (Bengaluru, India) at https://boards.greenhouse.io/figma/jobs/5579204004?gh_jid=5579204004 and Enterprise Solutions Consultant (Bengaluru, India) at https://boards.greenhouse.io/figma/jobs/5615966004?gh_jid=5615966004."

export const FIGMA_CATALOG = {
  source: 'figma',
  companyName: 'Figma',
  adapter: 'script',
  modulePath: '../../scraper/figma/script.js',
  companyCareerPage: 'https://www.figma.com/careers/',
  officialCareersLandingUrl: 'https://www.figma.com/careers/',
  greenhouseJobsApiUrl: 'https://boards-api.greenhouse.io/v1/boards/figma/jobs',
  greenhouseJobBaseUrl: 'https://boards.greenhouse.io/figma/jobs',
  sampleJobUrl: 'https://boards.greenhouse.io/figma/jobs/5579204004?gh_jid=5579204004',
  atsPlatform: 'greenhouse',
  paginationStrategy: 'single-greenhouse-jobs-api-content-page',
  extractionStrategy:
    'verified-first-party-careers-page+inline-greenhouse-job-links+greenhouse-jobs-api+public-greenhouse-detail-urls',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  companyDomain: 'figma.com',
  verifiedOn: '2026-07-15',
  verifiedSurfaceSummary: VERIFIED_SURFACE_SUMMARY,
}

export default FIGMA_CATALOG

