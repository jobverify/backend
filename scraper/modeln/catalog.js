import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const MODEL_N_CATALOG = {
  source: 'modeln',
  companyName: 'Model N',
  adapter: 'script',
  companyCareerPage: 'https://www.modeln.com/company/careers/',
  companyDomain: 'modeln.com',
  atsPlatform: 'lever',
  countryFilter: 'India',
  paginationStrategy: 'lever-public-postings-api',
  extractionStrategy: 'verified-first-party-careers-embed+lever-public-postings-api',
  leverApiUrl: 'https://api.lever.co/v0/postings/modeln?mode=json',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-10-02',
  verifiedSurfaceSummary:
    'Verified on October 2, 2026 that the first-party Model N careers page embeds the modeln Lever account. Its hidden No results placeholder is not inventory evidence. The public Lever postings API lists current roles, including a Hyderabad India posting.',
  modulePath: path.join(currentDir, 'script.js'),
}

export default MODEL_N_CATALOG
