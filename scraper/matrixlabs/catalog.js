import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const VERIFIED_SURFACE_SUMMARY =
  'Verified on Monday, August 3, 2026 that https://matrixlabs.co.in/ is the live first-party homepage for Matrix Labs Pvt Ltd, that https://matrixlabs.co.in/career/ remains the exact linked first-party career page, and that the current public careers surface is still resume-only: it asks candidates to share resumes at hr@matrixlabs.co.in without publishing trustworthy public job cards, detail pages, or ATS listings. Also verified on the same date that adjacent first-party routes https://matrixlabs.co.in/careers/, https://matrixlabs.co.in/jobs/, and https://matrixlabs.co.in/join-us/ returned 404 responses. There is no trustworthy public jobs surface on the official Matrix Labs domain right now.'

export const MATRIX_LABS_CATALOG = {
  source: 'matrixlabs',
  companyName: 'Matrix Labs',
  officialBrandName: 'Matrix Labs Pvt Ltd',
  adapter: 'script',
  homepageUrl: 'https://matrixlabs.co.in/',
  companyCareerPage: 'https://matrixlabs.co.in/career/',
  applicationEmail: 'hr@matrixlabs.co.in',
  applicationUrl: 'mailto:hr@matrixlabs.co.in',
  companyDomain: 'matrixlabs.co.in',
  atsPlatform: 'official-company-site-no-public-careers',
  countryFilter: 'India',
  paginationStrategy: 'verified-homepage-plus-resume-only-career-page-plus-missing-route-validation',
  extractionStrategy: 'verified-homepage+verified-resume-only-career-page+verified-missing-career-routes-return-empty',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-08-03',
  verifiedSurfaceSummary: VERIFIED_SURFACE_SUMMARY,
  dryRunFile: 'matrixlabs/jobs.json',
  modulePath: path.resolve(currentDir, 'script.js'),
}

export default MATRIX_LABS_CATALOG
