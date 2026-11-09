import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const VERIFIED_SURFACE_SUMMARY =
  'Verified on Sunday, July 19, 2026 that https://www.seclore.com/about/careers/ is the live official Seclore careers page, that it renders the first-party Open Positions section on the same page, and that the public India roles link directly to Seclore Darwinbox detail routes under https://seclore.darwinbox.in/ms/candidatev2/main/careers/jobDetails/. The verified India openings on that page included Senior Sales Engineer, Human Resource Business Partner, Senior Product Engineer, Manager - Taxation & Compliance, Employer Branding Specialist, Senior Product Manager, and Senior DevOps Engineer, with a verified sample public detail route at https://seclore.darwinbox.in/ms/candidatev2/main/careers/jobDetails/a6a3b812ca916f.'

export const SECLORE_CATALOG = {
  source: 'seclore',
  companyName: 'Seclore',
  officialBrandName: 'Seclore',
  adapter: 'script',
  homepageUrl: 'https://www.seclore.com/',
  companyCareerPage: 'https://www.seclore.com/about/careers/',
  companyDomain: 'seclore.com',
  publicJobHost: 'https://seclore.darwinbox.in/ms/candidatev2/main/careers/jobDetails/',
  verifiedSampleJobUrl: 'https://seclore.darwinbox.in/ms/candidatev2/main/careers/jobDetails/a6a3b812ca916f',
  atsPlatform: 'official-company-careers-darwinbox-detail-links',
  countryFilter: 'India',
  paginationStrategy: 'single-first-party-careers-page-inline-opening-links',
  extractionStrategy:
    'verified-first-party-careers-page+inline-darwinbox-detail-links+india-location-filter',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-19',
  verifiedSurfaceSummary: VERIFIED_SURFACE_SUMMARY,
  dryRunFile: 'seclore/jobs.json',
  modulePath: path.join(currentDir, 'script.js'),
}

export default SECLORE_CATALOG
