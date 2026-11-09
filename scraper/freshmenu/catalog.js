import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const FRESHMENU_CATALOG = {
  source: 'freshmenu',
  companyName: 'FreshMenu',
  adapter: 'script',
  homepageUrl: 'https://freshmenu.com/',
  aboutPageUrl: 'https://freshmenu.com/about',
  checkedMissingRouteUrls: [
    'https://freshmenu.com/careers',
    'https://freshmenu.com/jobs',
  ],
  companyDomain: 'freshmenu.com',
  atsPlatform: 'official-company-site-no-public-careers',
  countryFilter: 'India',
  paginationStrategy: 'verified-homepage-plus-about-page-plus-missing-career-routes',
  extractionStrategy:
    'verified-apex-homepage-no-public-jobs+verified-generic-app-shell-routes-return-empty',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-09-03',
  verifiedSurfaceSummary:
    'Verified on September 3, 2026 that the working FreshMenu first-party apex host is https://freshmenu.com/. The homepage at https://freshmenu.com/ and https://freshmenu.com/about, https://freshmenu.com/careers, and https://freshmenu.com/jobs now resolve to the same branded FreshMenu Vite app shell without JobPosting markup or public job-listing signals. No trustworthy public jobs surface is currently available.',
  modulePath: path.join(currentDir, 'script.js'),
}

export default FRESHMENU_CATALOG
