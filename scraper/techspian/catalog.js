import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const TECHSPIAN_CATALOG = {
  source: 'techspian',
  companyName: 'Techspian',
  officialBrandName: 'Techspian',
  adapter: 'script',
  modulePath: path.resolve(currentDir, 'script.js'),
  dryRunFile: 'techspian/jobs.json',
  officialHomepageUrl: 'https://techspian.com/',
  companyCareerPage: 'https://www.techspian.com/techspian-careers/',
  redirectedCareersPageUrl: 'https://techspian.com/about',
  officialContactUrl: 'https://techspian.com/contact',
  officialContactEmail: 'marketing@techspian.com',
  companyDomain: 'techspian.com',
  atsPlatform: 'official-company-site-no-public-careers',
  countryFilter: 'India',
  paginationStrategy: 'verified-legacy-careers-redirect-plus-contact-page',
  extractionStrategy:
    'verified-legacy-careers-redirect+about-page+contact-page-without-trustworthy-public-jobs-return-empty',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-08-05',
  verifiedSurfaceSummary:
    'Verified on Wednesday, August 5, 2026 that https://www.techspian.com/techspian-careers/ redirects to https://techspian.com/about, where the live first-party page presents Techspian about/brand content such as "We were AI-native before it was a slide." and "The people behind the work." Verified on Wednesday, August 5, 2026 that the first-party contact route https://techspian.com/contact presents contact/strategy content and the email marketing@techspian.com. There is no trustworthy public jobs surface, no public ATS handoff, and no machine-readable job postings on these verified first-party routes as of August 5, 2026, so this provider intentionally fails closed and returns an empty array until Techspian publishes a trustworthy exact-name public jobs surface.',
}

export default TECHSPIAN_CATALOG
