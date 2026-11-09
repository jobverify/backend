import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const VERIFIED_SURFACE_SUMMARY =
  'Verified on Friday, July 17, 2026 that https://www.cloudmoyo.com/contact-us/ was the live first-party CloudMoyo contact and careers handoff page, that it advertised Career Opportunities via recruitment@cloudmoyo.com and linked India candidates to the public SmartRecruiters board at https://careers.smartrecruiters.com/CloudMoyo/cloudmoyo-india-careers?remoteLocation=true, and that the verified India board currently states "No job postings are currently available."'

export const CLOUDMOYO_CATALOG = {
  source: 'cloudmoyo',
  companyName: 'CloudMoyo',
  officialBrandName: 'CloudMoyo',
  adapter: 'script',
  homepageUrl: 'https://www.cloudmoyo.com/',
  companyCareerPage: 'https://www.cloudmoyo.com/contact-us/',
  boardUrl: 'https://careers.smartrecruiters.com/CloudMoyo/cloudmoyo-india-careers?remoteLocation=true',
  companyDomain: 'cloudmoyo.com',
  atsPlatform: 'smartrecruiters-empty-board',
  countryFilter: 'India',
  paginationStrategy: 'official-contact-page-plus-smartrecruiters-india-empty-board',
  extractionStrategy: 'verified-contact-page+verified-smartrecruiters-india-empty-board-return-empty',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-17',
  verifiedSurfaceSummary: VERIFIED_SURFACE_SUMMARY,
  dryRunFile: 'cloudmoyo/jobs.json',
  modulePath: path.resolve(currentDir, 'script.js'),
}

export default CLOUDMOYO_CATALOG
