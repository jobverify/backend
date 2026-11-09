import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SHELL_RECHARGE_SOLUTIONS_CATALOG = {
  source: 'shellrechargesolutions',
  companyName: 'Shell Recharge Solutions',
  officialBrandName: 'Shell Recharge',
  adapter: 'script',
  modulePath: path.join(currentDir, 'script.js'),
  homepageUrl: 'https://shellrecharge.com/',
  companyCareerPage: 'https://shellrecharge.com/careers',
  atsPlatform: 'brand-homepage-plus-generic-shell-careers-redirect',
  countryFilter: 'India',
  paginationStrategy: 'brand-homepage-and-careers-route-title-validation-return-empty',
  extractionStrategy: 'verified-brand-homepage+verified-generic-shell-careers-route+no-distinct-shell-recharge-solutions-jobs-surface',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  companyDomain: 'shellrecharge.com',
  dryRunFile: 'shellrechargesolutions/jobs.json',
  verifiedOn: '2026-07-17',
  verifiedSurfaceSummary:
    'Verified on Friday, July 17, 2026 that https://shellrecharge.com/ resolved to the Shell Recharge brand homepage titled "Elektrisch opladen | Shell Nederland", while https://shellrecharge.com/careers resolved to a generic "Shell Global" page rather than a distinct Shell Recharge Solutions public jobs surface.',
}

export default SHELL_RECHARGE_SOLUTIONS_CATALOG
