import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const VERIFIED_SURFACE_SUMMARY =
  'Verified on Monday, August 3, 2026 that https://www.lexmark.com/en_us/about-us/careers.html is still the official Lexmark careers page and still hands Apply Now to https://lexmark.wd1.myworkdayjobs.com/Lexmark. The public Workday Candidate Experience board now enumerates openings through https://lexmark.wd1.myworkdayjobs.com/wday/cxs/lexmark/Lexmark/jobs and exposes detail JSON such as https://lexmark.wd1.myworkdayjobs.com/wday/cxs/lexmark/Lexmark/job/Shenzhen--China/Logistic-Specialist_R5733. The live board currently exposes one public role, Logistic Specialist in Shenzhen, China, and no India roles, so this provider now verifies the Workday API directly and returns an authoritative empty India result instead of relying on the retired outage sentinel.'

export const LEXMARK_INTERNATIONAL_CATALOG = {
  source: 'lexmarkinternational',
  companyName: 'Lexmark International',
  officialBrandName: 'Lexmark',
  adapter: 'script',
  homepageUrl: 'https://www.lexmark.com/',
  companyCareerPage: 'https://www.lexmark.com/en_us/about-us/careers.html',
  officialCareersPageUrl: 'https://www.lexmark.com/en_us/about-us/careers.html',
  officialWorkdayBoardUrl: 'https://lexmark.wd1.myworkdayjobs.com/Lexmark',
  jobsApiUrl: 'https://lexmark.wd1.myworkdayjobs.com/wday/cxs/lexmark/Lexmark/jobs',
  jobDetailExampleUrl:
    'https://lexmark.wd1.myworkdayjobs.com/wday/cxs/lexmark/Lexmark/job/Shenzhen--China/Logistic-Specialist_R5733',
  companyDomain: 'lexmark.com',
  atsPlatform: 'workday-candidate-experience',
  countryFilter: 'India',
  paginationStrategy: 'first-party-careers-page-plus-workday-cxs-jobs-api',
  extractionStrategy:
    'verified-first-party-careers-page+verified-workday-handoff+verified-workday-cxs-list+detail-json+india-country-filter',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-08-03',
  verifiedPublicJobCount: 1,
  verifiedSurfaceSummary: VERIFIED_SURFACE_SUMMARY,
  dryRunFile: 'lexmarkinternational/jobs.json',
  modulePath: path.resolve(currentDir, 'script.js'),
}

export default LEXMARK_INTERNATIONAL_CATALOG
