import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const CYBER_INFRASTRUCTURE_CATALOG = {
  source: 'cyberinfrastructure',
  companyName: 'Cyber Infrastructure',
  officialBrandName: 'Cyber Infrastructure (CIS)',
  adapter: 'script',
  modulePath: path.resolve(currentDir, 'script.js'),
  companyCareerPage: 'https://career.cisin.com/',
  companyDomain: 'cisin.com',
  atsPlatform: 'first-party-native-jobposting',
  countryFilter: 'India',
  paginationStrategy: 'current-advertised-pages-opening-closing;whole-source-unqualified',
  extractionStrategy: 'own-role-full-criteria-original-fields-and-explicit-country;all-observations-before-India-selection',
  parser: 'identity-bound-published-role-observations',
  normalizationProfile: 'engineering-default',
  verifiedOn: null,
  verifiedSurfaceSummary:
    "Identity-bound published role observations and complete original criteria; whole source scope, active recruitment, application activation, database persistence and publication remain unqualified. No static complete inventory or India-zero claim.",
}

export default CYBER_INFRASTRUCTURE_CATALOG
