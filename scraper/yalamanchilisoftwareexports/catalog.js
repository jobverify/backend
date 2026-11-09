import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const YALAMANCHILI_SOFTWARE_EXPORTS_CATALOG = {
  source: 'yalamanchilisoftwareexports',
  companyName: 'Yalamanchili Software Exports',
  officialBrandName: 'Yalamanchili',
  adapter: 'script',
  modulePath: path.join(currentDir, 'script.js'),
  homepageUrl: 'https://www.ysppayments.com/',
  companyCareerPage: 'https://www.ysppayments.com/',
  atsPlatform: 'official-company-site-no-public-careers',
  countryFilter: 'India',
  paginationStrategy: 'legacy-domain-redirect-plus-current-brand-homepage-plus-common-careers-route-404-validation',
  extractionStrategy: 'verified-current-brand-homepage-without-public-jobs+common-careers-route-404-validation-return-empty',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  companyDomain: 'ysppayments.com',
  dryRunFile: 'yalamanchilisoftwareexports/jobs.json',
  verifiedOn: '2026-08-06',
  verifiedSurfaceSummary:
    'Verified on Thursday, August 6, 2026 that the legacy Yalamanchili domain redirected to the current first-party YSP Payments homepage at https://www.ysppayments.com/, and that the live brand site did not expose any trustworthy public careers feed while the common /career, /careers, and /jobs routes returned 404 surfaces.',
}

export default YALAMANCHILI_SOFTWARE_EXPORTS_CATALOG
