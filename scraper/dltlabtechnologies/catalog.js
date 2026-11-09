import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const DLT_LAB_TECHNOLOGIES_CATALOG = {
  source: 'dltlabtechnologies',
  companyName: 'DLT Lab Technologies',
  officialBrandName: 'DLT Labs',
  adapter: 'script',
  homepageUrl: 'https://www.dltlabs.com/',
  companyCareerPage: 'https://careers.knnx.com/jobs/Careers',
  rebrandArticleUrl:
    'https://knnx.com/worlds-foremost-freight-and-logistics-software-innovator-reenergized-as-knnx-corp-formerly-dlt-labs/',
  atsPlatform: 'legacy-brand-blocked-parent-careers',
  countryFilter: 'India',
  paginationStrategy: 'legacy-domain-redirect-plus-parent-careers-block-check',
  extractionStrategy: 'verified-dltlabs-to-knnx-redirect+verified-rebrand-notice+blocked-parent-careers-surface',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  companyDomain: 'dltlabs.com',
  verifiedOn: '2026-07-18',
  verifiedSurfaceSummary:
    'Verified on Saturday, July 18, 2026 that https://www.dltlabs.com/ redirected to KNNX Corp, that the first-party KNNX rebrand notice explicitly stated DLT Labs is now KNNX Corp, and that the generic parent careers surface at https://careers.knnx.com/jobs/Careers was blocked from this environment rather than exposing a trustworthy DLT-specific public jobs feed.',
  modulePath: path.resolve(currentDir, 'script.js'),
}

export default DLT_LAB_TECHNOLOGIES_CATALOG
