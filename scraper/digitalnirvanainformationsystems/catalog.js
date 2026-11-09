import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const DIGITAL_NIRVANA_INFORMATION_SYSTEMS_CATALOG = {
  source: 'digitalnirvanainformationsystems',
  companyName: 'Digital Nirvana Information Systems',
  officialBrandName: 'Digital Nirvana',
  adapter: 'script',
  homepageUrl: 'https://digital-nirvana.com/',
  companyCareerPage: 'https://digital-nirvana.com/careers-at-digital-nirvana/',
  atsPlatform: 'official-company-careers-page-mailto-apply',
  countryFilter: 'India',
  paginationStrategy: 'single-first-party-careers-page-with-location-tabs-and-deduped-mailto-roles',
  extractionStrategy: 'verified-homepage-careers-link+verified-careers-page+india-tab-role-block-extraction',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  companyDomain: 'digital-nirvana.com',
  verifiedOn: '2026-08-02',
  verifiedSurfaceSummary:
    'Verified on Sunday, August 2, 2026 that https://digital-nirvana.com/ is the live first-party homepage and now links to the first-party careers page at https://digital-nirvana.com/careers-at-digital-nirvana/. Verified that the careers page exposes location tabs for California, USA, Hyderabad, India, and Coimbatore, India; that the India tabs currently expose three first-party Apply Now role blocks backed by mailto:jobs@digital-nirvana.com; and that these blocks collapse to two unique India openings after deduping the repeated remote Editor/Senior Editor role. The live India openings verified on that date were Editor/Senior Editor - Financial Content and Editor & Captioner.',
  modulePath: path.resolve(currentDir, 'script.js'),
  dryRunFile: 'digitalnirvanainformationsystems/jobs.json',
}

export default DIGITAL_NIRVANA_INFORMATION_SYSTEMS_CATALOG
