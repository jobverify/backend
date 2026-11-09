import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const MAGNIT_GLOBAL_CATALOG = {
  source: 'magnitglobal',
  companyName: 'Magnit Global',
  officialBrandName: 'Magnit',
  adapter: 'script',
  modulePath: path.join(currentDir, 'script.js'),
  companyCareerPage: 'https://magnitglobal.com/about/careers',
  legacyCareerPageUrl: 'https://magnitglobal.com/us/en/company/careers.html',
  verifiedSampleJobUrl: 'https://jobs.dayforcehcm.com/prounlimited/CANDIDATEPORTAL/jobs/7493',
  companyDomain: 'magnitglobal.com',
  atsPlatform: 'dayforce+directsource',
  countryFilter: 'India',
  paginationStrategy: 'all-advertised-dayforce-locales+unfiltered-offsets+directsource+closing-reconciliation',
  extractionStrategy: 'corporate-country-bindings+native-employer-and-posting-identity+full-nested-and-visible-content+explicit-countries',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  dayforceClientNamespace: 'prounlimited',
  dayforceJobBoardCode: 'CANDIDATEPORTAL',
  dayforceJobBoardId: 1,
  dayforceClientId: 80745,
  dayforceLocale: 'en-US',
  dayforceBaseUrl: 'https://jobs.dayforcehcm.com/prounlimited/CANDIDATEPORTAL',
  indiaLegacyDayforceUrl: 'https://globaleur232.dayforcehcm.com/CandidatePortal/en-US/ProUnlimited',
  directSourceBaseUrl: 'https://directsource.magnitglobal.com/eu/magnitglobal',
  zeroResultPolicy: 'evidence-required',
  verifiedOn: '2026-10-26',
  verifiedPublicPostingCount: null,
  verifiedIndiaRoleCount: null,
  verifiedSurfaceSummary:
    'Current https://magnitglobal.com/about/careers binds North America and UK/Ireland/Netherlands to Dayforce, India to its legacy Dayforce URL (verified redirect to the same Magnit client80745/board1 account), and EMEA to DirectSource. Read every advertised Dayforce locale and unfiltered offset, nested full detail content and matching public posting, plus the complete DirectSource inventory, visible primary descriptions and geography, explicit native countries and role-bound application routes. Closing scope/count/ID/location snapshots must reconcile. Original native dates are preserved; unknown countries, missing content, closed postings or additional hiring scopes keep evidence incomplete. Counts belong to current runtime receipts, not historical catalog snapshots.',
}

export default MAGNIT_GLOBAL_CATALOG
