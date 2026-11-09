import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const MEDGENOME_CATALOG = {
  source: 'medgenome',
  companyName: 'MedGenome',
  officialBrandName: 'MedGenome',
  adapter: 'script',
  companyCareerPage: 'https://diagnostics.medgenome.com/career/',
  companyDomain: 'diagnostics.medgenome.com',
  atsPlatform: 'first-party-wordpress-careers-ajax',
  countryFilter: 'India',
  paginationStrategy: 'verified-admin-ajax-page-loop-until-empty-html',
  extractionStrategy: 'verified-careers-page-shell+career_listing-admin-ajax-html+detail-pages',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  jobsApiUrl: 'https://diagnostics.medgenome.com/wp-admin/admin-ajax.php',
  ajaxAction: 'career_listing',
  verifiedOn: '2026-07-16',
  verifiedSurfaceSummary:
    'Verified on July 16, 2026 that MedGenome exposes a live first-party careers shell at https://diagnostics.medgenome.com/career/ and a reachable WordPress admin-ajax listing feed at https://diagnostics.medgenome.com/wp-admin/admin-ajax.php using action career_listing. Verified that the public listings feed and linked first-party detail pages currently expose roles including Zonal Business Manager, Manager - Scientific Affairs, and Area Sales Manager.',
  modulePath: path.join(currentDir, 'script.js'),
}

export default MEDGENOME_CATALOG
