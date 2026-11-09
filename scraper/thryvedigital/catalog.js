import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const THRYVE_DIGITAL_CATALOG = {
  source: 'thryvedigital',
  companyName: 'Thryve Digital',
  officialBrandName: 'enGen Global',
  adapter: 'script',
  homepageUrl: 'https://www.goengen.in/',
  companyCareerPage: 'https://www.goengen.in/careers',
  companyDomain: 'goengen.in',
  atsPlatform: 'darwinbox',
  countryFilter: 'India',
  paginationStrategy: 'browser-session-darwinbox-pagination',
  extractionStrategy: 'verified-goengen-careers-page+darwinbox-listing-api',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  officialCareersHandoffUrl: 'https://tdh.darwinbox.in/ms/candidate/careers',
  darwinboxOrigin: 'https://tdh.darwinbox.in',
  darwinboxCompanyId: 'main',
  verifiedOn: '2026-08-05',
  verifiedSurfaceSummary:
    'Verified on Wednesday, August 5, 2026 that https://www.thryvedigital.com/ now redirects to https://www.goengen.in/, and that https://www.goengen.in/careers is the live first-party enGen Global careers page. Verified that the page title is Careers, that it presents the headline "An enGenious career, rooted in India.", and that its CLICK HERE TO JOIN US handoff still points applicants to the official Darwinbox candidate host at https://tdh.darwinbox.in/ms/candidate/careers, where the public enGen Global careers surface remains live with India jobs.',
  modulePath: path.join(currentDir, 'script.js'),
  dryRunFile: path.join(currentDir, 'jobs.json'),
}

export default THRYVE_DIGITAL_CATALOG
