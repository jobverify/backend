import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const CLARION_TECHNOLOGIES_CATALOG = {
  source: 'clariontechnologies',
  companyName: 'Clarion Technologies',
  officialBrandName: 'Clarion Technologies',
  adapter: 'script',
  modulePath: path.join(currentDir, 'script.js'),
  homepageUrl: 'https://www.clariontech.com/',
  companyCareerPage: 'https://www.clariontech.com/careers',
  featuredJobsUrl: 'https://jobs.clariontechnologies.co.in:444/featured-job',
  openingsUrl: 'https://www.clariontech.com/open-positions',
  atsPlatform: 'official-careers-page-plus-featured-jobs-iframe',
  countryFilter: 'India',
  paginationStrategy: 'official-careers-handoff-plus-single-featured-jobs-surface-validation',
  extractionStrategy: 'verified-careers-page+verified-full-jobs-listing-with-scoped-native-https-fallback',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  companyDomain: 'clariontech.com',
  dryRunFile: 'clariontechnologies/jobs.json',
  verifiedOn: '2026-08-07',
  verifiedSurfaceSummary:
    'Verified on Sunday, September 13, 2026 that https://www.clariontech.com/careers embeds the public Clarion jobs host, whose full listing exposed 10 current openings with explicit Pune locations and Apply Now links into https://www.clariontech.com/open-position-detail. Node cannot verify the jobs-host certificate chain, while Windows Schannel validates it; the scraper uses a scoped native HTTPS fallback without disabling certificate verification.',
}

export default CLARION_TECHNOLOGIES_CATALOG
