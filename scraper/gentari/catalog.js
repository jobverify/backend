import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const GENTARI_CATALOG = {
  source: 'gentari',
  companyName: 'Gentari',
  adapter: 'script',
  homepageUrl: 'https://www.gentari.com/',
  companyCareerPage: 'https://www.gentari.com/careers',
  indiaHomepageUrl: 'https://www.gentari.in/',
  indiaCareersUrl: 'https://www.gentari.in/careers',
  linkedinJobsUrl: 'https://www.linkedin.com/company/gentari/jobs/',
  companyDomain: 'gentari.com',
  atsPlatform: 'official-company-site-no-public-careers',
  countryFilter: 'India',
  paginationStrategy:
    'verified-global-homepage-plus-careers-linkedin-handoff-plus-india-404-careers-route',
  extractionStrategy:
    'verified-global-and-india-homepages+linkedin-jobs-handoff+verified-india-404-return-empty',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-16',
  verifiedSurfaceSummary:
    'Verified on July 16, 2026 that https://www.gentari.com/ is the live global Gentari homepage, that its careers route at https://www.gentari.com/careers currently hands candidates to the LinkedIn jobs surface at https://www.linkedin.com/company/gentari/jobs/, that https://www.gentari.in/ is the live India homepage, and that https://www.gentari.in/careers resolves to the verified first-party 404 surface rather than a public jobs board.',
  modulePath: path.join(currentDir, 'script.js'),
}

export default GENTARI_CATALOG
