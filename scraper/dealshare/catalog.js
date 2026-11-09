import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const DEAL_SHARE_CATALOG = {
  source: 'dealshare',
  companyName: 'DealShare',
  adapter: 'script',
  companyCareerPage: 'https://about.dealshare.in/careers',
  homepageUrl: 'https://www.dealshare.in/',
  aboutHubUrl: 'https://about.dealshare.in/',
  directCareersRouteUrl: 'https://about.dealshare.in/careers',
  companyDomain: 'dealshare.in',
  atsPlatform: 'official-company-site-no-public-careers',
  countryFilter: 'India',
  paginationStrategy: 'homepage-plus-spa-about-hub-plus-access-denied-direct-careers-route',
  extractionStrategy:
    'verified-homepage+verified-about-hub-spa-shell+verified-spa-bundle-about-and-careers-copy-without-openings+verified-direct-careers-route-access-denied-return-empty',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-08-08',
  verifiedSurfaceSummary:
    'Verified on August 8, 2026 that https://www.dealshare.in/ is the live DealShare homepage, that its About Us and Careers links both point to the first-party about hub at https://about.dealshare.in/, that the about hub currently serves a first-party SPA shell, and that its published JS bundle still contains the verified about-hub and careers-route copy. Direct navigation to https://about.dealshare.in/careers returned an AccessDenied response during live checks, while the current SPA bundle still contains only employer-branding, culture, testimonial, and contact copy with no public openings, apply links, ATS handoff, or structured JobPosting data, so the first-party surface still exposes no trustworthy public jobs surface.',
  modulePath: path.resolve(currentDir, 'script.js'),
}

export default DEAL_SHARE_CATALOG
