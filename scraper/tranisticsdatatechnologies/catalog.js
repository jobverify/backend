import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const TRANISTICS_DATA_TECHNOLOGIES_CATALOG = {
  source: 'tranisticsdatatechnologies',
  companyName: 'Tranistics Data Technologies',
  officialBrandName: 'Tranistics Data Technologies',
  adapter: 'script',
  companyCareerPage: 'https://www.tranistics.com/',
  companyDomain: 'tranistics.com',
  contactPageUrl: 'https://www.tranistics.com/contact-us/',
  atsPlatform: 'official-company-site-no-public-careers',
  countryFilter: 'India',
  paginationStrategy: 'homepage-plus-contact-plus-common-careers-route-validation',
  extractionStrategy: 'verified-homepage+verified-contact-page+verified-missing-careers-routes-return-empty',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-17',
  verifiedSurfaceSummary:
    'Verified on Friday, July 17, 2026 that https://www.tranistics.com/ was the live first-party Tranistics Data Technologies site and that https://www.tranistics.com/contact-us/ was the live contact page, but no trustworthy public careers or jobs surface was exposed on the verified first-party routes.',
  dryRunFile: 'tranisticsdatatechnologies/jobs.json',
  modulePath: path.resolve(currentDir, 'script.js'),
}

export default TRANISTICS_DATA_TECHNOLOGIES_CATALOG
