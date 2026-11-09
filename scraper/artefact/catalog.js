export const VERIFIED_SURFACE_SUMMARY =
  'Verified on October 3, 2026 that https://www.artefact.com/ and https://www.artefact.com/careers/ are accessible again after the earlier BunkerWeb Bot Detection response. The careers list has no India cards on its current first page, while the public Greenhouse board at https://job-boards.greenhouse.io/artefact and API at https://boards-api.greenhouse.io/v1/boards/artefact/jobs?content=true expose 6 India roles in Pune, Maharashtra, India, including https://job-boards.greenhouse.io/artefact/jobs/8360407002, https://job-boards.greenhouse.io/artefact/jobs/7884340002, and SAP Developer.'

export const ARTEFACT_CATALOG = {
  source: 'artefact',
  companyName: 'Artefact',
  adapter: 'script',
  modulePath: '../../scraper/artefact/script.js',
  companyCareerPage: 'https://www.artefact.com/careers/',
  homepageUrl: 'https://www.artefact.com/',
  companyDomain: 'artefact.com',
  atsPlatform: 'official-company-careers',
  greenhouseBoardUrl: 'https://job-boards.greenhouse.io/artefact',
  greenhouseJobsApiUrl: 'https://boards-api.greenhouse.io/v1/boards/artefact/jobs?content=true',
  countryFilter: 'India',
  paginationStrategy: 'bunkerweb-blocked-first-party-pages-plus-public-greenhouse-board-api',
  extractionStrategy:
    'verified-bot-detection-first-party-pages+public-greenhouse-board+greenhouse-jobs-api+india-location-filter',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-10-03',
  verifiedSurfaceSummary: VERIFIED_SURFACE_SUMMARY,
}

export default ARTEFACT_CATALOG
