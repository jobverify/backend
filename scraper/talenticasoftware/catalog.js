import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const TALENTICA_SOFTWARE_CATALOG = {
  source: 'talenticasoftware',
  companyName: 'Talentica Software',
  officialBrandName: 'Talentica',
  adapter: 'script',
  homepageUrl: 'https://www.talentica.com/careers/',
  companyCareerPage: 'https://www.talentica.com/job-openings/',
  atsPlatform: 'official-company-native-role-pages',
  countryFilter: 'India',
  paginationStrategy: 'paired-current-index-and-declared-role-pages;company-scope-unqualified',
  extractionStrategy: 'active-own-role-criteria+application-position-fields;native-country-unproven',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  companyDomain: 'talentica.com',
  verifiedOn: '2026-11-05',
  verifiedSurfaceSummary:
    'Current active Talentica cards bind their declared own role pages, whole published criteria containers and native application-position fields. Exact original opening/closing models and HTML are retained. Work-country, undisclosed requisitions and dates remain unknown; company scope, application activation and cleanup are unqualified. A failed public read stops the source without retries or verified-empty credit.',
  modulePath: path.join(currentDir, 'script.js'),
}

export default TALENTICA_SOFTWARE_CATALOG
