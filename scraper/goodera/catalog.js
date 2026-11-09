import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const VERIFIED_SURFACE_SUMMARY =
  'Verified on Friday, July 17, 2026 that https://www.goodera.com/about/about-us is the live first-party Goodera about page, that https://www.goodera.com/about/contact-us is the live first-party contact page and links Careers to the public Kula board at https://careers.kula.ai/goodera, and that the public board at https://careers.kula.ai/goodera?jobs=true exposes India roles including AI Engineer, Manager - Financial Reporting & Consolidation, and Skill-Based Volunteering Associate. Also verified that the sample public detail page https://careers.kula.ai/goodera/32968/ is live for Skill-Based Volunteering Associate. This provider follows the verified first-party handoff and scrapes India roles from the public Kula board.'

export const GOODERA_CATALOG = {
  source: 'goodera',
  companyName: 'Goodera',
  officialBrandName: 'Goodera',
  adapter: 'script',
  homepageUrl: 'https://www.goodera.com/',
  aboutUsUrl: 'https://www.goodera.com/about/about-us',
  companyCareerPage: 'https://www.goodera.com/about/contact-us',
  officialCareersPageUrl: 'https://www.goodera.com/about/contact-us',
  officialKulaCompanyUrl: 'https://careers.kula.ai/goodera',
  officialJobsBoardUrl: 'https://careers.kula.ai/goodera?jobs=true',
  verifiedSampleJobUrl: 'https://careers.kula.ai/goodera/32968/',
  companyDomain: 'goodera.com',
  atsPlatform: 'kula',
  countryFilter: 'India',
  paginationStrategy: 'first-party-contact-page-plus-public-kula-board',
  extractionStrategy:
    'verified-first-party-about-page+verified-first-party-contact-page+kula-embedded-jobs-json+india-location-filter',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-17',
  verifiedSurfaceSummary: VERIFIED_SURFACE_SUMMARY,
  dryRunFile: 'goodera/jobs.json',
  modulePath: path.join(currentDir, 'script.js'),
}

export default GOODERA_CATALOG
