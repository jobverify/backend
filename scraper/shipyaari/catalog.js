import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const VERIFIED_SURFACE_SUMMARY =
  'Verified on Friday, July 17, 2026 that https://www.shipyaari.com/careers/ is the live first-party Shipyaari careers page showing public role cards including Sales Head - B2C & D2C, Customer Growth Manager, and Logistics Operations Executive, and that the same first-party page linked to role detail pages including https://www.shipyaari.com/careers/sales-manager/ plus the linked Customer Growth Manager detail page on the official shipyaari.com domain.'

export const SHIPYAARI_CATALOG = {
  source: 'shipyaari',
  companyName: 'Shipyaari',
  officialBrandName: 'Shipyaari',
  adapter: 'script',
  modulePath: path.join(currentDir, 'script.js'),
  dryRunFile: 'shipyaari/jobs.json',
  homepageUrl: 'https://www.shipyaari.com/',
  companyCareerPage: 'https://www.shipyaari.com/careers/',
  companyDomain: 'shipyaari.com',
  atsPlatform: 'official-company-site-public-role-pages',
  countryFilter: 'India',
  paginationStrategy: 'single-official-careers-page-no-pagination',
  extractionStrategy:
    'verified-official-careers-page+first-party-role-card-links+first-party-role-detail-page-parsing',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedSampleRoleTitle: 'Sales Head - B2C & D2C',
  verifiedSampleRoleDetailUrl: 'https://www.shipyaari.com/careers/sales-manager/',
  verifiedOn: '2026-07-17',
  verifiedSurfaceSummary: VERIFIED_SURFACE_SUMMARY,
}

export default SHIPYAARI_CATALOG
