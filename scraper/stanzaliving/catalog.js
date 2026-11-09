import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const STANZA_LIVING_CATALOG = {
  source: 'stanzaliving',
  companyName: 'Stanza Living',
  officialBrandName: 'Stanza Living',
  adapter: 'script',
  homepageUrl: 'https://www.stanzaliving.com/',
  companyCareerPage: 'https://www.stanzaliving.com/careers',
  aboutPageUrl: 'https://www.stanzaliving.com/about-us',
  contactPageUrl: 'https://www.stanzaliving.com/contact-us',
  companyDomain: 'stanzaliving.com',
  atsPlatform: 'official-company-site-no-public-careers',
  countryFilter: 'India',
  paginationStrategy: 'homepage-about-contact-plus-misdirected-careers-route-validation',
  extractionStrategy:
    'verified-homepage+verified-about-contact-pages+verified-careers-route-is-property-listing+return-empty',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-17',
  verifiedSurfaceSummary:
    'Verified on Friday, July 17, 2026 that https://www.stanzaliving.com/, https://www.stanzaliving.com/about-us, and https://www.stanzaliving.com/contact-us are live first-party Stanza Living brand pages, and that the direct first-party route https://www.stanzaliving.com/careers currently resolves to a property listing page headed "PG near Careers Department, Mall Road, Dehradun" rather than a trustworthy recruiting surface. The verified exact-name site exposes brand, history, and contact information but no trustworthy public jobs surface, so this exact-name provider is a fail-closed no-public-careers sentinel.',
  modulePath: path.resolve(currentDir, 'script.js'),
  dryRunFile: 'stanzaliving/jobs.json',
}

export default STANZA_LIVING_CATALOG
