import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const AJNALENS_CATALOG = {
  source: 'ajnalens',
  companyName: 'AjnaLens',
  officialBrandName: 'AjnaLens',
  adapter: 'script',
  companyCareerPage: 'https://ajnalens.com/careers',
  homepageUrl: 'https://ajnalens.com/',
  applicationUrl: 'https://ajnalens.com/careers',
  atsPlatform: 'official-company-careers',
  countryFilter: 'India',
  paginationStrategy: 'single-first-party-careers-page',
  extractionStrategy: 'verified-nextjs-careers-page+embedded-openings-payload+shared-first-party-careers-form',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  companyDomain: 'ajnalens.com',
  verifiedOn: '2026-07-15',
  verifiedSurfaceSummary:
    'Verified on July 15, 2026 that https://ajnalens.com/ links to the live first-party careers surface at https://ajnalens.com/careers, where AjnaLens publishes two inline public openings named Product Researcher and Full Stack Developer inside the streamed Next.js payload alongside the shared "Start Your Journey With Us" application form. The guessed detail routes https://ajnalens.com/careers/product-researcher and https://ajnalens.com/careers/full-stack-developer both returned the same first-party 404 page, so the verified public jobs surface remains the single shared careers page.',
  modulePath: path.join(currentDir, 'script.js'),
}

export default AJNALENS_CATALOG
