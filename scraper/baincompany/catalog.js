import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const VERIFIED_INDIA_OFFICES = ['Bengaluru', 'Mumbai', 'New Delhi']

export const VERIFIED_SURFACE_SUMMARY =
  'Verified on July 15, 2026 that https://www.bain.com/careers/ exposes the live Bain careers home and links FIND JOBS to https://www.bain.com/careers/find-a-role/, that the live search shell at https://www.bain.com/careers/find-a-role/ exposes the first-party API endpoint https://www.bain.com/en/api/jobsearch/keyword/get plus the first-party detail route /careers/find-a-role/position/, and that the public all-roles API query https://www.bain.com/en/api/jobsearch/keyword/get?start=0&results=500&filters=&searchValue= returned 253 public roles, 76 India-facing roles, and explicit Indian office signals for Bengaluru, Mumbai, or New Delhi. Verified first-party detail and apply handoffs include https://www.bain.com/careers/find-a-role/position/?jobid=105837 -> https://careers.bain.com/jobs/Login?folderId=105837, https://www.bain.com/careers/find-a-role/position/?jobid=100975 -> https://careers.bain.com/jobs/Login?folderId=100975, the program page https://www.bain.com/careers/work-with-us/internships-programs/associate-consultant-internship/ -> https://careers.bain.com/recruits/signin?folderId=10403, and the India scholarship page https://www.bain.com/careers/work-with-us/internships-programs/true-north-scholarship-for-women-india/.'

export const BAIN_COMPANY_CATALOG = {
  source: 'baincompany',
  companyName: 'Bain & Company',
  officialBrandName: 'Bain & Company, Inc.',
  adapter: 'script',
  homepageUrl: 'https://www.bain.com/',
  careersHomeUrl: 'https://www.bain.com/careers/',
  companyCareerPage: 'https://www.bain.com/careers/find-a-role/',
  jobSearchApiUrl: 'https://www.bain.com/en/api/jobsearch/keyword/get',
  allRolesApiUrl:
    'https://www.bain.com/en/api/jobsearch/keyword/get?start=0&results=500&filters=&searchValue=',
  positionApplyBaseUrl: 'https://careers.bain.com/jobs/Login?folderId=',
  verifiedSamplePositionUrl: 'https://www.bain.com/careers/find-a-role/position/?jobid=105837',
  verifiedSampleApplyUrl: 'https://careers.bain.com/jobs/Login?folderId=105837',
  verifiedSampleProgramUrl:
    'https://www.bain.com/careers/work-with-us/internships-programs/associate-consultant-internship/',
  verifiedSampleProgramApplyUrl: 'https://careers.bain.com/recruits/signin?folderId=10403',
  verifiedScholarshipUrl:
    'https://www.bain.com/careers/work-with-us/internships-programs/true-north-scholarship-for-women-india/',
  verifiedIndiaOffices: VERIFIED_INDIA_OFFICES,
  verifiedIndiaJobCount: 76,
  companyDomain: 'bain.com',
  atsPlatform: 'first-party-jobsearch-api',
  countryFilter: 'India',
  paginationStrategy: 'single-first-party-jobsearch-api-request-up-to-500-results',
  extractionStrategy:
    'verified-careers-home+verified-find-a-role-shell+verified-first-party-jobsearch-api+india-office-filter+position-apply-handoff',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-15',
  verifiedSurfaceSummary: VERIFIED_SURFACE_SUMMARY,
  dryRunFile: 'baincompany/jobs.json',
  modulePath: path.resolve(currentDir, 'script.js'),
}

export default BAIN_COMPANY_CATALOG
