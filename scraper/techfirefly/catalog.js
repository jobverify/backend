import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const TECH_FIREFLY_CATALOG = {
  source: 'techfirefly',
  companyName: 'Tech Firefly',
  officialBrandName: 'Tech Firefly',
  adapter: 'script',
  homepageUrl: 'https://www.techfirefly.com/',
  companyCareerPage: 'https://www.techfirefly.com/careers/',
  companyDomain: 'techfirefly.com',
  atsPlatform: 'official-company-careers-placeholder-shortcode',
  countryFilter: 'India',
  paginationStrategy: 'single-careers-page-placeholder-shortcode-validation',
  extractionStrategy:
    'verified-careers-page+verified-placeholder-shortcode-resume-form-without-public-listings+return-empty',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-18',
  verifiedSurfaceSummary:
    'Verified on Saturday, July 18, 2026 that https://www.techfirefly.com/careers/ was the live first-party Tech Firefly careers page, but it still rendered the literal placeholder shortcode "[my_elementor_caree]" followed only by a generic resume submission form headed "Apply now for success" instead of public role cards, job detail pages, or a trustworthy ATS handoff. This provider therefore stays fail-closed and returns an empty set until Tech Firefly publishes real public openings.',
  modulePath: path.resolve(currentDir, 'script.js'),
  dryRunFile: 'techfirefly/jobs.json',
}

export default TECH_FIREFLY_CATALOG
