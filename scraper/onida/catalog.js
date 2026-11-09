import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const ONIDA_CATALOG = {
  source: 'onida',
  companyName: 'Onida',
  officialBrandName: 'Onida',
  adapter: 'script',
  modulePath: path.resolve(currentDir, 'script.js'),
  companyCareerPage: 'https://onida.com/life-at-onida/',
  officialHomepageUrl: 'https://onida.com/',
  companyDomain: 'onida.com',
  atsPlatform: 'official-life-page-plus-missing-openings-routes',
  countryFilter: 'India',
  paginationStrategy: 'verified-life-page-plus-missing-openings-routes-return-empty',
  extractionStrategy:
    'verified-homepage-careers-menu+verified-life-page-placeholder-current-openings-link+missing-openings-routes-return-empty',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  blockedCareersRouteUrls: [
    'https://onida.com/current-openings/',
    'https://onida.com/careers/',
  ],
  currentOpeningsPlaceholderHref: 'javascript:;',
  verifiedOn: '2026-07-17',
  verifiedSurfaceSummary:
    'Verified on July 17, 2026 that https://onida.com/ and https://onida.com/life-at-onida/ are the current first-party Onida careers surfaces, that both surfaces still show Current Openings as the placeholder href javascript:;, and that the direct first-party openings routes https://onida.com/current-openings/ and https://onida.com/careers/ return first-party 404 pages rather than a trustworthy public jobs surface.',
  dryRunFile: 'onida/jobs.json',
}

export default ONIDA_CATALOG
