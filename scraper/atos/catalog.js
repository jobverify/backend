import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const ATOS_CATALOG = {
  source: 'atos',
  companyName: 'Atos',
  adapter: 'script',
  companyCareerPage: 'https://atos.net/en/join-us',
  companyDomain: 'atos.net',
  atsPlatform: 'first-party-wordpress-embedded-jobs-feed',
  countryFilter: 'India',
  paginationStrategy: 'verified-first-party-careers-page-plus-embedded-jobs-payload',
  extractionStrategy:
    'verified-careers-page+embedded-jobs-payload+india-location-map+jobs-atos-detail-pages',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  homepageUrl: 'https://atos.net/',
  jobsWidgetScriptUrl: 'https://atos.net/wp-content/plugins/jobs-atos-net/js/jobs.js',
  publicJobDetailHost: 'https://jobs.atos.net/',
  verifiedIndiaJobUrl: 'https://jobs.atos.net/job/Bangalore-Accessibility-Certified-Tester/1414521533/',
  verifiedOn: '2026-07-15',
  verifiedSurfaceSummary:
    'Verified on July 15, 2026 that https://atos.net/ redirects to the live Atos homepage at https://atos.net/en/, https://atos.net/en/join-us exposes a public first-party jobs widget backed by the embedded window[\'atosjobs_...\'] payload plus https://atos.net/wp-content/plugins/jobs-atos-net/js/jobs.js, and the embedded payload currently contains 629 public jobs including 65 India jobs whose detail URLs resolve on https://jobs.atos.net/ such as https://jobs.atos.net/job/Bangalore-Accessibility-Certified-Tester/1414521533/.',
  modulePath: path.join(currentDir, 'script.js'),
}

export default ATOS_CATALOG
