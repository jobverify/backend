import path from 'node:path'
import { fileURLToPath } from 'node:url'
const currentDir = path.dirname(fileURLToPath(import.meta.url))
export const DAVINCI_TRADING_CATALOG = {
  source: 'davincitrading', companyName: 'Da Vinci Trading', officialBrandName: 'Da Vinci', adapter: 'script',
  modulePath: path.join(currentDir, 'script.js'), companyCareerPage: 'https://davincitrading.com/careers/', companyDomain: 'davincitrading.com',
  atsPlatform: 'greenhouse-eu+first-party-careers', countryFilter: 'India', parser: 'custom-script', normalizationProfile: 'engineering-default',
  greenhouseBoardToken: 'davinciderivatives', nativeBoardUrl: 'https://job-boards.eu.greenhouse.io/davinciderivatives', nativeBoardId: 4000939101,
  paginationStrategy: 'native-50-row-pages+all-corporate-and-native-details+closing-reconciliation',
  extractionStrategy: 'current-role-bound-application-loader+native-employer-identity+full-rendered-content+explicit-India-segments',
  zeroResultPolicy: 'evidence-required', verifiedOn: '2026-10-26', verifiedPublicPostingCount: null, verifiedIndiaRoleCount: null,
  verifiedSurfaceSummary: 'The current first-party careers inventory and every corporate posting bind explicitly to the Greenhouse EU davinciderivatives account. Verify the complete active application-loader template, posting ID, fallback, native embed account and native board4000939101 identity. Read all unfiltered 50-row pages, full native role bodies, matching visible geography and application forms before closing corporate/native ID, count, location and update reconciliation. Preserve actual native requisitions and original publication dates; corporate SEO dates and native updates never replace publication. Mixed-country roles publish only explicit India segments. Missing content, unresolved countries, changing inventories or additional hiring scopes retain partial evidence. Current counts belong to runtime receipts.',
}
export default DAVINCI_TRADING_CATALOG
