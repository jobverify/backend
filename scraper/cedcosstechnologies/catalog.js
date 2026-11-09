import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const CEDCOSS_TECHNOLOGIES_CATALOG = {
  source: 'cedcosstechnologies',
  companyName: 'Cedcoss Technologies',
  officialBrandName: 'CEDCOSS',
  adapter: 'script',
  homepageUrl: 'https://cedcoss.com/',
  companyCareerPage: 'https://cedcoss.com/careers',
  companyDomain: 'cedcoss.com',
  atsPlatform: 'official-company-careers',
  countryFilter: 'India',
  paginationStrategy: 'single-first-party-open-roles-page-plus-same-domain-detail-pages',
  extractionStrategy:
    'verified-first-party-careers-page+same-domain-role-links+nextjs-detail-payloads',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-18',
  verifiedSurfaceSummary:
    'Verified on Saturday, July 18, 2026 that https://cedcoss.com/careers is the live first-party CEDCOSS careers page and that it publishes same-domain role links such as /careers/sales-executive. The detail pages expose richer job metadata through the first-party Next.js payload embedded on each role page, so this local scraper uses the careers listing plus same-domain detail routes.',
  modulePath: path.resolve(currentDir, 'script.js'),
  dryRunFile: 'cedcosstechnologies/jobs.json',
}

export default CEDCOSS_TECHNOLOGIES_CATALOG
