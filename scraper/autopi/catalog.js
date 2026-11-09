import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const VERIFIED_SURFACE_SUMMARY =
  'Verified on July 15, 2026 that https://www.autopi.io/ is the live first-party AutoPi homepage, that https://www.autopi.io/careers/ is the live first-party careers page with 2 public openings, and that both verified detail pages at https://www.autopi.io/careers/software-developer/ and https://www.autopi.io/careers/student-softwate-developer/ are first-party role pages with direct mailto apply handoffs to jobs@autopi.io. Live checks on July 15, 2026 found both published roles in Aalborg, Denmark, so there are no India roles on the verified public AutoPi careers surface right now.'

export const AUTO_PI_CATALOG = {
  source: 'autopi',
  companyName: 'AutoPi',
  officialBrandName: 'AutoPi.io',
  adapter: 'script',
  companyCareerPage: 'https://www.autopi.io/careers/',
  homepageUrl: 'https://www.autopi.io/',
  companyDomain: 'autopi.io',
  applicationEmail: 'jobs@autopi.io',
  applicationUrl: 'mailto:jobs@autopi.io',
  verifiedRoleUrls: [
    'https://www.autopi.io/careers/software-developer/',
    'https://www.autopi.io/careers/student-softwate-developer/',
  ],
  atsPlatform: 'official-company-careers',
  countryFilter: 'India',
  paginationStrategy: 'verified-first-party-careers-page-plus-role-detail-pages',
  extractionStrategy:
    'verified-careers-page+first-party-role-cards+india-location-filter+first-party-role-detail-pages+mailto-apply',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-15',
  verifiedSurfaceSummary: VERIFIED_SURFACE_SUMMARY,
  modulePath: path.join(currentDir, 'script.js'),
}

export default AUTO_PI_CATALOG
