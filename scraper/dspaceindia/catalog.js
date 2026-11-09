export const VERIFIED_SURFACE_SUMMARY =
  'Verified on July 15, 2026 that https://www.dspace.com/en/pub/home/career.cfm is dSPACEâ€™s live first-party careers landing page, and that https://www.dspace.com/en/pub/home/career/jobfinder/stellen.cfm is the live first-party Current Positions board. The Current Positions page exposes the public inline Vue results contract through :filter-sections and :results-data, including the India country filter term term-land-9 and the Trivandrum location term term-ort-1031. Verified that this first-party board returned 12 live India roles on July 15, 2026, including Software Developer (f/m/d) at https://www.dspace.com/en/pub/home/career/jobfinder/stellen.cfm?fuseaction=einzel&jid=38151&t=Software%20Developer%20%28f%2Fm%2Fd%29, and that India detail pages expose first-party JobPosting metadata plus the application contact career.tvm@dspace.in.'

export const DSPACE_INDIA_CATALOG = {
  source: 'dspaceindia',
  companyName: 'dSpace India',
  adapter: 'script',
  modulePath: '../../scraper/dspaceindia/script.js',
  companyCareerPage: 'https://www.dspace.com/en/pub/home/career/jobfinder/stellen.cfm',
  officialCareersLandingUrl: 'https://www.dspace.com/en/pub/home/career.cfm',
  jobFinderEntryUrl: 'https://www.dspace.com/en/pub/home/career/jobfinder.cfm',
  indiaCountryFilterTerm: 'term-land-9',
  indiaLocationFilterTerm: 'term-ort-1031',
  indiaLocationName: 'Trivandrum',
  applicationEmail: 'career.tvm@dspace.in',
  sampleJobUrl:
    'https://www.dspace.com/en/pub/home/career/jobfinder/stellen.cfm?fuseaction=einzel&jid=38151&t=Software%20Developer%20%28f%2Fm%2Fd%29',
  atsPlatform: 'official-company-site',
  countryFilter: 'India',
  paginationStrategy: 'single-inline-results-data-array',
  extractionStrategy:
    'verified-first-party-careers-page+verified-first-party-current-positions-page+inline-results-data+india-country-filter+first-party-jobposting-detail-pages',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  companyDomain: 'dspace.com',
  verifiedOn: '2026-07-15',
  verifiedSurfaceSummary: VERIFIED_SURFACE_SUMMARY,
}

export default DSPACE_INDIA_CATALOG

