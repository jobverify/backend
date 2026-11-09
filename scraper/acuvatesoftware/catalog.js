import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const ACUVATE_SOFTWARE_CATALOG = {
  source: 'acuvatesoftware',
  companyName: 'Acuvate Software',
  officialBrandName: 'Acuvate',
  adapter: 'script',
  homepageUrl: 'https://acuvate.com/',
  companyCareerPage: 'https://acuvate.com/careers/',
  applyUrl: 'https://acuvate.com/careers/#fill_the_form',
  atsPlatform: 'official-first-party-role-sections',
  countryFilter: 'India',
  paginationStrategy: 'runtime-advertised-hiring-scope-and-closing-inventory-recheck',
  extractionStrategy: 'visible-elementor-role-panels+current-client-reveal-contract+exact-worksites+closing-reconciliation',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  companyDomain: 'acuvate.com',
  verifiedOn: '2026-10-27',
  zeroResultPolicy: 'evidence-required',
  verifiedSurfaceSummary:
    'Current public Acuvate homepage binds to its first-party careers page. Runtime enumerates visible Elementor role sections, validates the advertised native accordion client and shared application target, matches exact current employer worksites for qualified country inference, and reconciles closing scope, membership and every role field. Advertised unavailable locales, unknown countries, changed criteria and caps prevent authoritative totals and cleanup.',
  modulePath: path.resolve(currentDir, 'script.js'),
}

export default ACUVATE_SOFTWARE_CATALOG
