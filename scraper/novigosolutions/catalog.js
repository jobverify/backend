import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const NOVIGO_SOLUTIONS_CATALOG = {
  source: 'novigosolutions',
  companyName: 'Novigo Solutions',
  officialBrandName: 'Novigo Solutions',
  adapter: 'script',
  homepageUrl: 'https://www.novigosolutions.com/',
  companyCareerPage: 'https://www.novigosolutions.com/careers-life-at-novigo',
  companyDomain: 'novigosolutions.com',
  atsPlatform: 'first-party-careers-page-inline-role-list',
  countryFilter: 'India',
  paginationStrategy: 'single-first-party-careers-page',
  extractionStrategy:
    'verified-first-party-careers-page+visible-inline-role-sections+same-page-apply-form',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-08-03',
  verifiedSurfaceSummary:
    'Verified on Monday, August 3, 2026 that https://www.novigosolutions.com/careers-life-at-novigo remained the live exact-name Novigo Solutions first-party careers page, that it publicly rendered seven visible inline role sections such as ".Net Developer (2-5 Years)," "Angular Developer (3-6 Years)," "RPA Ui Path Developer (2-6 Years)," "Python Developer (3-6 Years)," "Salesforce Developer (3-6 Years)," "Test Engineer (3-6 Years)," and "MS SQL Developer (3-6 Years)," that the shared visible location text remained "Bangalore / Mangalore / Remote work during Pandemic.," and that each role remained paired with the shared "Apply Online" same-page resume form. The trusted public inventory is therefore scraped directly from the first-party page.',
  modulePath: path.resolve(currentDir, 'script.js'),
  dryRunFile: 'novigosolutions/jobs.json',
}

export default NOVIGO_SOLUTIONS_CATALOG
