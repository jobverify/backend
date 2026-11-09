import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const VERIFIED_SURFACE_SUMMARY = 'Verified on Friday, July 17, 2026 that the official SpiceJet careers notice at https://corporate.spicejet.com/Careers.aspx?source=aero.jobs published the February 2026 cabin crew interview notice, the Spice Star Academy registration handoff at https://application.spicestaracademy.edu.in/, and the recruitment contact address careers@spicejet.com under the Public Notice, while the public AME registration form at https://corporate.spicejet.com/careers/AME.aspx remained a live first-party multipart application form with email, license, and resume fields but no trustworthy enumerable public jobs surface. As of the verified date, these first-party recruitment surfaces are real but non-enumerable, so this provider intentionally fails closed and returns [].'

export const SPICEJET_CATALOG = {
  source: 'spicejet',
  companyName: 'SpiceJet',
  officialBrandName: 'SpiceJet',
  adapter: 'script',
  companyCareerPage: 'https://corporate.spicejet.com/Careers.aspx?source=aero.jobs',
  ameRegistrationUrl: 'https://corporate.spicejet.com/careers/AME.aspx',
  spiceStarRegistrationUrl: 'https://application.spicestaracademy.edu.in/',
  companyDomain: 'corporate.spicejet.com',
  atsPlatform: 'official-company-site-no-trustworthy-public-jobs-surface',
  countryFilter: 'India',
  paginationStrategy: 'verified-careers-notice-plus-ame-registration-form-validation',
  extractionStrategy: 'verified-careers-notice+verified-ame-registration-form+return-empty-when-no-enumerable-public-jobs',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-17',
  verifiedSurfaceSummary: VERIFIED_SURFACE_SUMMARY,
  dryRunFile: 'spicejet/jobs.json',
  modulePath: path.resolve(currentDir, 'script.js'),
}

export default SPICEJET_CATALOG
