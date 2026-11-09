import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const ENDURANCE_CATALOG = {
  source: 'endurance',
  companyName: 'Endurance',
  officialBrandName: 'Endurance Technologies Limited',
  adapter: 'script',
  modulePath: path.resolve(currentDir, 'script.js'),
  officialHomepageUrl: 'https://www.endurancegroup.com/',
  officialCareersLandingUrl: 'https://www.endurancegroup.com/careers/',
  companyCareerPage: 'https://www.endurancegroup.com/careers/job-portal/',
  officialJobDetailExampleUrl: 'https://www.endurancegroup.com/career/technical-architect/',
  atsPlatform: 'first-party-careers-page-and-job-portal',
  countryFilter: 'India',
  paginationStrategy: 'single-first-party-job-portal-html',
  extractionStrategy:
    'verified-browser-rendered-careers-page+job-portal+same-domain-detail-pages',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  companyDomain: 'endurancegroup.com',
  verifiedOn: '2026-08-14',
  verifiedSurfaceSummary:
    'Verified on August 14, 2026 that the live Endurance careers surface remains first-party on https://www.endurancegroup.com/careers/ and https://www.endurancegroup.com/careers/job-portal/, with same-domain detail pages such as https://www.endurancegroup.com/career/technical-architect/. Browser-rendered verification still showed Current Opening (6) plus public roles including Technical Architect and Technical Lead - Hardware. Direct Node fetch probes to https://www.endurancegroup.com/, https://www.endurancegroup.com/careers/, https://www.endurancegroup.com/careers/job-portal/, and https://www.endurancegroup.com/career/technical-architect/ returned a Cloudflare 403 "Just a moment..." challenge, so API-only runs must treat that verified first-party block as a graceful no-data condition instead of crashing while the verified official homepage remains https://www.endurancegroup.com/',
  dryRunFile: 'endurance/jobs.json',
}

export default ENDURANCE_CATALOG
