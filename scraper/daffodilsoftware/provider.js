import {
  CAREER_URL,
  COMPANY,
  SOURCE,
} from './script.js'

export const provider = {
  source: SOURCE,
  companyName: COMPANY,
  adapter: 'script',
  modulePath: '../../scraper/daffodilsoftware/script.js',
  companyCareerPage: CAREER_URL,
  atsPlatform: 'official-company-site-no-public-careers',
  countryFilter: 'India',
  paginationStrategy: 'homepage-plus-career-page-plus-common-route-validation',
  extractionStrategy:
    'verified-homepage+verified-career-culture-page-with-placeholder-open-vacancies+careers-redirect+missing-common-job-routes-return-empty',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  companyDomain: 'daffodilsw.com',
  verifiedOn: '2026-07-14',
  verifiedSurfaceSummary:
    'Verified https://www.daffodilsw.com/ and https://www.daffodilsw.com/career/ on July 14, 2026. There is no trustworthy public jobs surface: the official first-party careers page showed a placeholder "Open Vacancies" section with lorem ipsum copy plus a generic CV submission form, while adjacent first-party job routes did not expose structured openings.',
}

export default provider

