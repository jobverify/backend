import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const VERIFIED_SURFACE_SUMMARY =
  'Verified on July 15, 2026 that https://www.elcompanies.com/en/careers is the live first-party Estee Lauder Companies careers hub for the Estee Lauder India slice, and that https://www.elcompanies.com/en/careers/brand-jobs, https://www.elcompanies.com/en/careers/corporate-jobs, https://www.elcompanies.com/en/careers/retail-jobs, and https://www.elcompanies.com/en/careers/technology-jobs all render the same India-localized first-party careers shell with JobCountry=India, JobCity=Chennai, a Search all jobs widget, and a visible "No jobs available." empty state rather than public job records. Verified that https://www.elcompanies.com/en/careers/search-jobs currently resolves to the site\'s first-party Page Not Found shell, while https://www.esteelauder.in/careers returned 403 Forbidden during direct probing. No trustworthy public jobs surface is currently available for Estee Lauder India.'

export const ESTEE_LAUDER_INDIA_CATALOG = {
  source: 'esteelauderindia',
  companyName: 'Estee Lauder India',
  officialBrandName: 'The Estee Lauder Companies',
  adapter: 'script',
  companyCareerPage: 'https://www.elcompanies.com/en/careers',
  brandJobsPage: 'https://www.elcompanies.com/en/careers/brand-jobs',
  corporateJobsPage: 'https://www.elcompanies.com/en/careers/corporate-jobs',
  retailJobsPage: 'https://www.elcompanies.com/en/careers/retail-jobs',
  technologyJobsPage: 'https://www.elcompanies.com/en/careers/technology-jobs',
  searchJobsPage: 'https://www.elcompanies.com/en/careers/search-jobs',
  companyDomain: 'elcompanies.com',
  atsPlatform: 'official-company-site-no-public-careers',
  countryFilter: 'India',
  paginationStrategy: 'verified-first-party-careers-hub-plus-empty-first-party-category-pages',
  extractionStrategy:
    'verified-first-party-careers-hub+verified-empty-first-party-india-careers-pages-return-empty',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-15',
  verifiedSurfaceSummary: VERIFIED_SURFACE_SUMMARY,
  dryRunFile: 'esteelauderindia/jobs.json',
  modulePath: path.resolve(currentDir, 'script.js'),
}

export default ESTEE_LAUDER_INDIA_CATALOG
