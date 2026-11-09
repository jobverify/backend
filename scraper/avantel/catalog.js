import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const VERIFIED_ROLE_TITLES = [
  'Embedded Senior Engineer',
  'Design Engineer - Parabolic & Earth Station Antennas',
  'PCB Designer Engineer',
  'Quality Management System',
  'RF Manager / Senior Manager',
  'Project Manager',
  'Senior Manager / DGM - Quality',
]

export const VERIFIED_SURFACE_SUMMARY =
  'Verified on July 15, 2026 that https://www.avantel.in/ and https://www.avantel.in/careers resolve to the live first-party Avantel SPA shell, that both routes load the current careers bundle at https://www.avantel.in/static/js/main.bc2d10f8.js, and that the embedded public jobListings array currently exposes 7 public openings routed through the first-party /jobdescription handoff: Embedded Senior Engineer, Design Engineer - Parabolic & Earth Station Antennas, PCB Designer Engineer, Quality Management System, RF Manager / Senior Manager, Project Manager, and Senior Manager / DGM - Quality.'

export const AVANTEL_CATALOG = {
  source: 'avantel',
  companyName: 'Avantel',
  officialBrandName: 'Avantel Limited',
  adapter: 'script',
  homepageUrl: 'https://www.avantel.in/',
  companyCareerPage: 'https://www.avantel.in/careers',
  jobDescriptionRouteUrl: 'https://www.avantel.in/jobdescription',
  bundleUrl: 'https://www.avantel.in/static/js/main.bc2d10f8.js',
  verifiedRoleTitles: VERIFIED_ROLE_TITLES,
  companyDomain: 'avantel.in',
  atsPlatform: 'official-company-careers-spa-bundle',
  countryFilter: 'India',
  paginationStrategy: 'single-first-party-spa-bundle-embedded-job-array',
  extractionStrategy:
    'verified-homepage-shell+verified-careers-shell+verified-main-bundle+embedded-jobListings-array+first-party-jobdescription-route',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-15',
  verifiedSurfaceSummary: VERIFIED_SURFACE_SUMMARY,
  dryRunFile: 'avantel/jobs.json',
  modulePath: path.resolve(currentDir, 'script.js'),
}

export default AVANTEL_CATALOG
