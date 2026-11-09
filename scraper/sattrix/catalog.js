import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SATTRIX_CATALOG = {
  source: 'sattrix',
  companyName: 'Sattrix',
  officialBrandName: 'Sattrix Information Security',
  adapter: 'script',
  companyCareerPage: 'https://www.sattrix.com/career.php',
  officialCareersPageUrl: 'https://www.sattrix.com/career.php',
  applicationFormUrl: 'https://docs.google.com/forms/d/e/1FAIpQLSdzjRKoDdKMbn_U1b8TqztyHqpEdbV8X18fCdB5dAJ1tGcURg/viewform?usp=sf_link',
  companyDomain: 'sattrix.com',
  atsPlatform: 'first-party-html-board',
  countryFilter: 'India',
  paginationStrategy: 'single-public-page',
  extractionStrategy: 'verified-first-party-careers-page+text-section-roles+same-page-details+same-page-anchor-links',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-18',
  verifiedSurfaceSummary:
    'Verified on Saturday, July 18, 2026 that https://www.sattrix.com/career.php is the live first-party Sattrix careers page and that it publicly exposes a Current Openings section with visible role sections including Cybersecurity Associate, Cybersecurity Engineer - L1/L2/L3, and Splunk Admin - L1/L2/L3. Anonymous verification also showed the page handoff "Apply now!" CTA leading to a Google Forms application flow rather than distinct per-role detail pages, so this provider treats the same-page role sections as the trustworthy public job source and anchors links back to the first-party page.',
  dryRunFile: 'sattrix/jobs.json',
  modulePath: path.resolve(currentDir, 'script.js'),
}

export default SATTRIX_CATALOG
