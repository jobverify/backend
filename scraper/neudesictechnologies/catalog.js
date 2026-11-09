import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const NEUDESIC_TECHNOLOGIES_CATALOG = {
  source: 'neudesictechnologies',
  companyName: 'Neudesic Technologies',
  officialBrandName: 'Neudesic',
  adapter: 'script',
  companyCareerPage: 'https://careers.neudesic.in/jobs',
  companyDomain: 'neudesic.com',
  atsPlatform: 'freshteam',
  countryFilter: 'India',
  paginationStrategy: 'complete-public-board-with-department-count-validation',
  extractionStrategy: 'first-party-freshteam-board+employer-verified-jobposting-details',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-09-13',
  verifiedSurfaceSummary:
    'Verified on September 13, 2026 that the old neudesic.com/careers/ redirects to the IBM Neudesic marketing page. The active first-party Freshteam board at careers.neudesic.in/jobs lists 10 roles. Its public AI Engineer detail identifies Neudesic Technologies Pvt. Ltd. as the hiring organization, includes an India address and a September 12, 2026 posting date, and links to the official Neudesic site and IBM privacy notice.',
  modulePath: path.resolve(currentDir, 'script.js'),
  dryRunFile: 'neudesictechnologies/jobs.json',
}

export default NEUDESIC_TECHNOLOGIES_CATALOG
