import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PATANJALI_CATALOG = {
  source: 'patanjali',
  companyName: 'Patanjali',
  officialBrandName: 'Patanjali Ayurved',
  adapter: 'script',
  modulePath: path.resolve(currentDir, 'script.js'),
  dryRunFile: 'patanjali/jobs.json',
  homepageUrl: 'https://patanjaliayurved.org/',
  companyCareerPage: 'https://patanjaliayurved.org/career.html',
  officialApplicationFormUrl: 'https://patanjaliayurved.org/career.php',
  officialCareerContactPage: 'https://patanjaliayurved.org/contact.html',
  officialCareerEmail: 'career@patanjaliayurved.org',
  cautionNoticeUrl: 'https://patanjaliayurved.org/caution-notice.html',
  companyDomain: 'patanjaliayurved.org',
  atsPlatform: 'official-company-site-no-public-careers',
  countryFilter: 'India',
  paginationStrategy: 'verified-careers-page-iframe-plus-contact-and-caution-validation',
  extractionStrategy:
    'verified-first-party-careers-page+embedded-application-form+career-email-without-public-job-listings-return-empty',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-17',
  verifiedSurfaceSummary:
    'Verified on Friday, July 17, 2026 that https://patanjaliayurved.org/career.html is the official Patanjali Ayurved careers page linked from the official contact page, and that it embeds the first-party application form at https://patanjaliayurved.org/career.php. The embedded surface is a generic Job Application Form with category dropdowns and resume upload, the official contact page lists career@patanjaliayurved.org, and the official caution notice warns about fake appointment letters and people promising jobs for money. There is no trustworthy public jobs surface, public listings feed, or public job detail page on the exact-name Patanjali domains, so this provider is pinned as a fail-closed sentinel that returns no jobs until structured public listings appear.',
}

export default PATANJALI_CATALOG
