import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const VERIFIED_SURFACE_SUMMARY =
  'Verified on July 15, 2026 that the official Five-Star Business Finance Limited homepage at https://fivestargroup.in/ is live and links its careers entry to https://fivestargroup.in/careers/, and that the official careers page is currently a contact-style shell headed "Careers" and "Company Culture" with "Contact us" messaging instead of public job listings or a trustworthy ATS handoff. No trustworthy public jobs surface was exposed on the verified first-party careers route for the exact backlog company name Five Star Business Finance.'

export const FIVE_STAR_BUSINESS_FINANCE_CATALOG = {
  source: 'fivestarbusinessfinance',
  companyName: 'Five Star Business Finance',
  officialBrandName: 'Five-Star Business Finance Limited',
  adapter: 'script',
  homepageUrl: 'https://fivestargroup.in/',
  companyCareerPage: 'https://fivestargroup.in/careers/',
  careerPageUrl: 'https://fivestargroup.in/careers/',
  companyDomain: 'fivestargroup.in',
  atsPlatform: 'official-company-careers-empty-shell',
  countryFilter: 'India',
  paginationStrategy: 'homepage-plus-empty-careers-shell-validation',
  extractionStrategy:
    'verified-homepage-careers-link+verified-careers-shell-without-public-jobs+return-empty',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-15',
  verifiedSurfaceSummary: VERIFIED_SURFACE_SUMMARY,
  dryRunFile: 'fivestarbusinessfinance/jobs.json',
  modulePath: path.resolve(currentDir, 'script.js'),
}

export default FIVE_STAR_BUSINESS_FINANCE_CATALOG
