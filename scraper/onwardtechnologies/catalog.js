import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const ONWARD_TECHNOLOGIES_CATALOG = {
  source: 'onwardtechnologies',
  companyName: 'Onward Technologies',
  officialBrandName: 'Onward Tech',
  adapter: 'script',
  modulePath: path.resolve(currentDir, 'script.js'),
  dryRunFile: 'onwardtechnologies/jobs.json',
  homepageUrl: 'https://www.onwardgroup.com/',
  companyCareerPage: 'https://www.onwardgroup.com/careers.php',
  jobsBoardUrl: 'https://www.onwardgroup.com/careers.php',
  officialResumeSubmissionEmail: 'careers@onwardgroup.com',
  companyDomain: 'onwardgroup.com',
  atsPlatform: 'official-company-site',
  countryFilter: 'India',
  paginationStrategy: 'single-first-party-careers-page-accordion-listings',
  extractionStrategy:
    'verified-first-party-careers-page+public-accordion-listings+sucuri-cookie-challenge+india-location-filter',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-17',
  verifiedSurfaceSummary:
    'Verified on July 17, 2026 that https://www.onwardgroup.com/careers.php is the live first-party Onward Tech careers page. The public page is protected by a Sucuri cookie challenge, but the challenge is solvable from the public response and the post-challenge page exposes Current Openings with India listings including Embedded - SME (Validation Automotive), Embedded - Software Architect (ADAS, Infotainment_ Automotive), India Business Delivery Head - Automotive Digital, and Subject Matter Expert - Digital (Automotive). This provider parses the verified accordion listings and keeps only India-located roles.',
}

export default ONWARD_TECHNOLOGIES_CATALOG
