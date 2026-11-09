export const KAYNES_TECHNOLOGY_CATALOG = {
  source: 'kaynestechnology',
  companyName: 'Kaynes Technology',
  officialBrandName: 'Kaynes Technology India Limited',
  adapter: 'script',
  modulePath: '../../scraper/kaynestechnology/script.js',
  dryRunFile: 'kaynestechnology/jobs.json',
  homepageUrl: 'https://www.kaynestechnology.co.in/index.html',
  companyCareerPage: 'https://www.kaynestechnology.co.in/index.html',
  companyDomain: 'kaynestechnology.co.in',
  atsPlatform: 'official-company-careers-empty-board',
  countryFilter: 'India',
  paginationStrategy: 'homepage-plus-adjacent-route-404-validation',
  extractionStrategy: 'verified-homepage+missing-common-careers-routes-return-empty',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-16',
  verifiedSurfaceSummary:
    'Verified on Thursday, July 16, 2026 that https://www.kaynestechnology.co.in/index.html is the live first-party Kaynes Technology India Limited homepage and that it prominently warns candidates to beware of recruitment frauds. Verified that common first-party hiring routes including https://www.kaynestechnology.co.in/careers.html, https://www.kaynestechnology.co.in/careers, https://www.kaynestechnology.co.in/jobs.html, and https://www.kaynestechnology.co.in/recruitment.html return first-party 404 pages. No trustworthy public jobs surface is currently exposed, so this provider fails closed and returns an empty array.',
}

export default KAYNES_TECHNOLOGY_CATALOG

