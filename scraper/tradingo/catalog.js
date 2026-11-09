import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const TRADINGO_CATALOG = {
  source: 'tradingo',
  companyName: 'Tradingo',
  officialBrandName: 'Tradingo',
  adapter: 'script',
  companyCareerPage: 'https://www.gotradingo.com/careers',
  officialCareersPageUrl: 'https://www.gotradingo.com/careers',
  applicationFormUrl: 'https://docs.google.com/forms/d/e/1FAIpQLSfNz7KmZ4ywOs8qJI2RhykU9kCzSZZxxRIJdk-ZkupIbZ4Nqw/viewform?usp=pp_url',
  companyDomain: 'gotradingo.com',
  atsPlatform: 'first-party-html-board',
  countryFilter: 'India',
  paginationStrategy: 'single-public-page',
  extractionStrategy: 'verified-first-party-careers-page+inline-role-cards+shared-google-form-apply-route',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-17',
  verifiedSurfaceSummary:
    "Verified on Friday, July 17, 2026 that https://www.gotradingo.com/careers is the live first-party Tradingo careers page and that it publicly exposes Job Opportunities role cards for Customer Acquisition Manager and Relationship Manager under the Sales heading. Anonymous verification also showed each visible role using the same Google Forms application URL at https://docs.google.com/forms/d/e/1FAIpQLSfNz7KmZ4ywOs8qJI2RhykU9kCzSZZxxRIJdk-ZkupIbZ4Nqw/viewform?usp=pp_url, with no explicit per-role location published on the cards.",
  dryRunFile: 'tradingo/jobs.json',
  modulePath: path.resolve(currentDir, 'script.js'),
}

export default TRADINGO_CATALOG
