import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const RELEVANTZ_TECHNOLOGY_SERVICES_CATALOG = {
  source: 'relevantztechnologyservices',
  companyName: 'Relevantz Technology Services',
  officialBrandName: 'Relevantz',
  adapter: 'script',
  homepageUrl: 'https://www.relevantz.com/',
  companyCareerPage: 'https://www.relevantz.com/careers/',
  wordpressOrigin: 'https://rzwp.relevantz.com',
  wordpressCareersPageSlug: 'careers',
  wordpressCareersPageApiUrl:
    'https://rzwp.relevantz.com/wp-json/wp/v2/pages?slug=careers&acf_format=standard&_fields=id,slug,title,acf',
  atsPlatform: 'official-company-careers+wordpress-json-api',
  countryFilter: 'India',
  paginationStrategy: 'single-wordpress-page-acf-payload',
  extractionStrategy: 'verified-careers-app-shell+verified-wordpress-page-acf+india-tab-job-listings',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  companyDomain: 'relevantz.com',
  verifiedOn: '2026-08-04',
  verifiedSurfaceSummary:
    'Verified on Tuesday, August 4, 2026 that https://www.relevantz.com/careers/ is the live first-party Relevantz careers app shell, that its first-party bundle loads careers page data from https://rzwp.relevantz.com/wp-json/wp/v2/pages?slug=careers&acf_format=standard&_fields=id,slug,title,acf, and that the WordPress ACF payload exposes seven India jobs under the India tab including Java Full stack Developer, Dotnet Fullstack Lead Developer, Data Architect, ServiceNow Developer, Angular Full Stack Developer, and Business Analyst.',
  modulePath: path.resolve(currentDir, 'script.js'),
}

export default RELEVANTZ_TECHNOLOGY_SERVICES_CATALOG
