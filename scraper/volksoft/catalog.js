import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const VERIFIED_SURFACE_SUMMARY =
  'Verified on Friday, July 17, 2026 that https://volksoft.in/careers/ was the live first-party VolkSoft careers page, but the public openings area still rendered repeated placeholder cards headed "Lorem ipsum dolor sit amet" instead of trustworthy real job titles. The same verified page exposed a resume-upload form with fields including "Position Applying For" and "Resume/CV", so the current surface is treated as a placeholder-only careers shell with not trustworthy public job listings.'

export const VOLKSOFT_TECHNOLOGIES_CATALOG = {
  source: 'volksoft',
  companyName: 'Volksoft Technologies',
  officialBrandName: 'VolkSoft',
  adapter: 'script',
  homepageUrl: 'https://volksoft.in/',
  companyCareerPage: 'https://volksoft.in/careers/',
  companyDomain: 'volksoft.in',
  atsPlatform: 'official-company-careers-placeholder-openings',
  countryFilter: 'India',
  paginationStrategy: 'verified-single-careers-page-plus-placeholder-opening-validation',
  extractionStrategy: 'verified-first-party-careers-page+verified-placeholder-opening-cards+resume-upload-form-return-empty',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-17',
  verifiedSurfaceSummary: VERIFIED_SURFACE_SUMMARY,
  dryRunFile: 'volksoft/jobs.json',
  modulePath: path.resolve(currentDir, 'script.js'),
}

export default VOLKSOFT_TECHNOLOGIES_CATALOG
