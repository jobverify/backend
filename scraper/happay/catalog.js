import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const HAPPAY_CATALOG = {
  source: 'happay',
  companyName: 'Happay',
  officialBrandName: 'Happay',
  adapter: 'script',
  homepageUrl: 'https://happay.com/',
  companyCareerPage: 'https://happay.com/careers/',
  jobsPageUrl: 'https://happay.com/jobs/',
  contactPageUrl: 'https://happay.com/contact-us/',
  atsPlatform: 'official-company-site-unresolved-listing-contract',
  countryFilter: 'India',
  paginationStrategy: 'verified-first-party-careers-pages-without-public-job-listings',
  extractionStrategy:
    'verified-first-party-careers-page+verified-jobs-shortcode-page-return-empty',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  companyDomain: 'happay.com',
  verifiedOn: '2026-07-17',
  verifiedSurfaceSummary:
    'Verified on Friday, July 17, 2026 that https://happay.com/careers/ was the live first-party Happay careers page and still rendered Current Openings with Happay-MMT branding, that https://happay.com/jobs/ resolved on the first-party domain but only exposed the literal shortcode [jobs per_page="12" show_filters="true"] instead of public listings, and that https://happay.com/contact-us/ still routed hiring contact through careers@happay.in under MakeMyTrip India Private Limited. No trustworthy public Happay jobs listing contract was exposed from the first-party surface, so this provider is fail-closed.',
  modulePath: path.resolve(currentDir, 'script.js'),
  dryRunFile: 'happay/jobs.json',
}

export default HAPPAY_CATALOG
