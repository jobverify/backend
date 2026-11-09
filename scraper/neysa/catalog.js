import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const VERIFIED_SURFACE_SUMMARY =
  'Verified on Friday, August 7, 2026 that https://neysa.ai/careers/ remained the official first-party Neysa careers page titled Careers at Neysa | Build the Future of AI Infrastructure, and that its View Job Openings link still leads to the same-domain public jobs board at https://neysa.ai/careers/job-openings/. Live verification on Friday, August 7, 2026 confirmed that the job openings page titled Job Opening - Build a Career at Neysa rendered 8 public jobs across Finance, Operations, Sales, and Tech, and that current role detail pages such as https://neysa.ai/careers/job-openings/?job_id=51964 expose first-party job descriptions plus Kula apply links.'

export const NEYSA_CATALOG = {
  source: 'neysa',
  companyName: 'Neysa',
  officialBrandName: 'Neysa',
  legalEntityName: 'Neysa Networks Private Limited',
  adapter: 'script',
  modulePath: path.resolve(currentDir, 'script.js'),
  dryRunFile: 'neysa/jobs.json',
  homepageUrl: 'https://neysa.ai/',
  companyCareerPage: 'https://neysa.ai/careers/',
  companyDomain: 'neysa.ai',
  officialJobOpeningsUrl: 'https://neysa.ai/careers/job-openings/',
  officialAboutUrl: 'https://neysa.ai/about-us/',
  officialPrivacyUrl: 'https://neysa.ai/privacy-policy/',
  verifiedSampleJobUrl: 'https://neysa.ai/careers/job-openings/?job_id=51964',
  verifiedPublicJobCount: 8,
  atsPlatform: 'official-company-careers',
  countryFilter: 'India',
  paginationStrategy: 'official-careers-page-plus-same-domain-job-openings-page',
  extractionStrategy:
    'verified-first-party-careers-page+verified-same-domain-job-openings-page+detail-pages',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-08-07',
  verifiedSurfaceSummary: VERIFIED_SURFACE_SUMMARY,
}

export default NEYSA_CATALOG
