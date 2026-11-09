import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SHOPPERS_STOP_CATALOG = {
  source: 'shoppersstop',
  companyName: 'Shoppers Stop',
  officialBrandName: 'Shoppers Stop Limited',
  adapter: 'script',
  modulePath: path.resolve(currentDir, 'script.js'),
  homepageUrl: 'https://www.shoppersstop.com/',
  companyCareerPage: 'https://www.shoppersstop.com/miscs/aboutus',
  officialCareersHandoffUrl: 'https://ss-people.darwinbox.in/ms/candidate/careers',
  darwinboxOrigin: 'https://ss-people.darwinbox.in',
  darwinboxCompanyId: 'main',
  companyDomain: 'shoppersstop.com',
  atsPlatform: 'darwinbox',
  countryFilter: 'India',
  paginationStrategy: 'browser-session-darwinbox-pagination',
  extractionStrategy: 'verified-first-party-about-page+darwinbox-public-candidate-api',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-08-14',
  verifiedSurfaceSummary:
    'Verified on Friday, August 14, 2026 that https://www.shoppersstop.com/aboutus redirects to the live official Shoppers Stop about page at https://www.shoppersstop.com/miscs/aboutus, that the older beta.shoppersstop.com route is no longer reachable from this environment, and that the live first-party about page still exposes the Careers handoff to the public Darwinbox candidate portal at https://ss-people.darwinbox.in/ms/candidate/careers. The Darwinbox tenant remains live, so the provider uses the verified first-party handoff plus Darwinbox public candidate API pagination.',
  dryRunFile: 'shoppersstop/jobs.json',
}

export default SHOPPERS_STOP_CATALOG
