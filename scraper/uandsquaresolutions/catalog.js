import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const VERIFIED_SURFACE_SUMMARY =
  'Verified on Saturday, July 18, 2026 that http://www.udsquare.com/ resolved to an MSP Square homepage at https://mspsquare.com/ exposing About, Contact, Managed Helpdesk, Managed Security SOC, and Resource Bank navigation, but no public careers or jobs navigation. Because the assigned first-party domain does not expose a public job-bearing surface, this provider is fail-closed.'

export const U_AND_D_SQUARE_SOLUTIONS_CATALOG = {
  source: 'uandsquaresolutions',
  companyName: 'U&D Square Solutions',
  officialBrandName: 'U&D Square Solutions',
  adapter: 'script',
  homepageUrl: 'http://www.udsquare.com/',
  companyCareerPage: 'http://www.udsquare.com/',
  redirectTargetUrl: 'https://mspsquare.com/',
  companyDomain: 'udsquare.com',
  atsPlatform: 'redirected-first-party-homepage-contract',
  countryFilter: 'India',
  paginationStrategy: 'first-party-domain-redirect-to-msp-square-homepage',
  extractionStrategy: 'verified-domain-handoff-without-public-careers-or-job-links-return-empty',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-18',
  verifiedSurfaceSummary: VERIFIED_SURFACE_SUMMARY,
  dryRunFile: 'uandsquaresolutions/jobs.json',
  modulePath: path.resolve(currentDir, 'script.js'),
}

export default U_AND_D_SQUARE_SOLUTIONS_CATALOG
