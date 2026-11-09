import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const NUVENTO_SYSTEMS_CATALOG = {
  source: 'nuventosystems',
  companyName: 'Nuvento Systems',
  officialBrandName: 'Nuvento',
  adapter: 'script',
  homepageUrl: 'https://nuvento.com/',
  careersHubUrl: 'https://nuvento.com/careers/',
  companyCareerPage: 'https://nuvento.com/careers/kochi/',
  resumeEmails: [
    'naseeba.parvin@nuvento.com',
    'anindita.ghosal@nuvento.com',
  ],
  companyDomain: 'nuvento.com',
  atsPlatform: 'first-party-india-careers-page',
  countryFilter: 'India',
  paginationStrategy: 'single-first-party-india-careers-page',
  extractionStrategy: 'verified-first-party-careers-hub+india-careers-page-inline-role-sections',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-10-03',
  verifiedSurfaceSummary:
    'Verified on October 3, 2026 that the official Nuvento careers hub links to /careers/kochi/ and the India page exposes 17 accordion role sections, including HR Trainee, Intern - Automation, and Web Developer - Technical SEO & Search Visibility Specialist.',
  modulePath: path.join(currentDir, 'script.js'),
  dryRunFile: 'nuventosystems/jobs.json',
}

export default NUVENTO_SYSTEMS_CATALOG
